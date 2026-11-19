# Exact official Playwright version and manifest digest matching package-lock.json.
FROM mcr.microsoft.com/playwright:v1.65.1-noble@sha256:1507cbfc550a63a6b7396791ca4f00df17beb56342d2447b3f106c306f525579
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && node -e "if(require('playwright/package.json').version!=='1.65.1')process.exit(1)"
COPY worker ./worker
COPY tsconfig.worker.json ./
RUN mkdir -p /data && chown pwuser:pwuser /data
ENV NODE_ENV=production WEBGUIDE_WORKER_MODE=hosted WEBGUIDE_WORKER_HOST=0.0.0.0 PORT=8080 WEBGUIDE_DATA_DIR=/data
USER pwuser
EXPOSE 8080
CMD ["node", "--import", "tsx", "worker/server.ts"]
