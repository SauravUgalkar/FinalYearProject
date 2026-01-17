# Multi-target Dockerfile for client, server, and worker
ARG NODE_IMAGE=node:18-alpine

# ---------- client ----------
FROM ${NODE_IMAGE} AS client-build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run react-build

FROM ${NODE_IMAGE} AS client
WORKDIR /app
RUN npm install -g serve
COPY --from=client-build /app/build ./build
ENV PORT=3000
EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]

# ---------- server ----------
FROM ${NODE_IMAGE} AS server
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY src ./src
ENV PORT=5000
EXPOSE 5000
CMD ["node", "src/index.js"]

# ---------- worker ----------
FROM ${NODE_IMAGE} AS worker
RUN apk add --no-cache python3 openjdk11 bash curl
WORKDIR /app
COPY package*.json ./
COPY package-lock.json* ./
RUN npm install --only=production
COPY src ./src
RUN adduser -D -g '' execuser
RUN mkdir -p /code && chown execuser:execuser /code
USER node
CMD ["node", "src/index.js"]
