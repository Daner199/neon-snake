// Crea los modos de juego. Ejecutar con: npm run db:seed
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.gameMode.upsert({
    where: { code: 'arena' },
    update: { name: 'Arena' },
    create: { code: 'arena', name: 'Arena' },
  })
  await prisma.gameMode.upsert({
    where: { code: 'classic' },
    update: {},
    create: { code: 'classic', name: 'Clásico' },
  })
  // Las partidas en línea las guarda el propio servidor (src/online/Room.ts)
  await prisma.gameMode.upsert({
    where: { code: 'online' },
    update: {},
    create: { code: 'online', name: 'En línea' },
  })
  console.log('Modos de juego listos')
}

main().finally(() => prisma.$disconnect())
