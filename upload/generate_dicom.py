import pydicom
from pydicom.dataset import Dataset, FileDataset
import datetime
import os
import numpy as np
from faker import Faker
import logging

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

# 初始化Faker实例用于生成随机中文名字
fake = Faker('zh_CN')

def generate_anatomical_image(shape=(128, 128)):
    image = np.zeros(shape, dtype='int16')

    # 空气区域（背景）
    air = -1000
    image[:] = air

    # 中心区域模拟软组织
    center = np.s_[(shape[0]//4):-(shape[0]//4), (shape[1]//4):-(shape[1]//4)]
    muscle = np.random.randint(40, 80, size=(shape[0]//2, shape[1]//2), dtype='int16')
    image[center] = muscle

    # 添加一个高密度区域模拟骨骼
    bone_zone = np.s_[(shape[0]//2)-10:(shape[0]//2)+10, (shape[1]//2)-10:(shape[1]//2)+10]
    image[bone_zone] = np.random.randint(1000, 1500, size=(20, 20), dtype='int16')

    return image


def generate_dicom_files(output_dir, num_files=100):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    for i in range(num_files):
        # 创建基础信息
        file_meta = Dataset()
        file_meta.MediaStorageSOPClassUID = '1.2.840.10008.5.1.4.1.1.2'  # CT Image Storage
        file_meta.MediaStorageSOPInstanceUID = pydicom.uid.generate_uid()
        file_meta.ImplementationClassUID = '1.3.6.1.4.1.9590.100.1.0.100.4.0'
        file_meta.TransferSyntaxUID = pydicom.uid.ImplicitVRLittleEndian

        dt = fake.date_time()
        date_str = dt.strftime('%Y%m%d')
        time_str = dt.strftime('%H%M%S.%f')

        filename = os.path.join(output_dir, f'dicom_{i+1:04d}.dcm')
        ds = FileDataset(filename, {}, file_meta=file_meta, preamble=b"\0" * 128)

        # 添加必要的标签
        ds.SpecificCharacterSet = 'ISO_IR 192'  # 支持中文字符集GB18030
        ds.InstanceCreationDate = date_str
        ds.InstanceCreationTime = time_str
        ds.SOPClassUID = file_meta.MediaStorageSOPClassUID
        ds.SOPInstanceUID = file_meta.MediaStorageSOPInstanceUID
        ds.StudyDate = date_str
        ds.StudyTime = time_str
        ds.SeriesDate = date_str
        ds.SeriesTime = time_str
        ds.AcquisitionDate = date_str
        ds.ContentDate = date_str
        ds.AcquisitionTime = time_str
        # 预定义字符串列表
        string_options = ['苹果', '香蕉', '橙子', '葡萄', '草莓']
        ds.SeriesDescription = fake.random_element(elements=string_options)
        ds.Modality = 'CT'
        ds.Manufacturer = 'Manufacturer'
        ds.ReferringPhysicianName = 'ReferringPhysician'

        # 随机生成病人名（中文）
        patient_name = fake.name()
        ds.PatientName = patient_name

        # 添加随机生成的Access ID
        access_id = fake.uuid4()[:10]
        ds.AccessionNumber = access_id

        ds.PatientID = f'ID{i+1:06d}'
        bd = fake.date_time()
        ds.PatientBirthDate = bd.strftime('%Y%m%d')
        ds.PatientSex = fake.random_element(elements=('M', 'F'))
        ds.StudyInstanceUID = pydicom.uid.generate_uid()
        ds.SeriesInstanceUID = pydicom.uid.generate_uid()
        ds.StudyID = 'StudyID'
        ds.SeriesNumber = '1'
        ds.InstanceNumber = str(i + 1)
        ds.AcquisitionNumber = str(i+1)

        # 创建一些随机数据作为图像数据
        # 图像相关信息
        shape = (128, 128)
        image = generate_anatomical_image((128, 128))

        ds.Rows = shape[0]
        ds.Columns = shape[1]
        ds.SamplesPerPixel = 1
        ds.PhotometricInterpretation = "MONOCHROME2"
        ds.PixelSpacing = [1.0, 1.0]
        ds.ImagePositionPatient = [0.0, 0.0, 0]
        ds.SliceLocation = float(i)
        ds.BitsAllocated = 16
        ds.BitsStored = 16
        ds.HighBit = 15
        ds.PixelRepresentation = 1

        ds.PixelData = image.tobytes()

        # 添加窗宽窗位等显示参数
        ds.WindowCenter = 40
        ds.WindowWidth = 400
        ds.RescaleIntercept = 0
        ds.RescaleSlope = 1

        # 保存到文件
        ds.save_as(filename)
        logger.info(f'DICOM file {filename} created with Patient Name: {patient_name} and Accession Number: {access_id}.')

if __name__ == '__main__':
    output_directory = './data'
    
    # 从环境变量中获取文件数量，默认为 200
    number_of_files = int(os.getenv('NUMBER_OF_FILES', '200'))

    logger.info(f'Start to generate {number_of_files} dicoms')
    generate_dicom_files(output_directory, number_of_files)
