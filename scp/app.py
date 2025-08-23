import os
from pynetdicom import AE, debug_logger, evt, AllStoragePresentationContexts, ALL_TRANSFER_SYNTAXES
from pynetdicom.sop_class import Verification
import pydicom
from pydicom.tag import Tag
from pydicom.encaps import generate_pixel_data_frame
from pika import ConnectionParameters, BlockingConnection, PlainCredentials
from datetime import datetime
import json
import requests
import logging
import time

# 映射环境变量值到 logging 级别
LEVEL_MAP = {
    'DEBUG': logging.DEBUG,
    'INFO': logging.INFO,
    'WARNING': logging.WARNING,
    'ERROR': logging.ERROR,
    'CRITICAL': logging.CRITICAL
}

# 从环境变量中获取日志级别，默认为 INFO
log_level_name = os.getenv('LOG_LEVEL', 'INFO').upper()
log_level = LEVEL_MAP.get(log_level_name, logging.INFO)

# 配置日志
logging.basicConfig(level=log_level, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger()

# 获取环境变量
RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'localhost')
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'guest')
RABBITMQ_PASSWORD = os.getenv('RABBITMQ_PASSWORD', 'guest')
RABBITMQ_PORT = os.getenv('RABBITMQ_PORT', '5673')
RABBITMQ_QUEUE = os.getenv('RABBITMQ_QUEUE', 'dicom_queue')
IPFS_HOST = os.getenv('IPFS_HOST', '127.0.0.1')
IPFS_PORT = os.getenv('IPFS_PORT', '5001')
AE_TITLE = os.getenv('AE_TITLE', 'MY_STORE_SCU')

# 设置RabbitMQ连接
credentials = PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
parameters = ConnectionParameters(heartbeat=0, host=RABBITMQ_HOST, port=RABBITMQ_PORT, credentials=credentials)
rabbitmq_connection = BlockingConnection(parameters)
rabbitmq_channel = rabbitmq_connection.channel()
rabbitmq_channel.queue_declare(queue=RABBITMQ_QUEUE, auto_delete=True)

# debug_logger()

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
                parameters = ConnectionParameters(heartbeat=0, host=RABBITMQ_HOST, port=RABBITMQ_PORT, credentials=credentials)
                self.rabbitmq_connection = BlockingConnection(parameters)
                self.rabbitmq_channel = self.rabbitmq_connection.channel()
                self.rabbitmq_channel.queue_declare(queue=RABBITMQ_QUEUE, auto_delete=True)
                logger.info("Connected to RabbitMQ.")
            except Exception as e:
                logging.error(f"Failed to connect to RabbitMQ: {e}. Retrying...")
                time.sleep(5)

    def handle_echo(self, event):
        logger.info("Received C-ECHO request")
        return 0x0000  # 返回状态码，0x0000表示成功

    def bulk_data_handler(self, data_element):
        if data_element.VR in ['OB', 'OD', 'OF', 'OL', 'OV', 'OW']:
            file_name = f'{data_element.tag:08x}'  # 将tag转换为十六进制字符串
            logger.info(f'tag is: {file_name}')
            if data_element.tag == pydicom.tag.Tag(0x7fe0, 0x0010):
                frames = []
                if self.transfer_syntax_uid in [pydicom.uid.ExplicitVRLittleEndian, pydicom.uid.ImplicitVRLittleEndian]:
                    logger.info("Transfer Syntax simple")
                    # 处理未压缩的像素数据
                    if self.number_of_frames > 1:
                        # 计算每帧大小并分割数据
                        rows = self.current_ds.Rows
                        columns = self.current_ds.Columns
                        samples_per_pixel = self.current_ds.SamplesPerPixel
                        bits_allocated = self.current_ds.BitsAllocated
                        bytes_per_pixel = ((bits_allocated + 7) // 8) * samples_per_pixel
                        frame_size = rows * columns * bytes_per_pixel
                        
                        frames = [data_element.value[i:i+frame_size] for i in range(0, len(data_element.value), frame_size)]
                    else:
                        frames = [data_element.value]
                else:
                    logger.info("Transfer Syntax compressed")
                    # 处理压缩的像素数据
                    from pydicom.encaps import generate_pixel_data_frame
                    frames = list(generate_pixel_data_frame(data_element.value))

                # multiframe
                if len(frames) > 1:
                    logger.info(f"Multiple frames: {len(frames)}")
                    files = []
                    for i, chunk in enumerate(frames):
                        file_name = f'{data_element.tag:08x}/frames/{i+1}'
                        files.append(('path', (file_name, chunk)))

                    params = {'recursive': True}
                    try:
                        response = requests.post(self.api_url, files=files)
                        response.raise_for_status()
                    except Exception as e:
                        logger.error(f"Failed to store DICOM pixel to API: {e}")
                        return None
                    
                    if response.status_code == 200:
                        cid_info = {}
                        responses = response.text.split('\n')[:-1]  # 分割成单独的JSON对象
                        for resp in responses:
                            item = json.loads(resp)
                            logger.debug(f"item: {item}")
                            cid_info[item.get('Name')] = item.get('Hash')

                        # 获取顶层目录的CID
                        top_dir_cid = cid_info.get(f'{data_element.tag:08x}')
                        if top_dir_cid is not None:
                            logger.info(f"Multi Frames Image added to IPFS: {top_dir_cid}")
                            return top_dir_cid
                        else:
                            logger.warning("Top directory CID not found.")
                            return None
                    else:
                        logger.warning(f'Error adding BulkData to API: {response.status_code} - {response.text}')
                        return None
                # only 1 image
                else:
                    logger.info("Single frames")
                    files = {'file': (file_name, frames[0])}
                    try:
                        # 发送POST请求
                        response = requests.post(self.api_url, files=files)
                        response.raise_for_status()  # 抛出HTTP错误
                    except Exception as e:
                        logger.error(f"Failed to store DICOM other than pixel to IPFS: {e}")

                    # 检查响应状态码
                    if response.status_code == 200:
                        result = response.json()
                        logger.info(f'Single Frame Image added to IPFS: {result["Hash"]}')
                        return result['Hash']
                    else:
                        logger.warning(f'Error adding BulkData to IPFS: {response.status_code} - {response.text}')

            # 如果不是PixelData，则直接上传
            else:
                logger.info("upload other binary data than none pixel data")
                files = {'file': (file_name, data_element.value)}
                try:
                    # 发送POST请求
                    response = requests.post(self.api_url, files=files)
                    response.raise_for_status()  # 抛出HTTP错误
                except Exception as e:
                    logger.error(f"Failed to store DICOM other than pixel to IPFS: {e}")

                # 检查响应状态码
                if response.status_code == 200:
                    result = response.json()
                    logger.info(f'BulkData added to IPFS: {result["Hash"]}')
                    return result['Hash']
                else:
                    logger.warning(f'Error adding BulkData to IPFS: {response.status_code} - {response.text}')

        else:
            logger.warning(f"Unsupported VR: {data_element.VR}")
            return data_element.value

    def ensure_required_dicom_fields(self, ds):
        """
        确保 DICOM 数据集中包含必要的字段，若缺失则设置默认值。
        (0008,0020): Study Date
        (0008,0030): Study Time
        (0010,0010): Patient's Name
        (0010,0020): Patient ID
        (0010,0030): Patient's Birth Date
        (0010,0040): Patient's Sex
        (0020,000D): Study Instance UID
        (0020,0010): Study ID
        
        参数:
            ds (pydicom.Dataset): 要检查并补充的 DICOM 数据集对象
        
        返回:
            pydicom.Dataset: 补充后的数据集
        """
        # 检查并设置 PatientName
        if 'PatientName' not in ds or not ds.PatientName:
            logger.warning("PatientName is missing or empty. Setting default value to 'UNKNOWN'.")
            ds.PatientName = 'UNKNOWN'  # 默认值为 'UNKOWN' 

        # 检查并设置 PatientSex
        if 'PatientSex' not in ds or not ds.PatientSex:
            logger.warning("PatientSex is missing or empty. Setting default value to 'O'.")
            ds.PatientSex = 'O'  # 默认值为 'O' (Other)

        # 检查并设置 StudyID
        if 'StudyID' not in ds or not ds.StudyID:
            logger.warning("StudyID is missing or empty. Setting default value to 'NOID'.")
            ds.StudyID = 'NOID'

        # 检查并设置 PatientID
        if 'PatientID' not in ds or not ds.PatientID:
            logger.warning("PatientID is missing or empty. Setting default value to 'NOID'.")
            ds.PatientID = 'NOID'  

        # 获取当前日期和时间（DICOM 格式）
        now = datetime.now()
        current_date = now.strftime('%Y%m%d')     # YYYYMMDD
        current_time = now.strftime('%H%M%S')     # HHMMSS

        # 检查并设置 StudyDate
        if 'StudyDate' not in ds or not ds.StudyDate:
            logger.warning("StudyDate is missing or empty. Setting current date.")
            ds.StudyDate = current_date

        # 检查并设置 StudyTime
        if 'StudyTime' not in ds or not ds.StudyTime:
            logger.warning("StudyTime is missing or empty. Setting current time.")
            ds.StudyTime = current_time

        return ds
        
    def handle_store(self, event):
        """Handle EVT_C_STORE events."""
        try:
            ds = event.dataset
            ds.file_meta = event.file_meta

            # 调用函数确保必要字段存在
            ds = self.ensure_required_dicom_fields(ds)
                
            self.currentSOPinstanceUID = ds['SOPInstanceUID'].value
            self.instanceNR = ds['InstanceNumber'].value
            self.transfer_syntax_uid = ds.file_meta.TransferSyntaxUID
            self.number_of_frames = int(getattr(ds, 'NumberOfFrames', 1))  # 获取帧数，默认为1

            ds_dict = ds.to_json_dict(512, bulk_data_element_handler=self.bulk_data_handler)
            meta_dict = ds.file_meta.to_json_dict()
            combined_dict = {**ds_dict, **meta_dict}
            ds_json = json.dumps(combined_dict, indent=4)

            logger.info(f'received SOP instance UID {self.currentSOPinstanceUID}')
            logger.debug(f'received instance content {ds_json}')

            self.reconnect_rabbitmq()  # 确保连接有效
            rabbitmq_channel.basic_publish(exchange='', routing_key=RABBITMQ_QUEUE, body=ds_json)
            return 0x0000
        except Exception as e:
            logger.error(f"Error handling C-STORE request: {e}")
            return 0xC000  # 返回错误状态码

    def run(self):
        self.ae.start_server(("0.0.0.0", 11112), block=True, evt_handlers=self.handlers)

if __name__ == "__main__":
    storager = MyStorage()

    try:
        storager.run()
    except KeyboardInterrupt:
        logger.info("Stopping the DICOM server due to user interruption.")

    except Exception as e:
        logger.error(f"An error occurred: {e}")
    finally:
        if storager.rabbitmq_connection and storager.rabbitmq_connection.is_open:
            storager.rabbitmq_connection.close()
        logger.info("RabbitMQ connection closed.")