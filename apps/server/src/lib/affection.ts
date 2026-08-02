/**
 * 心伴AI · 好感度系统
 * 好感度 value → 等级 level；进度条 = 当前级内进度。
 */
import { prisma } from '../db.js'

export const AFFECTION_LEVEL_STEPS = 100 // 每级所需好感度

export interface AffectionInfo {
  value: number
  level: number
  progress: number // 0-1 当前级内进度
  nextLevelAt: number
}

export function computeAffectionInfo(value: number): AffectionInfo {
  const level = Math.max(1, Math.floor(value / AFFECTION_LEVEL_STEPS) + 1)
  const inLevel = value % AFFECTION_LEVEL_STEPS
  return {
    value,
    level,
    progress: inLevel / AFFECTION_LEVEL_STEPS,
    nextLevelAt: (level) * AFFECTION_LEVEL_STEPS,
  }
}

export async function getAffection(userId: string, characterId: string): Promise<AffectionInfo> {
  const row = await prisma.affection.findUnique({
    where: { userId_characterId: { userId, characterId } },
  })
  return computeAffectionInfo(row?.value ?? 0)
}

/**
 * 好感度增减。返回更新后的好感度信息。
 */
export async function changeAffection(
  userId: string,
  characterId: string,
  delta: number,
): Promise<AffectionInfo> {
  const row = await prisma.affection.upsert({
    where: { userId_characterId: { userId, characterId } },
    update: { value: { increment: delta } },
    create: { userId, characterId, value: Math.max(0, delta) },
  })
  return computeAffectionInfo(row.value)
}

export async function getAffectionsForUser(
  userId: string,
  characterIds: string[],
): Promise<Record<string, AffectionInfo>> {
  const rows = await prisma.affection.findMany({
    where: { userId, characterId: { in: characterIds } },
  })
  const result: Record<string, AffectionInfo> = {}
  for (const cid of characterIds) {
    const row = rows.find((r) => r.characterId === cid)
    result[cid] = computeAffectionInfo(row?.value ?? 0)
  }
  return result
}
