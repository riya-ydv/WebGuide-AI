FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV CI=true NITRO_PRESET=node-server
COPY package.json package-lock.json ./
RUN npm ci
COPY vite.config.ts tsconfig.json ./
COPY src ./src
COPY public ./public
COPY shared ./shared
COPY browser-extension ./browser-extension
COPY widget ./widget
COPY scripts/build-assistance.mjs ./scripts/build-assistance.mjs
RUN npm run build && test -f .output/server/index.mjs

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 8080
CMD ["node", ".output/server/index.mjs"]
