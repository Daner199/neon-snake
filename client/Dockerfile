# Juego (Vue + Phaser) servido con nginx
FROM node:22-slim AS build
WORKDIR /app
# Menos hilos al compilar: evita "memory allocation failed" en equipos con poca RAM
ENV RAYON_NUM_THREADS=1 TOKIO_WORKER_THREADS=1
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
