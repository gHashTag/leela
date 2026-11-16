FROM oven/bun:1-alpine
WORKDIR /app
RUN bun add pg
COPY api.ts ./api.ts
EXPOSE 8080
CMD ["bun", "api.ts"]
