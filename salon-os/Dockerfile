FROM node:22-alpine
WORKDIR /app
COPY package.json ./
# Instala el SDK de Claude (opcional: solo se usa si hay ANTHROPIC_API_KEY).
RUN npm install --omit=dev --no-audit --no-fund
COPY server.js ./
COPY src ./src
COPY public ./public
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/salon-os.db
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
EXPOSE 3000
USER node
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
