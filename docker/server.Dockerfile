FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
RUN npm install
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/server packages/server
RUN npx prisma generate --schema=packages/server/src/prisma/schema.prisma
RUN npm run build -w packages/server

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages/server/dist packages/server/dist
COPY --from=builder /app/packages/server/src/prisma packages/server/src/prisma
COPY --from=builder /app/packages/server/node_modules packages/server/node_modules
EXPOSE 3000
CMD ["node", "packages/server/dist/app.js"]
