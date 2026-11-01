# Neon Snake

Juego de Snake para navegador con un modo **Arena con bots**: serpientes controladas por la computadora que puedes eliminar haciéndolas chocar contra tu cuerpo. También tiene modo **Clásico**.

| Parte | Tecnología | Carpeta |
| --- | --- | --- |
| Interfaz | Vue 3 + Vite + TypeScript + Pinia + Vue Router | `client/` |
| Motor del juego | Phaser 3 | `client/src/game/` |
| API | Node.js + Express + TypeScript | `server/` |
| Base de datos | PostgreSQL 16 (Docker) + Prisma | `docker-compose.yml`, `server/prisma/` |

## Requisitos

- Node.js 20 o superior
- Docker Desktop (abierto)
- Git

## Opción A: todo el juego en Docker (como si estuviera publicado)

```bash
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
├── client/                 Interfaz y juego
│   └── src/
│       ├── views/          Pantallas: menú, modos, juego, ranking, login
│       ├── components/     GameCanvas.vue monta Phaser dentro de Vue
│       ├── game/           Escenas de Phaser y EventBus (Vue <-> Phaser)
│       └── stores/         Estado compartido (Pinia)
├── server/                 API
│   ├── src/index.ts        Rutas de Express
│   └── prisma/             Tablas (schema.prisma), migraciones y datos iniciales
├── docs/mockups/           Diseño de las pantallas
└── docker-compose.yml      PostgreSQL
```

## Comandos útiles

| Dónde | Comando | Qué hace |
| --- | --- | --- |
| `client/` | `npm run dev` | Juego en modo desarrollo |
| `client/` | `npm run build` | Versión para publicar |
| `server/` | `npm run dev` | API con recarga automática |
| `server/` | `npm run db:studio` | Ver y editar las tablas en el navegador |
| raíz | `docker compose up -d --build` | Todo el juego en http://localhost:8080 |
| raíz | `docker compose down` | Apagar los contenedores |

## Plan de la semana

1. Día 1: estructura del proyecto y base de datos ✅
2. Días 2 y 3: motor del juego y arena con bots ✅
3. Día 4: pantallas en Vue (HUD, ranking en vivo, pausa, Game Over) ✅ (falta ajustes de sonido)
4. Día 5: registro, login, guardar partidas y ranking
5. Días 6 y 7: sonido, móvil, pruebas y publicación
