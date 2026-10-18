# Apex – ein Container: Web-App + API + SQLite. Läuft On-Premise oder in jeder Private Cloud.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
# Zeitzone der Kanzlei: „heute“, Fristen und Tageswechsel der Beispieldaten richten sich nach deutscher Ortszeit.
RUN apk add --no-cache tzdata
# DATABASE_PATH: Dateiname aus der Zeit vor der Umbenennung in Apex – vorhandene Volumes werden weiter gefunden.
ENV NODE_ENV=production \
    TZ=Europe/Berlin \
    PORT=8787 \
    DATABASE_PATH=/data/anwaltapex.db \
    STATIC_DIR=/app/dist
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8787/api/health || exit 1
CMD ["node", "--no-warnings=ExperimentalWarning", "dist-server/index.js"]
