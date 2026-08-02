/**
 * 心伴AI · 角色（人设）路由
 * 列表（含会员访问控制）/ 详情 / 形象与命名定制
 */
import { prisma } from '../db.js'
import type { HttpRouter, HttpRouteContext } from '../http.js'
import { ok } from '../lib/response.js'
import { authenticate } from '../http.js'
import { AppError } from '../lib/errors.js'
import { audit } from '../lib/audit.js'
import { getAffectionsForUser } from '../lib/affection.js'
import { DIALECT_LABEL, TYPE_LABEL } from '../lib/characters.js'
import { hasActiveMembership } from '../lib/quota.js'
import { buildPortraitPrompt, getImageProvider, placeholderAvatarUrl } from '../lib/image.js'

function serializeCharacter(character: {
  id: string
  name: string
  title: string
  type: string
  tier: string
  isMemberOnly: boolean
  dialect: string
  occupation: string
  personality: string
  greeting: string
  avatarUrl: string | null
  voice: string | null
  tags: string
  config: string
  customName?: string | null
}) {
  return {
    id: character.id,
    name: character.customName || character.name,
    title: character.title,
    type: character.type,
    typeLabel: TYPE_LABEL[character.type] ?? character.type,
    tier: character.tier,
    isMemberOnly: character.isMemberOnly,
    dialect: character.dialect,
    dialectLabel: DIALECT_LABEL[character.dialect] ?? character.dialect,
    occupation: character.occupation,
    personality: character.personality,
    greeting: character.greeting,
    avatarUrl: character.avatarUrl,
    voice: character.voice,
    tags: character.tags ? character.tags.split(',').filter(Boolean) : [],
    config: safeJson(character.config),
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}

async function listCharacters(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const isMember = await hasActiveMembership(user.id)
  const query = ctx.query

  const where: Record<string, unknown> = { status: 'ACTIVE' }
  if (query.tier === 'FREE') where.tier = 'FREE'
  if (query.type) where.type = query.type

  const [characters, customizations, affections] = await Promise.all([
    prisma.character.findMany({ where, orderBy: { createdAt: 'asc' } }),
    prisma.characterCustomization.findMany({ where: { userId: user.id } }),
    getAffectionsForUser(
      user.id,
      (await prisma.character.findMany({ where, select: { id: true } })).map((c) => c.id),
    ),
  ])

  const customByCharacter = new Map(customizations.map((c) => [c.characterId, c]))

  const data = characters.map((c) => {
    const custom = customByCharacter.get(c.id)
    const serialized = serializeCharacter({ ...c, customName: custom?.customName ?? null })
    return {
      ...serialized,
      locked: c.isMemberOnly && !isMember,
      unlockHint: c.isMemberOnly && !isMember ? '会员专属角色，开通会员即可解锁' : undefined,
      affection: affections[c.id] ?? { value: 0, level: 1, progress: 0 },
      customized: Boolean(custom),
    }
  })

  return ok(data)
}

async function characterDetail(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const id = ctx.params.id
  if (!id) throw AppError.badRequest('缺少角色 id')
  const character = await prisma.character.findUnique({ where: { id } })
  if (!character || character.status !== 'ACTIVE') throw AppError.notFound('角色不存在')

  const isMember = await hasActiveMembership(user.id)
  if (character.isMemberOnly && !isMember) {
    throw AppError.memberRequired('该角色为会员专属，开通会员后可解锁')
  }

  const [custom, affection] = await Promise.all([
    prisma.characterCustomization.findUnique({ where: { userId_characterId: { userId: user.id, characterId: id } } }),
    getAffectionsForUser(user.id, [id]),
  ])

  return ok({
    ...serializeCharacter({ ...character, customName: custom?.customName ?? null }),
    customized: custom
      ? {
          customName: custom.customName,
          hairstyle: custom.hairstyle,
          outfit: custom.outfit,
          voice: custom.voice,
          avatarUrl: custom.avatarUrl,
        }
      : null,
    affection: affection[id],
  })
}

async function getCustomization(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const id = ctx.params.id
  if (!id) throw AppError.badRequest('缺少角色 id')
  const character = await prisma.character.findUnique({ where: { id } })
  if (!character || character.status !== 'ACTIVE') throw AppError.notFound('角色不存在')
  const custom = await prisma.characterCustomization.findUnique({
    where: { userId_characterId: { userId: user.id, characterId: id } },
  })
  return ok(
    custom
      ? {
          customName: custom.customName,
          hairstyle: custom.hairstyle,
          outfit: custom.outfit,
          voice: custom.voice,
          avatarUrl: custom.avatarUrl,
          config: safeJson(custom.config),
        }
      : null,
  )
}

/**
 * 形象与命名定制：角色名 / 发型 / 穿搭 / 音色 + 照片生成专属形象
 */
async function customizeCharacter(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const id = ctx.params.id
  if (!id) throw AppError.badRequest('缺少角色 id')
  const character = await prisma.character.findUnique({ where: { id } })
  if (!character || character.status !== 'ACTIVE') throw AppError.notFound('角色不存在')

  const isMember = await hasActiveMembership(user.id)
  if (character.isMemberOnly && !isMember) {
    throw AppError.memberRequired('该角色为会员专属，开通会员后可定制')
  }

  const body = ctx.body as {
    customName?: string
    hairstyle?: string
    outfit?: string
    voice?: string
    generateImage?: boolean
  }

  const customName = typeof body.customName === 'string' ? body.customName.trim().slice(0, 12) : undefined
  const hairstyle = typeof body.hairstyle === 'string' ? body.hairstyle.trim().slice(0, 50) : undefined
  const outfit = typeof body.outfit === 'string' ? body.outfit.trim().slice(0, 50) : undefined
  const voice = typeof body.voice === 'string' ? body.voice.trim().slice(0, 50) : undefined

  if (!customName && !hairstyle && !outfit && !voice) {
    throw AppError.badRequest('至少提供一项定制内容')
  }

  const existing = await prisma.characterCustomization.findUnique({
    where: { userId_characterId: { userId: user.id, characterId: id } },
  })

  // 生成专属形象（可选）
  let avatarUrl: string | null = existing?.avatarUrl ?? null
  if (body.generateImage !== false) {
    const prompt = buildPortraitPrompt({
      characterName: customName || character.name,
      basePersona: `${character.title}·${character.occupation}`,
      ...(hairstyle !== undefined ? { hairstyle } : {}),
      ...(outfit !== undefined ? { outfit } : {}),
    })
    try {
      const img = await getImageProvider().generate({ prompt, characterName: customName || character.name })
      avatarUrl = img.url
    } catch {
      avatarUrl = placeholderAvatarUrl(customName || character.name, [hairstyle, outfit].filter(Boolean).join(','))
    }
  }

  const data = {
    customName: customName ?? existing?.customName ?? null,
    hairstyle: hairstyle ?? existing?.hairstyle ?? null,
    outfit: outfit ?? existing?.outfit ?? null,
    voice: voice ?? existing?.voice ?? null,
    avatarUrl,
  }

  const saved = existing
    ? await prisma.characterCustomization.update({ where: { id: existing.id }, data })
    : await prisma.characterCustomization.create({
        data: { userId: user.id, characterId: id, ...data },
      })

  await audit('CUSTOMIZE', {
    userId: user.id,
    ip: ctx.ip ?? null,
    detail: { characterId: id, customName, hairstyle, outfit, voice },
  })

  return ok({
    id: saved.id,
    customName: saved.customName,
    hairstyle: saved.hairstyle,
    outfit: saved.outfit,
    voice: saved.voice,
    avatarUrl: saved.avatarUrl,
  }, '定制已保存')
}

export function registerCharacterRoutes(router: HttpRouter): void {
  router.define('characters::list', '/api/v1/characters', 'GET', listCharacters)
  router.define('characters::detail', '/api/v1/characters/:id', 'GET', characterDetail)
  router.define('characters::customization-get', '/api/v1/characters/:id/customization', 'GET', getCustomization)
  router.define('characters::customize', '/api/v1/characters/:id/customize', 'POST', customizeCharacter)
}
