FROM node:20-alpine AS base
WORKDIR /app

RUN apk add --no-cache openssl python3 make g++

COPY package.json ./
COPY prisma ./prisma/
RUN npm install

COPY tsconfig.json ./
COPY src ./src/
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json ./
COPY prisma ./prisma/
RUN npm install --omit=dev
RUN npx prisma generate

COPY --from=base /app/dist ./dist

RUN mkdir -p /app/uploads

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
