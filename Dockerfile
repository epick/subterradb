# =============================================================================
# SubterraDB — production image for the Next.js GUI + bundled MCP server
# =============================================================================
# Multi-stage build:
#
#   1. deps    — install all node_modules (cached layer)
#   2. builder — `next build` (with output:'standalone') + tsc on the MCP package
#   3. runner  — slim runtime image with only the standalone output + MCP dist
#
# The runner image is intentionally minimal (~200 MB). It mounts the host's
# /var/run/docker.sock at runtime so the control plane can spawn per-project
# postgrest / gotrue / storage / realtime containers via dockerode.

# -----------------------------------------------------------------------------
# 1. deps — install dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# -----------------------------------------------------------------------------
# 2. builder — build Next.js + the MCP server package
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Telemetry off — we don't ship usage stats to Vercel.
ENV NEXT_TELEMETRY_DISABLED=1

# Compile the MCP server (it's a separate workspace with its own tsconfig).
RUN cd packages/mcp-server && npm install && npm run build

# Build the Next.js standalone output.
RUN npm run build

# -----------------------------------------------------------------------------
# 3. runner — minimal runtime image
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# wget is needed for the HEALTHCHECK below; it's not in the base alpine image.
RUN apk add --no-cache wget

# Non-root user for the Next.js process. The /var/run/docker.sock mount
# requires the user to be in the docker group on the host — the install
# script handles GID alignment when bringing the stack up.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Standalone Next.js output — only what's needed at runtime, no duplicate
# node_modules or build tools.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Compiled MCP server — bundled inside the image so the Connection Card can
# reference an absolute path that exists inside the container.
COPY --from=builder --chown=nextjs:nodejs /app/packages/mcp-server/dist ./packages/mcp-server/dist
COPY --from=builder --chown=nextjs:nodejs /app/packages/mcp-server/package.json ./packages/mcp-server/package.json

# next-intl needs the message catalogs at runtime — Next.js's standalone
# output doesn't pick them up automatically because they're loaded dynamically.
COPY --from=builder --chown=nextjs:nodejs /app/messages ./messages

USER nextjs

EXPOSE 3000

# Health endpoint that bin/install.sh polls until it returns 200.
HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=10 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
