# syntax=docker/dockerfile:1.7

# ─── Stage 1: build backend + frontend ─────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Install root + workspace deps (leverages layer caching)
COPY package.json package-lock.json* ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm install \
 && npm install --prefix backend \
 && npm install --prefix frontend

# Copy sources
COPY backend backend
COPY frontend frontend

# Generate Prisma client + build both apps
RUN npx --prefix backend prisma generate --schema=backend/prisma/schema.prisma \
 && npm run build

# Drop dev deps from backend/node_modules for a smaller runtime image
RUN npm prune --omit=dev --prefix backend

# ─── Stage 2: production image ─────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Copy built artifacts + prod deps only
COPY --from=build /app/backend/dist            ./backend/dist
COPY --from=build /app/backend/prisma          ./backend/prisma
COPY --from=build /app/backend/node_modules    ./backend/node_modules
COPY --from=build /app/backend/package.json    ./backend/package.json
COPY --from=build /app/frontend/dist           ./frontend/dist
COPY package.json ./

# Local uploads dir (used when Cloudinary is not configured)
RUN mkdir -p /app/backend/uploads
VOLUME ["/app/backend/uploads"]

EXPOSE 3001

# Push schema on start (creates tables on first run), then launch server.
CMD ["sh", "-c", "npx --prefix backend prisma db push --accept-data-loss --schema=backend/prisma/schema.prisma && node backend/dist/index.js"]
