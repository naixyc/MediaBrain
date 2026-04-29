FROM node:22-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

EXPOSE 42181

CMD ["node", "-r", "ts-node/register", "src/index.ts"]
