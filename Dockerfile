FROM node:18-alpine AS base

RUN apk add make gcc g++ python3

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml /app/
COPY .yarn /app/.yarn


RUN corepack enable
RUN yarn install

COPY . /app
RUN yarn build

FROM node:18-alpine AS runtime

COPY --from=base /app/dist /app
COPY --from=base /app/node_modules /app/node_modules
COPY --from=base /app/package.json /app

ENV NODE_ENV=production

COPY .env /app

WORKDIR /app


ENTRYPOINT ["node", "main.js"]
