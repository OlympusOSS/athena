FROM oven/bun:1-alpine AS deps
WORKDIR /app

# Copy Canvas package (file:../Canvas dependency)
COPY Canvas/package.json ../Canvas/package.json
COPY Canvas/src ../Canvas/src

# Copy app package files
COPY Athena/package.json Athena/bun.lock ./

RUN bun install --production --frozen-lockfile

FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Copy Canvas package and install its deps (webpack resolves from source dir)
COPY Canvas/ ../Canvas/
RUN cd ../Canvas && bun install --production

# Copy app source
COPY Athena/package.json Athena/bun.lock ./
RUN bun install --frozen-lockfile

COPY Athena/ .

RUN bun run build

FROM oven/bun:1-alpine AS runner
WORKDIR /app

RUN apk --no-cache add wget
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --spider --quiet http://localhost:3000/api/health || exit 1

CMD ["bun", "server.js"]
