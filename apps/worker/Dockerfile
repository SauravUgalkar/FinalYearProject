# Multi-stage build for safe code execution environment
FROM node:18-alpine

# Install language runtimes for multi-language support
RUN apk add --no-cache \
    python3 \
    openjdk11 \
    bash \
    curl \
    gcc \
    g++ \
    make \
    musl-dev

WORKDIR /app

# Copy package files
COPY package.json .
COPY package-lock.json* .

# Install dependencies
RUN npm install --only=production

# Copy source code
COPY src ./src

# Create a non-root user for execution
RUN adduser -D -g '' execuser

# Set working directory for code execution
RUN mkdir -p /code && chown execuser:execuser /code

USER node

CMD ["node", "src/index.js"]
