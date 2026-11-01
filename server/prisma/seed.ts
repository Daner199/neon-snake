// Crea los dos modos de juego. Ejecutar con: npm run db:seed
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
  console.log('Modos de juego listos')
}

main().finally(() => prisma.$disconnect())
