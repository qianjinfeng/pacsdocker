
docker compose up --build

# OK
docker compose up -d
python -m pynetdicom storescu 127.0.0.1 11113 ~/Downloads/dicom/s/DICOM/24092403/54470000 -r -v -cx
python -m pynetdicom storescu 127.0.0.1 11113 ~/Downloads/dicom/2/DICOM/I3   -v -cx
curl -u elastic:elastic -X GET  http://localhost:9201/study/_search?pretty -H 'Content-Type: application/json'
curl http://localhost:4004/studies
docker compose down




elasticsearch-plugin install https://release.infinilabs.com/analysis-pinyin/stable/elasticsearch-analysis-pinyin-8.15.3.zip

curl -XGET 'http://localhost:9201/_cluster/health?pretty=true' -u elastic:elastic


curl -s -u "elastic:elastic" -X POST http://localhost:9201/_security/user/kibana_system/_password -d "{\"password\":\"'${KIBANA_LOCAL_PASSWORD}'\"}" -H "Content-Type: application/json"

problem in load image
http://127.0.0.1:8081/ipfs/QmXHrmVKW8NHxDiptGMpDuom9HMvQxP9MS2Y71mCePKK6i