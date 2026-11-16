# Build context is the repository root. GitHub Actions builds this image.
# The VPS only pulls the published image and starts it.

FROM node:22-bookworm-slim AS deps
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /src
COPY design ./design
COPY frontend ./frontend
COPY --from=deps /src/frontend/node_modules ./frontend/node_modules
WORKDIR /src/frontend
ARG NEXT_PUBLIC_API_URL=https://api.rentos.io.vn
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /src/frontend/.next ./.next
COPY --from=build /src/frontend/public ./public
COPY --from=build /src/frontend/next.config.ts ./
RUN chown -R node:node /app
USER node
EXPOSE 3000
CMD ["./node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
