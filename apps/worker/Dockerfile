FROM node:20-alpine AS base
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Install dependencies
COPY package.json ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/
RUN npm install --workspace=@reelforge/worker

# Copy source
COPY packages/db ./packages/db
COPY apps/worker ./apps/worker

# Generate Prisma client
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

# Build
RUN npm run build --workspace=@reelforge/worker

WORKDIR /app/apps/worker
CMD ["node", "dist/index.js"]
