import { prisma } from '../db.js'

export const MODES = ['arena', 'classic'] as const
export type ModeCode = (typeof MODES)[number]

export const isMode = (value: unknown): value is ModeCode => MODES.includes(value as ModeCode)

export interface RankingRow {
  position: number
  username: string
  score: number
  botsKilled: number
}

const TOP = 10

// Top 10 del modo (solo la mejor partida terminada de cada usuario) y, si se indica, la fila de ese usuario
export async function getRanking(mode: ModeCode, userId: string | null) {
  const rows = await prisma.$queryRaw<
    { position: bigint; user_id: string; username: string; score: number; bots_killed: number }[]
  >`
    WITH best AS (
      SELECT DISTINCT ON (s.user_id) s.user_id, s.score, s.bots_killed, s.finished_at
      FROM game_sessions s
      JOIN game_modes m ON m.id = s.mode_id
      WHERE m.code = ${mode} AND s.status = 'finished' AND s.user_id IS NOT NULL
      ORDER BY s.user_id, s.score DESC, s.finished_at ASC
    ),
    ranked AS (
      SELECT b.*, u.username, ROW_NUMBER() OVER (ORDER BY b.score DESC, b.finished_at ASC) AS position
      FROM best b
      JOIN users u ON u.id = b.user_id
    )
    SELECT position, user_id, username, score, bots_killed
    FROM ranked
    WHERE position <= ${TOP} OR user_id = ${userId ?? ''}
    ORDER BY position
  `

  // El id interno no sale de la API: el cliente reconoce su fila por "me.position"
  const toRow = (r: (typeof rows)[number]): RankingRow => ({
    position: Number(r.position),
    username: r.username,
    score: r.score,
    botsKilled: r.bots_killed,
  })
  const mine = rows.find((r) => r.user_id === userId)
  return {
    top: rows.filter((r) => Number(r.position) <= TOP).map(toRow),
    me: mine ? toRow(mine) : null,
  }
}
