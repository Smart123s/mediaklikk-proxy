FROM node:20

WORKDIR /app

RUN mkdir static

COPY package*.json .

RUN npm ci

COPY . .

CMD ["node", "index.js"]
