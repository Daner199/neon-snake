# Neon Snake

**Jugar:** https://neon-snake-web.onrender.com (la primera visita puede tardar hasta 1 minuto si el servidor estaba dormido)

Juego de Snake para navegador con un modo **Arena con bots**: serpientes controladas por la computadora que puedes eliminar haciéndolas chocar contra tu cuerpo. También tiene modo **Clásico** y **skins** que se desbloquean con el puntaje.

| Parte | Tecnología | Carpeta |
| --- | --- | --- |
| Interfaz | Vue 3 + Vite + TypeScript + Pinia + Vue Router | `client/` |
| Motor del juego | Phaser 3 | `client/src/scenes/`, `client/src/game/` |
| API | Node.js + Express 5 + TypeScript + Prisma 6 | `server/` |
| Base de datos | PostgreSQL 16 (Docker) + Prisma | `docker-compose.yml`, `server/prisma/` |

## Requisitos

- Node.js 20 o superior
- Docker Desktop (abierto)
- Git

## Opción A: todo el juego en Docker (como si estuviera publicado)

```bash
cp .env.example .env   # opcional: cambia JWT_SECRET
docker compose up -d --build
```

Abre **http://localhost:8080**. Docker levanta tres contenedores: la base de datos, la API y el juego (servido con nginx). La primera vez tarda unos minutos.

**Desde el celular:** conéctalo al mismo Wi-Fi que tu PC y abre `http://IP-DE-TU-PC:8080`. La IP la ves en PowerShell con `ipconfig` (línea "Dirección IPv4", por ejemplo `192.168.1.40`). Si no carga, permite Docker en el Firewall de Windows.

Para apagarlo: `docker compose down`.

## Opción B: para programar (con recarga automática)

```bash
# 1. Solo la base de datos (queda en el puerto 5433)
docker compose up -d db

# 2. Servidor (en una terminal)
cd server
npm install
cp .env.example .env
npx prisma migrate dev
npm run db:seed
npm run dev
# -> http://localhost:3000/api/health debe responder {"ok":true,"db":"conectada"}

# 3. Juego (en otra terminal)
cd client
npm install
npm run dev
# -> abre http://localhost:5173
```

Si `npm run build` del cliente falla con "memory allocation failed" (poca RAM libre), en PowerShell:
`$env:RAYON_NUM_THREADS='1'; $env:TOKIO_WORKER_THREADS='1'; npm run build`

## Estructura

```
neon-snake/
├── client/                    Interfaz y juego
│   ├── src/
│   │   ├── views/             Pantallas de Vue: menú, modos, skins, juego, ranking, login, 404
│   │   ├── components/        HUD, pausa, Game Over, aviso de skin y GameCanvas (monta Phaser)
│   │   ├── scenes/            Escenas de Phaser: Boot, Game y GameOver
│   │   ├── game/              Entidades del juego: serpiente, bots, colores y medidas
│   │   ├── stores/            Pinia: partida, skins, ajustes y sesión (solo lo que se ve)
│   │   ├── data/              JSON del juego: skins, modos y nombres de los jugadores con IA
│   │   ├── events/            EventBus y nombres de los eventos: el único puente Vue <-> Phaser
│   │   ├── logic/             Reglas puras (desbloqueo de skins), con sus pruebas
│   │   ├── api.ts             Llamadas a /api
│   │   └── sound.ts           Efectos de sonido con Web Audio
│   ├── Dockerfile             Compila el juego y lo sirve con nginx
│   └── nginx.conf.template    nginx: usa las variables PORT y API_URL
├── server/                    API
│   ├── src/
│   │   ├── index.ts           Arranque de Express, seguridad y rutas
│   │   ├── routes/            /api/auth, /api/sessions, /api/ranking
│   │   ├── middleware/        requireAuth (token JWT)
│   │   └── services/          Tokens y ranking
│   ├── prisma/                Tablas (schema.prisma), migraciones y datos iniciales
│   └── Dockerfile             Migra la base de datos y levanta la API
├── docs/
│   ├── prototipo.md           Hoja del prototipo: pantallas, escenas, eventos, datos y escalabilidad
│   └── mockups/               Diseño de las pantallas
├── .env.example               Todas las variables de entorno
├── render.yaml                Publicar en Render (API y juego)
└── docker-compose.yml         Base de datos, API y web
```

**Skins y modos.** Para agregar una skin se añade un elemento a `client/src/data/skins.json` (nombre, descripción, cuatro colores `#rrggbb` y el puntaje que hay que conseguir en una sola partida para desbloquearla). Para un modo, un elemento en `modos.json` (comida, jugadores con IA y velocidad). No hace falta tocar código: el selector de skins, Elegir modo, el ranking y la escena leen el JSON. `npm test` revisa que no falte ningún campo. Para que un modo nuevo entre al ranking en línea, también hay que agregar su id en `server/src/services/ranking.ts`.

**Reglas de arquitectura** (detalle en [docs/prototipo.md](docs/prototipo.md)):

- Vue solo hace pantallas, botones, textos y HUD; nunca toca sprites.
- Phaser solo hace escenas, sprites, física y animaciones; nunca toca el HTML.
- Pinia solo guarda datos que la interfaz muestra (puntaje, récord, skins, ajustes).
- Los eventos de `src/events/names.ts` son el único puente entre Vue y Phaser.
- Los datos del juego viven en JSON (`src/data/`).

## API

| Método | Ruta | Qué hace |
| --- | --- | --- |
| GET | `/api/health` | Comprueba la API y la base de datos |
| POST | `/api/auth/register` | Crea una cuenta (`username`, `email`, `password`) y devuelve el token |
| POST | `/api/auth/login` | Inicia sesión (`username`, `password`) y devuelve el token |
| POST | `/api/sessions` | Guarda una partida (requiere token) |
| GET | `/api/ranking/:modo` | Top 10 de `arena` o `classic` (con token, también tu puesto) |

## Comandos útiles

| Dónde | Comando | Qué hace |
| --- | --- | --- |
| `client/` | `npm run dev` | Juego en modo desarrollo |
| `client/` | `npm run build` | Versión para publicar |
| `client/` | `npm test` | Pruebas de la lógica (skins, serpiente y JSON) con Vitest |
| `server/` | `npm run dev` | API con recarga automática |
| `server/` | `npm run build` | Compila la API |
| `server/` | `npm run db:studio` | Ver y editar las tablas en el navegador |
| raíz | `docker compose up -d --build` | Todo el juego en http://localhost:8080 |
| raíz | `docker compose down` | Apagar los contenedores |

## Publicar en Railway

El juego se publica como **tres servicios** en un mismo proyecto de Railway: la base de datos, la API (`server/`) y la web (`client/`, nginx). Solo la web tiene dominio público; nginx pasa las llamadas a `/api` a la API por la red privada de Railway, así que no hace falta CORS.

1. Sube el código a GitHub.
2. En [railway.com](https://railway.com): **New Project → Deploy from GitHub repo** y elige `neon-snake`.
3. Añade la base de datos: **+ Create → Database → PostgreSQL**. Railway la llama `Postgres`.
4. **Servicio API.** En el servicio creado desde el repositorio:
   - *Settings → Source → Root Directory:* `/server` (usa `server/Dockerfile`).
   - Cámbiale el nombre a `api` (las variables de abajo usan ese nombre).
   - *Variables:*

     | Variable | Valor |
     | --- | --- |
     | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
     | `JWT_SECRET` | un texto largo y aleatorio (ver `.env.example` para generarlo) |
     | `PORT` | `3000` |
     | `TRUST_PROXY` | `2` |
     | `CORS_ORIGIN` | vacío (solo si otra web va a llamar a la API) |

   - *Settings → Deploy → Healthcheck Path:* `/api/health`.
   - No le generes dominio público.
5. **Servicio web.** **+ Create → GitHub Repo** con el mismo repositorio:
   - *Root Directory:* `/client` (usa `client/Dockerfile`). Nómbralo `web`.
   - *Variables:* `API_URL` = `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:3000`. `PORT` lo pone Railway solo.
   - *Settings → Networking → Generate Domain* para tener la dirección pública.
6. Abre `https://TU-DOMINIO/api/health`: debe responder `{"ok":true,"db":"conectada"}`. Al arrancar, la API aplica las migraciones y crea los modos de juego sola.
7. Opcional: en `client/index.html` cambia `og:image` por la URL completa (`https://TU-DOMINIO/og-image.png`) para que la vista previa salga en WhatsApp y redes.

Si los jugadores comparten el límite de intentos de login (todos reciben "Demasiados intentos"), revisa `TRUST_PROXY`: debe ser el número de proxies delante de la API.

## Publicar en Render + Neon (gratis)

La base de datos va en **Neon** y la API y el juego en **Render**, con el archivo `render.yaml` de la raíz. En el plan gratis de Render los servicios se duermen tras unos 15 minutos sin visitas: la primera visita después tarda entre 30 y 60 segundos.

**1. Base de datos en Neon**

1. Entra en [neon.tech](https://neon.tech) y crea un proyecto (región **AWS US East 2 (Ohio)**, la misma que Render en `render.yaml`).
2. En **Connect**, desactiva **Connection pooling** y copia la dirección. Empieza por `postgresql://` y termina en `?sslmode=require`. Hace falta la directa (sin `-pooler`) para que las migraciones funcionen.

**2. API y juego en Render**

1. Entra en [render.com](https://render.com) con tu cuenta de GitHub.
2. **New → Blueprint** y elige el repositorio `neon-snake`. Render lee `render.yaml` y muestra dos servicios: `neon-snake-api` y `neon-snake-web`.
3. Te pide dos valores:
   - `DATABASE_URL`: la dirección de Neon del paso anterior.
   - `API_URL`: la dirección pública que tendrá la API, `https://neon-snake-api.onrender.com`. Si Render le añade letras al nombre porque ya existe, cámbiala después en **neon-snake-web → Environment** por la que aparezca en el servicio de la API.
4. **Apply**. La primera vez tarda unos minutos en compilar. La API aplica las migraciones y crea los modos de juego sola.
5. Abre `https://neon-snake-api.onrender.com/api/health`: debe responder `{"ok":true,"db":"conectada"}`.
6. Abre la dirección de `neon-snake-web` (algo como `https://neon-snake-web.onrender.com`): es el juego.

`JWT_SECRET` lo genera Render solo. Si los jugadores comparten el límite de intentos de login (todos reciben "Demasiados intentos"), revisa `TRUST_PROXY` en la API.

## Plan de la semana

1. Día 1: estructura del proyecto y base de datos ✅
2. Días 2 y 3: motor del juego y arena con bots ✅
3. Día 4: pantallas en Vue (HUD, ranking en vivo, pausa, Game Over) ✅
4. Día 5: registro, login, guardar partidas y ranking ✅
5. Días 6 y 7: sonido ✅, móvil ✅, preparar Railway ✅, pruebas y publicación
