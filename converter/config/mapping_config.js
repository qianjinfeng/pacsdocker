
// 定义索引映射
//number_of_replicas fix no_shard_available_action_exception as only 1 es node
const indexMappings = {
  study_template: {
      index_patterns: [ "study" ],
      settings: {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "analysis": {
            "filter": {
                "pinyin": {
                    "ignore_pinyin_offset": "true",
                    "lowercase": "true",
                    "keep_original": "true",
                    "keep_separate_first_letter": "false",
                    "type": "pinyin",
                    "limit_first_letter_length": "16",
                    "keep_full_pinyin": "true"
                }
            },
            "analyzer": {
            "pinyin_analyzer": {
                "filter": [ "pinyin" ],
                "type": "custom",
                "tokenizer": "standard"
            }
            }
        }
      },
      properties: {
        "StudyID": {
          "type": "text",
          "fields": {
            "keyword": {
                "type": "keyword"
            }
          }
        },
        "PatientSex": {
          "type": "keyword"
        },
        "PatientID": {
          "type": "text",
          "fields": {
            "keyword": {
                "type": "keyword"
            }
          }
        },
        "StudyDescription": {
          "type": "text"
        },
        "StudyInstanceUID": {
          "type": "keyword"
        },
        "StudyDate": {
          "type": "date"
        },
        "Modality": {
          "type": "keyword"
        },
        "AccessionNumber": {
          "type": "text",
          "fields": {
            "keyword": {
                "type": "keyword"
            }
          }
        },
        "title": {
          "type": "text",
          "fields": {
            "suggest": {
              "type": "completion",
              "analyzer": "pinyin_analyzer",
              "preserve_separators": true,
              "preserve_position_increments": true,
              "max_input_length": 50
            }
          },
          "analyzer": "pinyin_analyzer"
        }
      }
    },
    series_template: {
      index_patterns: [ "series" ],
      settings: {
        "number_of_shards": 1,
        "number_of_replicas": 0,
      },
      properties: {
        "StudyInstanceUID": {
          "type": "keyword"
        },
        "BodyPartExamined": {
          "type": "keyword"
        },
        "SeriesInstanceUID": {
          "type": "keyword"
        }
      }
    },
    instance_template: {
      index_patterns: [ "instance" ],
      settings: {
          "number_of_shards": 1,
          "number_of_replicas": 0,
      },
      properties:{}
    },
    siemens_template: {
      index_patterns: [ "siemens" ],
      settings: {
          "number_of_shards": 1,
          "number_of_replicas": 0,
      },
      properties:{}
    },
  };
   
  // 索引名称数组
  const indicesTemplates = ['study_template', 'series_template', 'instance_template', 'siemens_template'];

  export { indexMappings, indicesTemplates };
