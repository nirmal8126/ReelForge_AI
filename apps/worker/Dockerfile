FROM node:20-slim AS base

# Install ffmpeg and dependencies for canvas
RUN apt-get update && apt-get install -y \
  ffmpeg \
  curl \
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
COPY packages/db/ ./packages/db/

# Install all dependencies
RUN npm ci

# Copy worker source
COPY apps/worker ./apps/worker

# Build db package (as CJS for worker compatibility)
RUN rm -f packages/db/src/seed.ts && cd packages/db && npx tsc --module commonjs --moduleResolution node --outDir ./dist --skipLibCheck
# Patch db package.json to point to compiled output
RUN node -e "const p=require('./packages/db/package.json');p.main='./dist/index.js';require('fs').writeFileSync('./packages/db/package.json',JSON.stringify(p,null,2))"

# Build worker
RUN cd apps/worker && npx tsc

# Find the compiled entry and write a launcher that requires it.
# This avoids fragile symlinks AND keeps relative imports working.
RUN ENTRY=$(find apps/worker/dist -name "index.js" -path "*/src/index.js" | head -1) && \
    echo "=== Found compiled entry: $ENTRY ===" && \
    test -n "$ENTRY" && test -f "$ENTRY" && \
    REL_ENTRY="${ENTRY#apps/worker/}" && \
    echo "=== Relative entry: $REL_ENTRY ===" && \
    echo "require('./$REL_ENTRY');" > /app/apps/worker/main.js && \
    cat /app/apps/worker/main.js

WORKDIR /app/apps/worker

EXPOSE 8080
ENV PORT=8080

# Wrap node in sh so we get clear startup logging on Railway
CMD ["sh", "-c", "echo '=== Worker container starting ===' && pwd && ls -la main.js && exec node main.js"]
