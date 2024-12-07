import fp from 'fastify-plugin'
import fastifyElasticsearch from '@fastify/elasticsearch';

export default fp(async (fastify) => {

    fastify.register(fastifyElasticsearch, {
        node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
        auth: {  
          username: process.env.ELASTICSEARCH_USER || 'elastic',  
          password: process.env.ELASTICSEARCH_PASS || 'elastic'  
        },
        healthcheck: false
    });
    
    fastify.decorate('getDataFromElasticsearch', async (index, query, from = 0, size = 10) => {
        try {
            const body = await fastify.elastic.search({
              index,
              body: {
                query,
                from,
                size
              }
            });
            return {
              hits: body.hits.hits.map(hit => hit._source),
              total: body.hits.total.value
            };
          } catch (error) {
            fastify.log.error(error);
            throw new Error('Failed to fetch data from Elasticsearch');
          }
      });


      fastify.decorate('getDataCountFromElasticsearch', async (index, query) => {
        try {
            const body = await fastify.elastic.search({
              index,
              body: {
                track_total_hits: true,
                query
              },
              size: 0 // 不需要实际的文档，只需要总数
            });
            return {
              total: body.hits.total.value
            };
          } catch (error) {
            fastify.log.error(error);
            throw new Error('Failed to fetch data from Elasticsearch');
          }
      });
  })