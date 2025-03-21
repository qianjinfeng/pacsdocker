import os
from pynetdicom import AE, evt, AllStoragePresentationContexts, ALL_TRANSFER_SYNTAXES
from pynetdicom.sop_class import Verification
import pydicom
from pydicom.tag import Tag
from pydicom.encaps import generate_pixel_data_frame
from pika import ConnectionParameters, BlockingConnection, PlainCredentials
import json
import requests
import logging
import time

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# 获取环境变量
RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'localhost')
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'guest')
RABBITMQ_PASSWORD = os.getenv('RABBITMQ_PASSWORD', 'guest')
RABBITMQ_QUEUE = os.getenv('RABBITMQ_QUEUE', 'dicom_queue')
IPFS_HOST = os.getenv('IPFS_HOST', '127.0.0.1')
IPFS_PORT = os.getenv('IPFS_PORT', '5001')
AE_TITLE = os.getenv('AE_TITLE', 'MY_STORE_SCU')

# 设置RabbitMQ连接
credentials = PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
parameters = ConnectionParameters(heartbeat=0, host=RABBITMQ_HOST, credentials=credentials)
rabbitmq_connection = BlockingConnection(parameters)
rabbitmq_channel = rabbitmq_connection.channel()
rabbitmq_channel.queue_declare(queue=RABBITMQ_QUEUE, auto_delete=True)

class MyStorage(object):

    def __init__(self):
        self.ae = AE(ae_title=AE_TITLE)
        storage_sop_classes = [cx.abstract_syntax for cx in AllStoragePresentationContexts]
        for uid in storage_sop_classes:
            self.ae.add_supported_context(uid, ALL_TRANSFER_SYNTAXES)
        self.ae.add_supported_context(Verification, ALL_TRANSFER_SYNTAXES)
        self.handlers = [(evt.EVT_C_STORE, self.handle_store), (evt.EVT_C_ECHO, self.handle_echo)]
        
        self.currentSOPinstanceUID = ''
        self.instanceNR = ''

        # Kubo API 地址
        self.api_url = f'http://{IPFS_HOST}:{IPFS_PORT}/api/v0/add'

        self.rabbitmq_connection = None
        self.rabbitmq_channel = None
        self.reconnect_rabbitmq()

    def reconnect_rabbitmq(self):
        """尝试重新连接到 RabbitMQ"""
        while not self.rabbitmq_connection or self.rabbitmq_connection.is_closed:
            try:
                credentials = PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
                parameters = ConnectionParameters(heartbeat=0, host=RABBITMQ_HOST, credentials=credentials)
                self.rabbitmq_connection = BlockingConnection(parameters)
                self.rabbitmq_channel = self.rabbitmq_connection.channel()
                self.rabbitmq_channel.queue_declare(queue=RABBITMQ_QUEUE, auto_delete=True)
                logging.info("Connected to RabbitMQ.")
            except Exception as e:
                logging.error(f"Failed to connect to RabbitMQ: {e}. Retrying...")
                time.sleep(5)

    def handle_echo(self, event):
        logging.info("Received C-ECHO request")
        return 0x0000  # 返回状态码，0x0000表示成功

    def bulk_data_handler(self, data_element):
        if data_element.VR in ['OB', 'OD', 'OF', 'OL', 'OV', 'OW']:
            file_name = f'{data_element.tag:08x}'  # 将tag转换为十六进制字符串
            if data_element.tag == pydicom.tag.Tag(0x7fe0, 0x0010):
                frames = generate_pixel_data_frame(data_element.value);
                # 逐项处理每个 bytes 对象
                for chunk in frames:
                    # 处理每个 chunk（bytes 对象）
                    print(f"frame size; {len(chunk)}")
                    # 准备POST请求的数据
                    files = {'file': (file_name, chunk)}
                    
                    try:
                        # 发送POST请求
                        response = requests.post(self.api_url, files=files)
                        response.raise_for_status()  # 抛出HTTP错误
                    except Exception as e:
                        print(f"Failed to store DICOM pixel to IPFS: {e}")
            else:
                files = {'file': (file_name, data_element.value)}
                try:
                    # 发送POST请求
                    response = requests.post(self.api_url, files=files)
                    response.raise_for_status()  # 抛出HTTP错误
                except Exception as e:
                    print(f"Failed to store DICOM other than pixel to IPFS: {e}")

            # 检查响应状态码
            if response.status_code == 200:
                result = response.json()
                print(f'BulkData added to IPFS: {result["Hash"]}')
                return result['Hash']
            else:
                print(f'Error adding BulkData to IPFS: {response.status_code} - {response.text}')

        else:
            logging.warning(f"Unsupported VR: {data_element.VR}")
            return data_element.value

    def handle_store(self, event):
        """Handle EVT_C_STORE events."""
        try:
            ds = event.dataset
            ds.file_meta = event.file_meta

            # 检查并设置PatientSex默认值
            if 'PatientSex' not in ds or not ds.PatientSex:
                print("Setting default value for PatientSex.")
                ds.PatientSex = 'O'  # 设置默认值为 'O' (Other)

            # 检查并设置StudyID默认值
            if 'StudyID' not in ds or not ds.StudyID:
                print("Setting default value for StudyID.")
                ds.StudyID = 'NOID'  # 设置默认值
            
            # 检查并设置PatientID默认值
            if 'PatientID' not in ds or not ds.PatientID:
                print("Setting default value for PatientID.")
                ds.StudyID = 'NOID'  # 设置默认值
                
            self.currentSOPinstanceUID = ds['SOPInstanceUID'].value
            self.instanceNR = ds['InstanceNumber'].value

            ds_dict = ds.to_json_dict(512, bulk_data_element_handler=self.bulk_data_handler)
            meta_dict = ds.file_meta.to_json_dict()
            combined_dict = {**ds_dict, **meta_dict}
            ds_json = json.dumps(combined_dict, indent=4)

            logging.info(f'received SOP instance UID {self.currentSOPinstanceUID}')

            self.reconnect_rabbitmq()  # 确保连接有效
            rabbitmq_channel.basic_publish(exchange='', routing_key=RABBITMQ_QUEUE, body=ds_json)
            return 0x0000
        except Exception as e:
            logging.error(f"Error handling C-STORE request: {e}")
            return 0xC000  # 返回错误状态码

    def run(self):
        self.ae.start_server(("0.0.0.0", 11112), block=True, evt_handlers=self.handlers)

if __name__ == "__main__":
    storager = MyStorage()

    try:
        storager.run()
    except KeyboardInterrupt:
        logging.info("Stopping the DICOM server due to user interruption.")

    except Exception as e:
        logging.error(f"An error occurred: {e}")
    finally:
        if storager.rabbitmq_connection and storager.rabbitmq_connection.is_open:
            storager.rabbitmq_connection.close()
        logging.info("RabbitMQ connection closed.")