# Build stage
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
# Use npm install to avoid lockfile requirement in container builds
RUN npm install
COPY . .
RUN npm run react-build

# Run stage
FROM node:18-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/build ./build
ENV PORT=3000
EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
