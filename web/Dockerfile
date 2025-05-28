FROM node:20.18-alpine
WORKDIR /app
ENV PORT=4000 
COPY package* ./
RUN npm install
COPY . .
EXPOSE 4000
CMD ["npm", "start"]