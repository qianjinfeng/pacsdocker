# compile docker
docker compose up --build 
docker compose down

# test scp
docker compose up -d  scp
docker logs -f (scp container)
upload a file:
python -m pynetdicom storescu 127.0.0.1 11113 xx.dcm -v -cx 
python -m pynetdicom storescu 127.0.0.1 11113 ~/Downloads/dicom/2/DICOM/I3   -v -cx
upload a directory:
python -m pynetdicom storescu 127.0.0.1 11113 ~/Downloads/dicom/s/DICOM/24092403/54470000 -r -v -cx


# test upload
docker compose up upload
upload generated dicom images via storescu scp 11112 

# OK
test via elastic
curl -XGET 'http://localhost:9201/_cluster/health?pretty=true' -u elastic:elastic
curl -u elastic:elastic -X GET  http://localhost:9201/study/_search?pretty -H 'Content-Type: application/json'
test via web
curl http://localhost:4004/studies


# Viewer
## code
sync master to OHIF Viwers
checkout usingipfs branch
git merge master
yarn config set workspaces-experimental true
yarn install
yarn run dev 

## Port changes

Viewers/extensions/default/src/DicomIPFSDataSource/getImageId.js
let imageId = 'ipfs:http://127.0.0.1:8081/ipfs/'

Viewers/platform/app/public/config/default.js
        name: 'ipfs',
        wadoUriRoot: 'http://localhost:4004',
        qidoRoot: 'http://127.0.0.1:4004',
        wadoRoot: 'http://localhost:4004',

Viewers/platform/app/src/routes/Search/Searching.tsx
const connector = new ElasticsearchAPIConnector({
  host: "http://localhost:9201",
  index: "study",
  apiKey: "ZWxhc3RpYzplbGFzdGlj"
});

## API key 
echo -n 'elastic:your_password' | base64

/_security/api_key 是 Elasticsearch 商业功能（Security/X-Pack）的一部分
curl -X POST "http://localhost:9201/_security/api_key" \
  -H "Content-Type: application/json" \
  -u elastic \
  -d '{
    "name": "my_api_key_for_frontend",
    "role_descriptors": {
      "my_role": {
        "cluster": ["monitor"],
        "index": [
          {
            "names": ["study"],
            "privileges": ["read"]
          }
        ]
      }
    }
}'

elasticsearch-plugin install https://release.infinilabs.com/analysis-pinyin/stable/elasticsearch-analysis-pinyin-8.15.3.zip

curl -s -u "elastic:elastic" -X POST http://localhost:9201/_security/user/kibana_system/_password -d "{\"password\":\"'${KIBANA_LOCAL_PASSWORD}'\"}" -H "Content-Type: application/json"

problem in load image
http://127.0.0.1:8081/ipfs/QmXHrmVKW8NHxDiptGMpDuom9HMvQxP9MS2Y71mCePKK6i


# troubleshooting
ipfs failed to boot 
chmod a+x ./config/ipfs/001.sh
chmod a+r ./config/ipfs/001.sh

es failed to boot
chown -R 1000:1000 ./volumes/elasticsearch-data
or created by docker 
 volumes:
   edata:

es no_shard_available_action_exception
 GET _cluster/health?pretty
 GET _cat/shards?v
 GET /_cat/indices?v
 HEAD /study/_doc/<id>

 no replicates, 
       settings: {
        "number_of_replicas": 0,
      },
wait for es green
  http://elasticsearch:${ES_LOCAL_PORT}/_cluster/health?pretty | grep '\"status\" : \"green\"'