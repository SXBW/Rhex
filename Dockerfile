ARG NEXT_ASSET_PREFIX="https://rhex-runtime-asset-prefix.invalid"
ARG NEXT_DEPLOYMENT_ID
ARG NODE_IMAGE=node:24-bookworm-slim

FROM ${NODE_IMAGE} AS base

ARG APT_MIRROR
ARG PNPM_REGISTRY

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable \
  && if [ -n "${PNPM_REGISTRY}" ]; then \
    npm config set registry "${PNPM_REGISTRY}" \
    && export COREPACK_NPM_REGISTRY="${PNPM_REGISTRY}"; \
  fi \
  && corepack prepare pnpm@10.33.4 --activate \
  && if [ -n "${APT_MIRROR}" ]; then \
    sed -i "s|http://deb.debian.org/debian|${APT_MIRROR}|g; s|http://deb.debian.org/debian-security|${APT_MIRROR}-security|g" /etc/apt/sources.list.d/debian.sources; \
  fi \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS builder

ARG NEXT_ASSET_PREFIX
ARG NEXT_DEPLOYMENT_ID
ARG PNPM_REGISTRY
ENV NEXT_ASSET_PREFIX=${NEXT_ASSET_PREFIX}
ENV NEXT_DEPLOYMENT_ID=${NEXT_DEPLOYMENT_ID}

RUN mkdir -p addons

COPY package.json pnpm-lock.yaml .npmrc ./
COPY prisma ./prisma

RUN --mount=type=cache,id=rhex-pnpm-store,target=/pnpm/store \
  pnpm config set store-dir /pnpm/store \
  && if [ -n "${PNPM_REGISTRY}" ]; then pnpm config set registry "${PNPM_REGISTRY}"; fi \
  && pnpm install --frozen-lockfile

COPY . .

RUN pnpm run prisma:generate \
  && pnpm run build \
  && pnpm run verify:docker-build \
  && rm -rf .next/cache .next/dev

RUN ARCH=$(dpkg --print-architecture) \
  && echo "[cleanup] Architecture: $ARCH" \
  && find node_modules -type d \( \
    -name "linux-x64" -o -name "linux-arm64" -o \
    -name "darwin-x64" -o -name "darwin-arm64" -o \
    -name "win32-x64" -o -name "win32-arm64" \
  \) 2>/dev/null | while read dir; do \
    case "$ARCH" in \
      amd64) echo "$dir" | grep -q "linux-x64" || { echo "[cleanup] Removing $dir"; rm -rf "$dir"; } ;; \
      arm64) echo "$dir" | grep -q "linux-arm64" || { echo "[cleanup] Removing $dir"; rm -rf "$dir"; } ;; \
    esac; \
  done \
  && find node_modules -maxdepth 5 -type d -name "@napi-rs" -path "*/node_modules/@napi-rs" 2>/dev/null | while read napi_dir; do \
    find "$napi_dir" -maxdepth 1 -type d \( \
      -name "canvas-linux-x64*" -o -name "canvas-linux-arm64*" -o \
      -name "canvas-darwin*" -o -name "canvas-win32*" \
    \) 2>/dev/null | while read pkg_dir; do \
      case "$ARCH" in \
        amd64) echo "$pkg_dir" | grep -q "linux-x64" || { echo "[cleanup] Removing $pkg_dir"; rm -rf "$pkg_dir"; } ;; \
        arm64) echo "$pkg_dir" | grep -q "linux-arm64" || { echo "[cleanup] Removing $pkg_dir"; rm -rf "$pkg_dir"; } ;; \
      esac; \
    done; \
  done

RUN find node_modules -type f \( \
    -name "README*" -o -name "CHANGELOG*" -o -name "LICENSE*" -o \
    -name "*.md" -o -name "*.test.*" -o -name "*.spec.*" -o \
    -name "*.map" -o -name ".npmignore" \
  \) -delete 2>/dev/null; \
  find node_modules -type d \( \
    -name "test" -o -name "tests" -o -name "__tests__" -o \
    -name "docs" -o -name "example" -o -name "examples" \
  \) -exec rm -rf {} + 2>/dev/null; \
  true

FROM base AS runner

ARG NEXT_DEPLOYMENT_ID

ENV NODE_ENV=production
ENV NEXT_DEPLOYMENT_ID=${NEXT_DEPLOYMENT_ID}

WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/herper/Rhex"

RUN mkdir -p uploads addons

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/addons ./addons
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/write-guard.config.ts ./write-guard.config.ts

RUN chmod +x ./scripts/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["pnpm", "run", "start"]
