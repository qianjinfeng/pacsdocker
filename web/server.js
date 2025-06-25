import fastify from 'fastify';
import app from './app.js';

// 从环境变量中读取配置，默认值 fallback
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || 'localhost';
const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();

// 创建 Fastify 实例并设置日志级别
const server = fastify({
  logger: {
    level: LOG_LEVEL,
    // 可选美化输出（开发时使用）
    // transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined
  },
});

// 注册主模块（插件和路由）
await server.register(app);

// 启动服务器
const start = async () => {
  try {
    await server.listen({ port: PORT, host: HOST });
    server.log.info(`Server listening on http://${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();