FROM node:18-slim

RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package*.json ./
RUN npm install

# Prisma needs the schema present to generate the client.
COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN chmod +x docker-entrypoint.sh

# Documents the port the server listens on; fed from BACKEND_PORT at build time.
ARG BACKEND_PORT=4000
EXPOSE ${BACKEND_PORT}

# Entrypoint applies migrations, seeds (if empty), then starts the server.
ENTRYPOINT ["./docker-entrypoint.sh"]
