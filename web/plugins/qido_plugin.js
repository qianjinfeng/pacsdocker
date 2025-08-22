import fp from 'fastify-plugin'
import dcmjs from 'dcmjs';
const { DicomMetaDictionary } = dcmjs.default.data;

// the use of fastify-plugin is required to be able
// to export the decorators to the outer scope

export default fp(async function (fastify, opts) {

 // needs to support query with following keys
  // StudyDate 00080020
  // StudyTime 00080030
  // AccessionNumber 00080050
  // ModalitiesInStudy 00080061
  // ReferringPhysicianName 00080090
  // PatientName 00100010
  // PatientID 00100020
  // StudyInstanceUID 0020000D
  // StudyID 00200010
  // 00200011
  // 00201208
  // 00201209
  // add accessor methods with decorate
  fastify.decorate('getQIDOStudies', async (request, reply) => {
    try {
      const res = [];
   
      const index = request.query.index || 'study';
      const query = request.query.query || { match_all: {} };
      const from = parseInt(request.query.offset) || 0;
      const size = parseInt(request.query.limit) || 1000;
  
      const rawData = await fastify.getDataFromElasticsearch(index, query, from, size);
      fastify.log.info(`found ${rawData.total} studies`);

      for (let i = 0; i < rawData.hits.length; i++) {
        fastify.log.debug(rawData.hits[i]);
        const study = DicomMetaDictionary.denaturalizeDataset(rawData.hits[i]);
        const query = { match: {"StudyInstanceUID": study["0020000D"].Value[0]}};
        const totalInstances = await fastify.getDataCountFromElasticsearch('instance', query);
        fastify.log.info(`found ${totalInstances.total} instances for the study ${study["0020000D"].Value[0]}`);
        const tag = {};
        tag['vr'] = "IS";
        const value = [];
        value.push(totalInstances.total);
        tag['Value'] = value;
        study["00201208"] = tag;

        res.push(study);
      }
      
      fastify.log.debug(res);
      fastify.log.info(res.length);
      
      // const processedData = processData(rawData);
  
      // // 设置响应头中的分页信息
      // reply.header('X-Total-Count', processedData.total);
      // reply.header('X-Page-Size', size);
      // reply.header('X-Current-Page', Math.floor(from / size) + 1);
      // reply.header('X-Total-Pages', Math.ceil(processedData.total / size));
  
      // 返回处理后的数据
      // reply.send(processedData.data);

      reply.code(200).send(res);
    } catch (error) {
      reply.status(500).send({ error: error.message });
    }

  });

  fastify.decorate('getQIDOSeries', async (request, reply) => {
    try {
      const res = [];
   
      const index = request.query.index || 'series';
      const query = request.query.query || { match: {"StudyInstanceUID": request.params.study} };
      const from = parseInt(request.query.offset) || 0;
      const size = parseInt(request.query.limit) || 1000;
  
      const rawData = await fastify.getDataFromElasticsearch(index, query, from, size);
      fastify.log.info(`found ${rawData.total} series`);

      for (let i = 0; i < rawData.hits.length; i++) {
          fastify.log.debug(rawData.hits[i]);
          const series = DicomMetaDictionary.denaturalizeDataset(rawData.hits[i]);
          const query = { match: {"SeriesInstanceUID": series["0020000E"].Value[0]}};
          const totalInstances = await fastify.getDataCountFromElasticsearch('instance', query);
          fastify.log.info(`found ${totalInstances.total} instances for the series ${series["0020000E"].Value[0]}`);
          const tag = {};
          tag['vr'] = "IS";
          tag['Value'] = [totalInstances.total];
          series["00201209"] = tag;
          res.push(series);
      }

      fastify.log.debug(res);
      fastify.log.info(res.length);
      
      // const processedData = processData(rawData);
  
      // // 设置响应头中的分页信息
      // reply.header('X-Total-Count', processedData.total);
      // reply.header('X-Page-Size', size);
      // reply.header('X-Current-Page', Math.floor(from / size) + 1);
      // reply.header('X-Total-Pages', Math.ceil(processedData.total / size));
  
      // 返回处理后的数据
      // reply.send(processedData.data);

      reply.code(200).send(res);
    } catch (error) {
      reply.status(500).send({ error: error.message });
    }

  });

  fastify.decorate('getQIDOInstances', async (request, reply) => {
    try {
      const res = [];
   
      const index = request.query.index || 'instance';
      const query = request.query.query || { match_all: {} };
      const from = parseInt(request.query.offset) || 0;
      const size = parseInt(request.query.limit) || 1000;                                                                               
  
      const rawData = await fastify.getDataFromElasticsearch(index, query, from, size);
      fastify.log.info(`found ${rawData.total} instances`);
      rawData.hits.forEach((value) => {
        fastify.log.debug(value);
        const instance = DicomMetaDictionary.denaturalizeDataset(value);
        fastify.log.info(`SOPInstanceUID: ${instance["00080018"].Value[0]}`);
        res.push(instance);
      })
      
      fastify.log.info(res.length);
      
      // const processedData = processData(rawData);
  
      // // 设置响应头中的分页信息
      // reply.header('X-Total-Count', processedData.total);
      // reply.header('X-Page-Size', size);
      // reply.header('X-Current-Page', Math.floor(from / size) + 1);
      // reply.header('X-Total-Pages', Math.ceil(processedData.total / size));
  
      // 返回处理后的数据
      // reply.send(processedData.data);

      reply.code(200).send(res);
    } catch (error) {
      reply.status(500).send({ error: error.message });
    }

  });

})
