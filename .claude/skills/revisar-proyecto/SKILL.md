---
name: revisar-proyecto
description: Revisa todo el proyecto Neon Snake (errores, orden de carpetas, estilo y reglas de CLAUDE.md) y corrige lo que esté mal. Úsala cuando el usuario pida revisar, ordenar, arreglar errores o comprobar que todo está bien.
---

# Revisar el proyecto Neon Snake

Sigue estos pasos en orden. Lee primero `CLAUDE.md`: es la fuente de verdad de las reglas.

## 1. ¿Arranca todo?

Ejecuta y anota cualquier error:

```bash
cd client && npm install && npm run build
cd ../server && npm install && npm run build
cd ../server && npx prisma validate
```

Si Docker está encendido, comprueba también la base de datos:

```bash
docker compose up -d
cd server && npx prisma migrate status
```

Corrige cada error de compilación antes de seguir. Explica al usuario, en una línea y en español, qué causaba cada uno.

## 2. ¿Está todo en su sitio?

Compara el árbol de carpetas con la sección "Estructura" de `CLAUDE.md`:

- Cada pantalla es una vista en `client/src/views/` con nombre `XxxView.vue`.
- Todo lo de Phaser está en `client/src/game/`; las medidas del tablero solo en `constants.ts`.
- Phaser y Vue se comunican solo con `EventBus`. Busca imports cruzados (`grep -r "from 'vue'" client/src/game` debe estar vacío).
- Rutas del servidor bajo `/api`.
- No hay archivos sueltos, duplicados ni de plantilla (`HelloWorld.vue`, `vite.svg`, carpetas `dist/` subidas).

Mueve o renombra lo que esté fuera de lugar y actualiza los imports.

## 3. ¿Se ve como en Figma?

- Busca colores escritos a mano: `grep -rnE "#[0-9a-fA-F]{3,6}" client/src --include=*.vue` y cámbialos por las variables de `style.css` (la escena de Phaser sí usa números `0x...`, eso es correcto).
- Los botones usan `.btn` / `.btn--primario`.
- Títulos con `--fuente-titulo`, el resto con `--fuente-cuerpo`.
- Compara cada vista con su imagen en `docs/mockups/` y anota diferencias grandes.

## 4. ¿El código está limpio?

- Sin `any` innecesarios, sin `console.log` olvidados, sin código comentado.
- Textos del juego en español, sin faltas de ortografía.
- Nada de lo que `CLAUDE.md` marca como fuera del alcance.

## 5. Informe final

Termina con un resumen corto en español para el usuario:

1. Errores encontrados y cómo se arreglaron.
2. Cosas que moviste u ordenaste.
3. Lo que queda pendiente y necesita una decisión suya.

Vuelve a ejecutar los dos `npm run build` al final para confirmar que todo compila. No hagas `git push` sin que el usuario lo pida; si lo pide, un commit por tipo de cambio con mensaje en español.
