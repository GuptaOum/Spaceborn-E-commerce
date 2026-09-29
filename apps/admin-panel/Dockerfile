FROM node:20-alpine AS base

FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/web-core/package.json ./packages/web-core/
COPY apps/admin-panel/package.json ./apps/admin-panel/
RUN npm ci

COPY packages/web-core ./packages/web-core
COPY apps/admin-panel ./apps/admin-panel
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w apps/admin-panel
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/apps/admin-panel/public ./apps/admin-panel/public
COPY --from=builder /app/apps/admin-panel/.next/standalone ./
COPY --from=builder /app/apps/admin-panel/.next/static ./apps/admin-panel/.next/static

USER node
EXPOSE 3000
CMD ["node", "apps/admin-panel/server.js"]
