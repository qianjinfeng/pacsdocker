import pydicom
from pydicom.dataset import Dataset, FileDataset
import datetime
import os
import numpy as np
from faker import Faker

# 初始化Faker实例用于生成随机中文名字
fake = Faker('zh_CN')

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

        dt = datetime.datetime.now()
        date_str = dt.strftime('%Y%m%d')
        time_str = dt.strftime('%H%M%S.%f')

        filename = os.path.join(output_dir, f'dicom_{i+1:04d}.dcm')
        ds = FileDataset(filename, {}, file_meta=file_meta, preamble=b"\0" * 128)

        # 添加必要的标签
        ds.SpecificCharacterSet = 'GB18030'  # 支持中文字符集
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
        access_id = fake.uuid4()[:16]
        ds.AccessionNumber = access_id

        ds.PatientID = f'ID{i+1:06d}'
        ds.PatientBirthDate = '19900101'
        ds.PatientSex = 'M'
        ds.StudyInstanceUID = pydicom.uid.generate_uid()
        ds.SeriesInstanceUID = pydicom.uid.generate_uid()
        ds.StudyID = 'StudyID'
        ds.SeriesNumber = '1'
        ds.InstanceNumber = str(i + 1)
        ds.AcquisitionNumber = str(i+1)

        # 创建一些随机数据作为图像数据
        shape = (128, 128)  # 定义图像大小
        image = np.random.randint(0, 256, size=shape, dtype='uint16')  # 随机生成像素值

        # 设置像素表示和存储格式
        ds.BitsAllocated = 16
        ds.BitsStored = 16
        ds.HighBit = 15
        ds.PixelRepresentation = 0
        ds.PixelData = image.tobytes()

        # 保存到文件
        ds.save_as(filename)
        print(f'DICOM file {filename} created with Patient Name: {patient_name} and Accession Number: {access_id}.')

if __name__ == '__main__':
    output_directory = './data'
    number_of_files = 5  # 根据需要调整这个数字
    generate_dicom_files(output_directory, number_of_files)
