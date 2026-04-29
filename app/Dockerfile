FROM node:20-bookworm-slim

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

EXPOSE 42180

CMD ["node", "-r", "ts-node/register", "src/index.ts"]
