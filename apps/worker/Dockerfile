FROM node:20-slim AS base

# Install ffmpeg and dependencies for canvas
RUN apt-get update && apt-get install -y \
  ffmpeg \
  build-essential \
  libcairo2-dev \
  libpango1.0-dev \
  libjpeg-dev \
  libgif-dev \
  librsvg2-dev \
  pkg-config \
  python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json package-lock.json ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/

# Install all dependencies
RUN npm ci

# Copy source
COPY packages/db ./packages/db
COPY apps/worker ./apps/worker

# Generate Prisma client
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

# Build worker
RUN npm run build --workspace=@reelforge/worker

WORKDIR /app/apps/worker

EXPOSE 8080

CMD ["node", "dist/index.js"]
