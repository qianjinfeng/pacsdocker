import path from 'path'
import AutoLoad from '@fastify/autoload'
import { fileURLToPath } from 'url'
import studiesSchema from './schemas/studies_output_schema.json' assert { type: 'json' }
import seriesSchema from './schemas/series_output_schema.json' assert { type: 'json' }
import instancesSchema from './schemas/instances_output_schema.json' assert { type: 'json' }
import cors from '@fastify/cors';

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Pass --options via CLI arguments in command to enable these options.
export const options = {}

export default async function (fastify, opts) {
  // Place here your custom code!
  
    // add schemas to fastify to use by id
    // fastify.addSchema(patientsSchema);
    fastify.addSchema(studiesSchema);
    fastify.addSchema(seriesSchema);
    fastify.addSchema(instancesSchema);

  fastify.register(cors, {
    origin: true // 允许所有域
  });

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: Object.assign({}, opts)
  })

  // This loads all plugins defined in routes
  // define your routes in one of these
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: Object.assign({}, opts)
  })
}
