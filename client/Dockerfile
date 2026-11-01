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
# nginx procesa /etc/nginx/templates/*.template al arrancar y sustituye las variables
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
# Valores por defecto para Docker local; Railway pone su propio PORT y API_URL se define allí
ENV PORT=80 API_URL=http://api:3000
EXPOSE 80
