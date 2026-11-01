# API de Neon Snake
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build
EXPOSE 3000
# Al arrancar: aplica las migraciones, crea los modos de juego y levanta la API
CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:seed && node dist/index.js"]
