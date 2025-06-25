import log from 'loglevel';

// 获取环境变量中的日志级别，默认为 "warn"
const logLevel = process.env.LOGLEVEL?.toLowerCase() || 'info';

// 设置全局日志级别
log.setLevel(logLevel);

// 创建带命名空间的 logger 工厂函数
function createLogger(namespace) {
  const logger = {};
  const levels = ['trace', 'debug', 'info', 'warn', 'error'];

  levels.forEach(level => {
    logger[level] = (...args) => {
      // 添加命名空间前缀
      const prefixedArgs = [`[${namespace}]`, ...args];
      log[level](...prefixedArgs);
    };
  });

  return logger;
}

// 创建两个命名空间的 logger
const logMain = createLogger('dcmjs');
const validationLog = createLogger('validation.dcmjs');

export { logMain as log, validationLog };
export default logMain;
