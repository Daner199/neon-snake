# Neon Snake

**Jugar:** https://neon-snake-web.onrender.com (la primera visita puede tardar hasta 1 minuto si el servidor estaba dormido)

Juego de Snake para navegador con un modo **Arena con bots**: serpientes controladas por la computadora que puedes eliminar haciéndolas chocar contra tu cuerpo. También tiene modo **Clásico**, **multijugador en línea** con salas y códigos para invitar a tus amigos, y **skins** que se desbloquean con el puntaje.

| Parte | Tecnología | Carpeta |
| --- | --- | --- |
| Interfaz | Vue 3 + Vite + TypeScript + Pinia + Vue Router | `client/` |
| Motor del juego | Phaser 3 | `client/src/scenes/`, `client/src/game/` |
| API | Node.js + Express 5 + TypeScript + Prisma 6 | `server/` |
| Multijugador en línea | Socket.IO 4 (servidor autoritativo) | `server/src/online/`, `client/src/online/` |
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
│   │   ├── online/            Conexión con las salas en línea (Socket.IO) y mensajes (protocol.ts)
│   │   ├── api.ts             Llamadas a /api
│   │   └── sound.ts           Efectos de sonido con Web Audio
│   ├── Dockerfile             Compila el juego y lo sirve con nginx
│   └── nginx.conf.template    nginx: usa las variables PORT y API_URL
├── server/                    API
│   ├── src/
│   │   ├── index.ts           Arranque de Express, seguridad y rutas
│   │   ├── routes/            /api/auth, /api/sessions, /api/ranking
│   │   ├── online/            Multijugador: salas, arena simulada en el servidor y Socket.IO
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

**Skins y modos.** Para agregar una skin se añade un elemento a `client/src/data/skins.json` (nombre, descripción, cuatro colores `#rrggbb` y el puntaje que hay que conseguir en una sola partida para desbloquearla). Las skins se desbloquean solo con sesión iniciada: salen de la mejor partida de la cuenta guardada en el servidor, así que se tienen en cualquier navegador. Los invitados solo tienen la primera. Para un modo, un elemento en `modos.json` (comida, jugadores con IA, velocidad y si se puede atravesar el propio cuerpo). No hace falta tocar código: el selector de skins, Elegir modo, el ranking y la escena leen el JSON. `npm test` revisa que no falte ningún campo. Para que un modo nuevo entre al ranking en línea, también hay que agregar su id en `server/src/services/ranking.ts`.

**Reglas de arquitectura** (detalle en [docs/prototipo.md](docs/prototipo.md)):

- Vue solo hace pantallas, botones, textos y HUD; nunca toca sprites.
- Phaser solo hace escenas, sprites, física y animaciones; nunca toca el HTML.
- Pinia solo guarda datos que la interfaz muestra (puntaje, récord, skins, ajustes).
- Los eventos de `src/events/names.ts` son el único puente entre Vue y Phaser.
- Los datos del juego viven en JSON (`src/data/`).

## Multijugador en línea

En el menú, **Jugar en línea** abre la pantalla de salas:

- **Partida rápida:** entras a la sala pública con más gente (o se crea una).
- **Crear sala:** recibes un código de 4 letras (por ejemplo `K7Q2`). Puede ser pública (sale en la lista de salas abiertas) o privada, y con o sin jugadores de la computadora que completan la sala hasta 8 serpientes.
- **Unirse con código:** escribes el código que te pasó tu amigo. También sirve el enlace del botón **Invitar** (`https://…/online/K7Q2`), que entra directo.

Cómo funciona:

- **El servidor manda.** `server/src/online/Arena.ts` mueve todas las serpientes cada 110 ms, revisa los choques y reparte la comida, con las mismas reglas que el modo Arena. El navegador solo envía los giros (`girar`) y dibuja lo que recibe (`estado`). Así nadie puede hacer trampa y todos ven lo mismo.
- **Mensajes pequeños.** Cada paso viaja como números (`client/src/online/protocol.ts`): unas 600 letras por paso con 8 serpientes. Los nombres y colores se mandan solo cuando alguien entra o sale (`roster`).
- **Protección al aparecer.** Durante 3 segundos tu serpiente parpadea: no choca con nadie y nadie la caza.
- **Ranking En línea.** Con sesión iniciada, el servidor guarda la partida él mismo al morir (no la manda el navegador), y aparece en la pestaña *En línea* del ranking.
- **Salas.** Hasta 8 personas por sala y 50 salas por servidor. Una sala vacía se cierra al minuto. Si se corta la conexión, el juego vuelve a entrar solo a la misma sala.
- **Mismo puerto.** Socket.IO vive en `/api/socket.io`, así pasa por el proxy de nginx (que ya deja pasar WebSocket) y el de Vite en desarrollo. No hace falta abrir otro puerto ni cambiar nada en Render o Railway.

Para probarlo en tu PC con dos jugadores, abre `http://localhost:5173/online` en dos ventanas (una normal y otra de incógnito), crea una sala en una y únete con el código en la otra.

## Inteligencia de los bots

Los jugadores de la computadora usan `client/src/game/bots/BotBrain.ts` (el servidor usa una copia exacta, `server/src/online/shared/BotBrain.ts`; `npm test` avisa si no son iguales). En cada paso:

1. Descartan las direcciones que chocan seguro.
2. Cuentan el espacio libre que les quedaría en cada dirección (*flood fill*), sabiendo que el cuerpo de los demás se va retirando desde la cola y sin contar los huecos que otra cabeza puede cerrar antes. Si el espacio es menor que su cuerpo, es un callejón.
3. Evitan las celdas donde una serpiente igual o más grande puede meter la cabeza.
4. Buscan la comida por el camino real más corto (BFS, no en línea recta), prefieren la dorada y a veces intentan cortarle el paso a una serpiente cercana.
5. Recuerdan su objetivo para no cambiar de idea en cada paso, y prefieren seguir recto: así no zigzaguean.

Antes, los bots hacían giros al azar (a veces contra la pared) e iban en zigzag hacia la comida, y eso parecía un error. En una simulación de 30 partidas de 2000 pasos con 8 bots, ahora mueren unas 2,6 veces menos (745 muertes contra 1944).

## API

| Método | Ruta | Qué hace |
| --- | --- | --- |
| GET | `/api/health` | Comprueba la API y la base de datos |
| POST | `/api/auth/register` | Crea una cuenta (`username`, `email`, `password`) y devuelve el token |
| POST | `/api/auth/login` | Inicia sesión (`username`, `password`) y devuelve el token |
| POST | `/api/sessions` | Guarda una partida (requiere token) |
| GET | `/api/ranking/:modo` | Top 10 de `arena`, `classic` u `online` (con token, también tu puesto) |
| GET | `/api/online/salas` | Salas públicas con lugar libre |
| WebSocket | `/api/socket.io` | Multijugador en línea (Socket.IO, mensajes en `protocol.ts`) |

## Comandos útiles

| Dónde | Comando | Qué hace |
| --- | --- | --- |
| `client/` | `npm run dev` | Juego en modo desarrollo |
| `client/` | `npm run build` | Versión para publicar |
| `client/` | `npm test` | Pruebas de la lógica (skins, serpiente, IA de los bots y JSON) con Vitest |
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
