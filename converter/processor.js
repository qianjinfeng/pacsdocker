import { checkDocumentExists, indexDocument } from './es.js';
import { removeVrMap, isObjectEmpty, removeEmptyTags } from './utils.js';
import study_schema from './config/study_schema.json' with { type: 'json' };
import series_schema from './config/series_schema.json' with { type: 'json' };
import { siemens_tags } from './config/siemens_tags.js';
import { log } from "./lib/log.js";
// import dcmjs from 'dcmjs';
// const { DicomMetaDictionary } = dcmjs.default.data;
import { DicomMetaDictionary } from "./lib/DicomMetaDictionary.js";

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
        // (0008,0005): Specific Character Set
        // (0008,0060): Modality
        // (0008,103E): Series Description
        // (0020,000D): Study Instance UID
        // (0020,000E): Series Instance UID
        // (0020,0011): Series Number
        // (0020,1209): Number of Series Related Instances
        fallbackSeriesField('00080021', '00080020'); // SeriesDate <- StudyDate
        fallbackSeriesField('00080031', '00080030'); // SeriesTime <- StudyTime
        if (!dataset['0008103E'] || !dataset['0008103E'].Value || dataset['0008103E'].Value.length === 0) {
          extracted['0008103E'] = { vr: 'LO', Value: ['No Description'] };
        }
      }
      const naturalizedSet = DicomMetaDictionary.naturalizeDataset(extracted);
      const cleanedNaturalizedSet = removeEmptyTags(naturalizedSet);
      log.debug(JSON.stringify(cleanedNaturalizedSet));
      if (indexName === 'study') {
        cleanedNaturalizedSet['title']=cleanedNaturalizedSet.PatientName[0].Alphabetic;
      }
  
      const exists = await checkDocumentExists(indexName, cleanedNaturalizedSet[idField]);
      if (!exists) {
        // removeVrMap(cleanedNaturalizedSet);
        await indexDocument(indexName, cleanedNaturalizedSet[idField], cleanedNaturalizedSet, timestampField);
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
      const instanceSet = DicomMetaDictionary.naturalizeDataset(dataset);
      const cleanedInstanceSet = removeEmptyTags(instanceSet);
      // removeVrMap(cleanedInstanceSet);
      log.debug(JSON.stringify(cleanedInstanceSet));
  
      if (!isObjectEmpty(extractedSiemens)) {
        const siemensSet = DicomMetaDictionary.naturalizeDataset(extractedSiemens);
        siemensSet.SOPInstanceUID = cleanedInstanceSet.SOPInstanceUID;
        const siexists = await checkDocumentExists('siemens', siemensSet.SOPInstanceUID);
        if (!siexists) {
          const cleanedsiemensSet = removeEmptyTags(siemensSet);
          // removeVrMap(siemensSet);
          await indexDocument('siemens', cleanedsiemensSet.SOPInstanceUID, cleanedsiemensSet);
        }
      }
      
      const exists = await checkDocumentExists('instance', cleanedInstanceSet.SOPInstanceUID);
      if (!exists) {
        await indexDocument('instance', cleanedInstanceSet.SOPInstanceUID, cleanedInstanceSet, 'timestamp_instance');
      }
    } catch (error) {
      log.error('Error processing DICOM message:', error);
      throw error;
    }
  }

