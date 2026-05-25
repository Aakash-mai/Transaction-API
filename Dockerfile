FROM node:22-alpine

WORKDIR /app

# Copy package manifests first so Docker can cache the npm install layer.
# packages/ must be present before npm ci because package.json references
# kalp-wallet-ts as a local file: dependency.
COPY package.json package-lock.json ./
COPY packages/ ./packages/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application source
COPY src/ ./src/

# Pre-create logs directory so winston-daily-rotate-file doesn't error on startup.
# The actual log files are written to a host-mounted volume (see docker-compose.yml).
RUN mkdir -p logs

EXPOSE 4000

CMD ["node", "src/server.js"]
