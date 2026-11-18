# Image de l'API + interface (données synthétiques uniquement). Utilisateur non privilégié, dépendances de production seules.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src ./src
COPY sql ./sql
COPY seeds ./seeds
COPY scripts ./scripts
COPY web ./web
COPY docs/openapi.yaml ./docs/openapi.yaml
COPY fixtures/csv ./fixtures/csv
COPY fixtures/report_api_observations_v2.0.json ./fixtures/report_api_observations_v2.0.json
USER node
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=6 CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
CMD ["node","src/server.mjs"]
