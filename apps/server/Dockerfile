FROM node:18-alpine

WORKDIR /app

# Install dependencies (npm install instead of ci to tolerate missing lockfile)
COPY package*.json ./
RUN npm install --only=production

# Copy source
COPY src ./src

ENV PORT=5000
EXPOSE 5000

CMD ["node", "src/index.js"]
