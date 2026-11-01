# Neon Snake: reglas del proyecto

Juego de Snake para navegador. Proyecto de **una semana**, hecho por **una persona**. Modo principal: **Arena con bots** (serpientes con IA que el jugador elimina haciéndolas chocar contra su cuerpo). Segundo modo: **Clásico**. Sin multijugador en línea.

Responde y escribe todos los textos del juego en **español**.

## Stack (no cambiarlo sin preguntar)

| Parte | Tecnología | Carpeta |
| --- | --- | --- |
| Interfaz | Vue 3 + Vite + TypeScript + Pinia + Vue Router | `client/` |
| Motor del juego | Phaser **3** (no migrar a Phaser 4) | `client/src/game/` |
| API | Express 5 + TypeScript + Prisma 6 | `server/` |
| Base de datos | PostgreSQL 16 en Docker (puerto 5433 en la PC) | `docker-compose.yml`, `server/prisma/` |

## Estructura y dónde va cada cosa

- `client/src/views/`: una vista por pantalla (`MenuView`, `ModesView`, `GameView`, `RankingView`, `LoginView`). Nombre `XxxView.vue`.
- `client/src/components/`: piezas reutilizables de Vue (`GameCanvas.vue` monta Phaser).
- `client/src/game/`: todo lo de Phaser. Escenas en `scenes/`, medidas del tablero en `constants.ts`, la IA de los bots en `bots/` cuando exista.
- `client/src/game/EventBus.ts`: el **único** canal entre Phaser y Vue. Phaser emite `score-changed`, `bot-killed`, `game-over`; Vue emite `pause`, `resume`, `restart`. Phaser no importa nada de Vue y Vue no toca objetos de Phaser.
- `client/src/stores/`: estado compartido con Pinia.
- `server/src/`: rutas de Express. Cuando crezca: `routes/`, `middleware/`, `services/`. Todas las rutas empiezan por `/api`.
- `server/prisma/schema.prisma`: tablas. Modelos en inglés y PascalCase, tablas y columnas en snake_case con `@@map` y `@map`.

## Estilo visual (igual que en Figma)

Usa siempre las variables de `client/src/style.css`. Nunca escribas colores sueltos en los componentes.

| Variable | Valor |
| --- | --- |
| `--color-fondo` | #0B0F1A |
| `--color-superficie` | #121A2B |
| `--color-borde` | #2A3550 |
| `--color-primario` | #39FF14 |
| `--color-peligro` | #FF2E88 |
| `--color-oro` | #FFC83D |
| `--color-texto` | #E6EDF7 |
| `--color-texto-suave` | #9AA7BD |

Títulos con `--fuente-titulo` (Press Start 2P), el resto con `--fuente-cuerpo` (Inter). Botones con las clases `.btn` y `.btn--primario`. Los mockups de referencia están en `docs/mockups/`.

## Reglas de código

- TypeScript estricto. Nada de `any` salvo que no haya otra opción.
- Vue con `<script setup lang="ts">` y estilos `scoped`.
- Nombres de variables y funciones en inglés; textos que ve el jugador y comentarios en español.
- No añadir dependencias nuevas sin explicar para qué.
- No dejar archivos de prueba, código comentado ni `console.log` olvidados.
- Cambios pequeños y enfocados: una tarea por commit, con mensaje en español que diga qué se hizo.

## Antes de dar algo por terminado

```bash
cd client && npm run build      # debe terminar sin errores
cd server && npm run build      # debe terminar sin errores
```

Si tocaste `schema.prisma`: `npx prisma migrate dev --name <cambio>` y sube la carpeta de la migración.

## Fuera del alcance de esta semana

Tienda de skins, logros, reto diario, panel de administración, inglés, multijugador en línea. No los empieces aunque parezcan fáciles.

## Plan

1. Día 1: estructura y base de datos (hecho)
2. Días 2 y 3: motor y bots con IA (hecho: `game/Snake.ts`, `game/bots/BotBrain.ts`, `scenes/ArenaScene.ts`)
3. Día 4: interfaz en Vue (HUD, mini ranking, pausa, Game Over, ajustes de sonido)
4. Día 5: registro, login con JWT, guardar partidas, ranking top 10 por modo
5. Días 6 y 7: sonido, controles táctiles, pruebas y publicación
