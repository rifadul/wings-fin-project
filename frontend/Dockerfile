FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Documents the Vite dev-server port; fed from FRONTEND_PORT at build time.
ARG FRONTEND_PORT=3000
EXPOSE ${FRONTEND_PORT}

# Dev server with hot reload; --host makes it reachable from outside the container.
CMD ["npm", "run", "dev"]
