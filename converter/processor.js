import { checkDocumentExists, indexDocument } from './es.js';
import { removeVrMap, isObjectEmpty } from './utils.js';
import study_schema from './config/study_schema.json' assert { type: 'json' };
import series_schema from './config/series_schema.json' assert { type: 'json' };
import { siemens_tags } from './config/siemens_tags.js';
import { log } from "./lib/log.js";
import { DicomMetaDictionary } from "./lib/DicomMetaDictionary.js";

const { naturalizeDataset } = DicomMetaDictionary;

export async function processDicomMessage(dataset) {
    const processEntity = async (schema, indexName, idField, timestampField) => {
      const extracted = {};
      for (let key in schema.items.properties) {
        if (dataset.hasOwnProperty(key)) {
          extracted[key] = dataset[key];
        } else {
          const propertySchema = schema.items.properties[key];
          if (propertySchema.type === 'object') {
            extracted[key] = {};
            for (let subKey in propertySchema.properties) {
              if (subKey === 'vr') {
                extracted[key][subKey] = propertySchema.properties[subKey].const;
              } else if (subKey === 'Value') {
                extracted[key][subKey] = [];
              }
            }
          }
        }
      }

      // 工具函数：用于字段回退
      function fallbackSeriesField(targetTag, sourceTag) {
        log.info(`fill ${targetTag} with ${sourceTag}`);
        if (!dataset[targetTag] && dataset[sourceTag]) {
          extracted[targetTag] = { ...extracted[sourceTag] };
        }
      }
      if (indexName === 'series') {
        // 回退逻辑
        fallbackSeriesField('00080021', '00080020'); // SeriesDate <- StudyDate
        fallbackSeriesField('00080031', '00080030'); // SeriesTime <- StudyTime
      }
      const naturalizedSet = naturalizeDataset(extracted);
      log.debug(JSON.stringify(naturalizedSet));
      if (indexName === 'study') {
        naturalizedSet['title']=naturalizedSet.PatientName[0].Alphabetic;
      }
  
      const exists = await checkDocumentExists(indexName, naturalizedSet[idField]);
      if (!exists) {
        removeVrMap(naturalizedSet);
        await indexDocument(indexName, naturalizedSet[idField], naturalizedSet, timestampField);
      }
    };

  
    try {
      await processEntity(study_schema, 'study', 'StudyInstanceUID', 'timestamp_study');
      await processEntity(series_schema, 'series', 'SeriesInstanceUID', 'timestamp_series');
  
      const extractedSiemens = {};
      siemens_tags.forEach(prefix => {
        for (let key in dataset) {
          if (key.startsWith(prefix)) {
            extractedSiemens[key] = dataset[key];
            delete dataset[key];
          }
        }
      });
  
      function fallbackInstanceField(targetTag, sourceTag) {
        log.info(`fill ${targetTag} with ${sourceTag}`);
        if (!dataset[targetTag] && dataset[sourceTag]) {
          dataset[targetTag] = { ...dataset[sourceTag] };
        }
      }
      fallbackInstanceField('00080022', '00080020'); // AcquisitionDate <- StudyDate
      fallbackInstanceField('00080032', '00080030'); // AcquisitionTime <- StudyTime
      const instanceSet = naturalizeDataset(dataset);
      removeVrMap(instanceSet);
      log.debug(JSON.stringify(instanceSet));
  
      if (!isObjectEmpty(extractedSiemens)) {
        const siemensSet = naturalizeDataset(extractedSiemens);
        siemensSet.SOPInstanceUID = instanceSet.SOPInstanceUID;
        const siexists = await checkDocumentExists('siemens', siemensSet.SOPInstanceUID);
        if (!siexists) {
          removeVrMap(siemensSet);
          await indexDocument('siemens', siemensSet.SOPInstanceUID, siemensSet);
        }
      }
      
      const exists = await checkDocumentExists('instance', instanceSet.SOPInstanceUID);
      if (!exists) {
        await indexDocument('instance', instanceSet.SOPInstanceUID, instanceSet, 'timestamp_instance');
      }
    } catch (error) {
      log.error('Error processing DICOM message:', error);
      throw error;
    }
  }

