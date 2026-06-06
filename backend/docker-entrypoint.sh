#!/bin/sh
set -e

# Runs on every `docker compose up`. Each step is safe to repeat:
#   - migrate deploy only applies pending migrations
#   - seed.js only inserts when the tables are empty
echo "[entrypoint] applying database migrations..."
npx prisma migrate deploy

echo "[entrypoint] seeding database (skips if already populated)..."
npm run seed

echo "[entrypoint] starting backend..."
exec npm run start
