FROM python:3.10-alpine

WORKDIR /app
# 安装依赖

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 复制生成DICOM文件的Python脚本到容器中
COPY generate_dicom.py .
COPY data ./data

# 运行生成DICOM文件的脚本，并使用pynetdicom上传这些文件
CMD ["sh", "-c", "python3 generate_dicom.py && SCP_IP=$(getent hosts scp | awk '{print $1}') && sleep 5 && python3 -m pynetdicom storescu $SCP_IP 11112 ./data/ -v -r -cx && tail -f /dev/null"]
