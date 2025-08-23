
import pydicom
from pydicom.dataset import Dataset

def remove_empty_tags(ds):
    tags_to_delete = []
    for elem in ds:
        v = elem.value
        if v is None or \
           (isinstance(v, str) and not v.strip()) or \
           (isinstance(v, bytes) and not v.strip()) or \
           (isinstance(v, list) and len(v) == 0):
            tags_to_delete.append(elem.tag)
    for tag in tags_to_delete:
        del ds[tag]

# 使用
ds = pydicom.dcmread("/home/qian/pacsdocker/data/I2")
remove_empty_tags(ds)
ds.save_as("clean.dcm")