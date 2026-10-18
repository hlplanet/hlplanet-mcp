# Used by MCP directories (such as Glama) to build and inspect the server
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY package.json README.md LICENSE ./
ENTRYPOINT ["node", "dist/index.js"]
