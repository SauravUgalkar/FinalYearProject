FROM node:18-alpine

# Install runtimes and toolchain used by the execution worker.
RUN apk add --no-cache \
    bash \
    curl \
    python3 \
    openjdk11 \
    gcc \
    g++ \
    make \
    musl-dev \
    dumb-init

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

# Ensure temp execution paths exist and are writable by non-root user.
RUN mkdir -p /tmp/code-execution && chown -R node:node /app /tmp/code-execution

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
