FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY services/api/package.json ./services/api/
COPY packages/web-core/package.json ./packages/web-core/
RUN npm ci

COPY packages/web-core ./packages/web-core
COPY services/api ./services/api
# prune drops sharp's musl binary. Reinstall it for this Alpine image.
RUN npm run build -w services/api && npm prune --omit=dev \
  && npm install --no-save --os=linux --libc=musl --cpu=x64 sharp@0.33.5

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /etc/ssl/certs/rds-global-bundle.pem
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/api/dist ./dist
COPY --from=build /app/services/api/migrations ./migrations
COPY --from=build /app/services/api/package.json ./
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
