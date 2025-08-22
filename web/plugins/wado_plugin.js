import fp from 'fastify-plugin'
import dcmjs from 'dcmjs';
const { DicomMetaDictionary } = dcmjs.default.data;

// the use of fastify-plugin is required to be able
// to export the decorators to the outer scope

export default fp(async function (fastify, opts) {

    // fastify.decorate('retrieveInstance', async (request, reply) => {
    //     try {
    //       // if the query params have frame use retrieveInstanceFrames instead
    //       if (request.query.frame) fastify.retrieveInstanceFrames(request, reply);
    //       else {
    //         const dicomDB = fastify.couch.db.use(config.db);
    //         const instance = request.query.objectUID;
    //         reply.header('Content-Disposition', `attachment; filename=${instance}.dcm`);
    //         const stream = await fastify.getDicomFileAsStream(instance, dicomDB);
    //         reply.code(200).send(stream);
    //       }
    //     } catch (err) {
    //       reply.send(
    //         new ResourceNotFoundError(
    //           'Instance',
    //           request.params.instance || request.query.objectUID,
    //           err
    //         )
    //       );
    //     }
    //   });

      // fastify.decorate('retrieveInstanceRS', async (request, reply) => {
      //   try {
      //     const res = [];
   
      //     const index = request.query.index || 'instance';
      //     const query = request.query.query || {
      //       bool: {
      //         must: [
      //           { term: { StudyInstanceUID: request.params.study } }, 
      //           { term: { SeriesInstanceUID: request.params.series } },
      //           { term: { SOPInstanceUID: request.params.instance } }
      //         ]
      //       }
      //     };
      //     const from = parseInt(request.query.from) || 0;
      //     const size = parseInt(request.query.size) || 100;
      
      //     const rawData = await fastify.getDataFromElasticsearch(index, query, from, size);
      //     fastify.log.info(`found ${rawData.total} instance`);
      //     for (let i = 0; i < rawData.hits.length; i++) {
      //       const instance = DicomMetaDictionary.denaturalizeDataset(rawData.hits[i]);
      //       const pixelData = new Uint8Array(512);
      //       const dataset = {
      //         ...instance,
      //         "7fe00010": {
      //           vr: 'OW',
      //           Value: [pixelData]  // ⬅️ 直接嵌入像素数据（推荐方式）
      //         }
      //       };

      //       // 删除 File Meta Information 中不需要手动设置的字段（可由 dcmjs 自动生成）
      //       delete dataset["00020000"]; // 让库自动计算
      //       // 创建 DICOM 消息
      //       const dicomMessage = DicomMessage.fromDataset(dataset);
      //     }

      //   } catch (err) {
      //     reply.send(
      //       new ResourceNotFoundError(
      //         'Instance',
      //         request.params.instance || request.query.objectUID,
      //         err
      //       )
      //     );
      //   }
      // });
    
    //   fastify.decorate('retrieveInstanceFrames', async (request, reply) => {
    //     // wado-rs frame retrieve
    //     //
    //     // http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_8.6.html#sect_8.6.1.2
    //     //
    //     // - Accepts frames as a comma separated list of frame numbers (starting at 1):
    //     //   -- most likely/common use case will be a single number 1.  This is what OHIF requests.
    //     //   -- this means just skipping past the dicom header and returning just the PixelData.
    //     // - in general, need to skip to the correct frame location for each requested frame
    //     //   -- need to figure offsets out from the instance metadata.
    //     //   For attachments it makes a head call for attachment size and gets the document for the necessary header values, calculates the ofset and makes a range query
    //     //        Couchdb attachments can be accessed via ranges:
    //     //          http://docs.couchdb.org/en/stable/api/document/attachments.html#api-doc-attachment-range
    //     //        Not clear how to do this via nano. resolved with http range query for attachments for now
    //     //        Issue filed here: https://github.com/apache/couchdb-nano/issues/166
    //     //  For linked files it makes a stats call for the size, calculates the offset and makes a range read from the stream
    //     // - Adds multipart header and content separators
    //     try {
    //       const dicomDB = fastify.couch.db.use(config.db);
    //       const instance = request.params.instance || request.query.objectUID;
    //       const framesParam = request.params.frames || request.query.frame;
    //       let doc = instance;
    //       if (typeof instance === 'string') doc = await dicomDB.get(instance);
    //       // get tags of the instance
    //       const numOfFrames = doc.dataset['00280008'] ? doc.dataset['00280008'].Value[0] : 1;
    //       const numOfBits = doc.dataset['00280100'].Value[0];
    //       const rows = doc.dataset['00280010'].Value[0];
    //       const cols = doc.dataset['00280011'].Value[0];
    //       const samplesForPixel = doc.dataset['00280002'].Value[0];
    //       const frameSize = Math.ceil((rows * cols * numOfBits * samplesForPixel) / 8);
    //       let framePromises = [];
    //       const frames = [];
    //       if (doc.filePath)
    //         framePromises = await fastify.retrieveInstanceFramesFromLink(doc, framesParam, {
    //           numOfFrames,
    //           numOfBits,
    //           rows,
    //           cols,
    //           samplesForPixel,
    //           frameSize,
    //         });
    //       else
    //         framePromises = await fastify.retrieveInstanceFramesFromAttachment(doc, framesParam, {
    //           numOfFrames,
    //           numOfBits,
    //           rows,
    //           cols,
    //           samplesForPixel,
    //           frameSize,
    //         });
    //       // pack the frames in a multipart and send
    //       const frameResponses = await Promise.all(framePromises);
    //       frameResponses.forEach(response => frames.push(response));
    
    //       const { data, boundary } = dcmjs.utilities.message.multipartEncode(
    //         frames,
    //         undefined,
    //         'application/octet-stream'
    //       );
    //       try {
    //         reply.headers({
    //           'Content-Type': `multipart/related; application/octet-stream; boundary=${boundary}`,
    //           maxContentLength: Buffer.byteLength(data) + 1,
    //         });
    //         reply.code(200).send(Buffer.from(data));
    //       } catch (replyErr) {
    //         reply.send(new InternalError('Packing frames', replyErr));
    //       }
    //     } catch (err) {
    //       reply.send(
    //         new ResourceNotFoundError('Frame', request.params.frames || request.query.frame, err)
    //       );
    //     }
    //   });

      fastify.decorate('getStudyMetadata', async (request, reply) => {
        try {
          const res = [];
   
          const index = request.query.index || 'instance';
          const query = request.query.query || { 
            term: {
              StudyInstanceUID: request.params.study
            } 
          };
          const from = parseInt(request.query.from) || 0;
          const size = parseInt(request.query.size) || 1000;
      
          const rawData = await fastify.getDataFromElasticsearch(index, query, from, size);
          fastify.log.info(`found ${rawData.total} metadata`);
          for (let i = 0; i < rawData.hits.length; i++) {
            const study = DicomMetaDictionary.denaturalizeDataset(rawData.hits[i]);
            res.push(study);
          }
          reply.code(200).send(res);
        } catch (err) {
          reply.send(new InternalError('Retrieve study metadata', err));
        }
      });

      fastify.decorate('getSeriesMetadata', async (request, reply) => {
        try {
          const res = [];
   
          const index = request.query.index || 'instance';
          const query = request.query.query || {
            bool: {
              must: [
                { term: { StudyInstanceUID: request.params.study } }, 
                { term: { SeriesInstanceUID: request.params.series } }  
              ]
            }
          };
          const from = parseInt(request.query.from) || 0;
          const size = parseInt(request.query.size) || 1000;
      
          const rawData = await fastify.getDataFromElasticsearch(index, query, from, size);
          fastify.log.info(`found ${rawData.total} metadata`);

          for (let i = 0; i < rawData.hits.length; i++) {
            const series = DicomMetaDictionary.denaturalizeDataset(rawData.hits[i]);
            res.push(series);
          }

          reply.code(200).send(res);
        } catch (err) {
          reply.send(new InternalError('Retrieve series metadata', err));
        }
      });

      fastify.decorate('getInstanceMetadata', async (request, reply) => {
        try {
          const res = [];
   
          const index = request.query.index || 'instance';
          const query = request.query.query || {
            bool: {
              must: [
                { term: { StudyInstanceUID: request.params.study } }, 
                { term: { SeriesInstanceUID: request.params.series } },
                { term: { SOPInstanceUID: request.params.instance } }
              ]
            }
          };
          const from = parseInt(request.query.from) || 0;
          const size = parseInt(request.query.size) || 1000;
      
          const rawData = await fastify.getDataFromElasticsearch(index, query, from, size);
          fastify.log.info(`found ${rawData.total} metadata`);
          rawData.hits.forEach((value) => {
            const study = DicomMetaDictionary.denaturalizeDataset(value);
            res.push(study);
          })

          reply.code(200).send(res);

        } catch (err) {
          reply.send(new InternalError('Retrieve instance metadata from couchdb', err));
        }
      });

      // fastify.decorate('getWado', (request, reply) => {
      //   try {
      //     // get the datasets
      //     const dicomDB = fastify.couch.db.use(config.db);
      //     let isFiltered = false;
      //     const startKey = [];
      //     const endKey = [];
      //     if (request.params.study) {
      //       startKey.push(request.params.study);
      //       endKey.push(request.params.study);
      //       isFiltered = true;
      //     }
      //     if (request.params.series) {
      //       startKey.push(request.params.series);
      //       endKey.push(request.params.series);
      //       isFiltered = true;
      //     }
      //     for (let i = endKey.length; i < 3; i += 1) endKey.push({});
      //     let filterOptions = {};
      //     if (isFiltered) {
      //       filterOptions = {
      //         startkey: startKey,
      //         endkey: endKey,
      //         reduce: false,
      //         include_docs: true,
      //       };
      //       dicomDB.view('instances', 'qido_instances', filterOptions, async (error, body) => {
      //         if (!error) {
      //           try {
      //             const datasetsReqs = [];
      //             body.rows.forEach(instance => {
      //               datasetsReqs.push(fastify.getDicomBuffer(instance.doc, dicomDB));
      //             });
      //             const datasets = await Promise.all(datasetsReqs);
      //             const { data, boundary } = await fastify.packMultipartDicomsInternal(datasets);
      //             // send response
      //             reply.header(
      //               'Content-Type',
      //               `multipart/related; type=application/dicom; boundary=${boundary}`
      //             );
      //             reply.header('content-length', Buffer.byteLength(data));
      //             reply.send(Buffer.from(data));
      //           } catch (err) {
      //             reply.send(
      //               new InternalError(`getWado with params ${JSON.stringify(request.params)}`, err)
      //             );
      //           }
      //         } else {
      //           reply.send(new InternalError('Retrieve series metadata from couchdb', error));
      //         }
      //       });
      //     } else {
      //       reply.send(
      //         new BadRequestError('Not supported', new Error('Wado retrieve with no parameters'))
      //       );
      //     }
      //   } catch (e) {
      //     // TODO Proper error reporting implementation required
      //     // per http://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_6.6.html#table_6.6.1-1
      //     reply.send(new InternalError(`getWado with params ${JSON.stringify(request.params)}`, e));
      //   }
      // });
})