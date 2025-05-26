FROM node:20.18-alpine

# 设置工作目录
WORKDIR /usr/src/app

# 设置环境变量为生产环境，默认情况下
ENV NODE_ENV=production

# 创建非root用户 'node'
# RUN addgroup --system node \
#     && adduser --system --ingroup node node

# 拷贝 package.json 和 package-lock.json 并安装依赖（作为root）
COPY package*.json ./
RUN npm ci --omit=dev

# 切换到非root用户
USER node

# 拷贝应用代码（此时已经是'node'用户）
COPY --chown=node:node . .

# 定义启动命令
CMD [ "node", "index.js" ]
