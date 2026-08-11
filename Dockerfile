FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json tsconfig.server.json ./
COPY public ./public
COPY src ./src
COPY server ./server
RUN npm run build

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    VOYA_API_HOST=0.0.0.0 \
    VOYA_API_PORT=3333 \
    VOYA_DOCUMENTS_PATH=/data/documents \
    VOYA_WEB_ROOT=/app/dist

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build --chown=568:568 /app/dist ./dist
COPY --chown=568:568 server ./server

USER 568:568
EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3333/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server/index.ts"]
