/**
 * 心伴AI · 形象照片生成路由
 * 接收「角色名/发型/穿搭/音色」描述，调用图像供应商生成专属形象。
 */
import { prisma } from '../db.js'
import type { HttpRouter, HttpRouteContext } from '../http.js'
import { ok } from '../lib/response.js'
import { authenticate } from '../http.js'
import { AppError } from '../lib/errors.js'
import { audit } from '../lib/audit.js'
import { buildPortraitPrompt, getImageProvider, placeholderAvatarUrl } from '../lib/image.js'
import { hasActiveMembership } from '../lib/quota.js'

async function generateImage(ctx: HttpRouteContext) {
  const user = await authenticate(ctx)
  const body = ctx.body as {
    characterId?: string
    characterName?: string
    hairstyle?: string
    outfit?: string
    voice?: string
  }

  const characterId = body.characterId
  let basePersona = '女性AI陪伴角色'
  let name = body.characterName ?? '心伴'

  if (characterId) {
    const character = await prisma.character.findUnique({ where: { id: characterId } })
    if (!character) throw AppError.notFound('角色不存在')
    const isMember = await hasActiveMembership(user.id)
    if (character.isMemberOnly && !isMember) {
      throw AppError.memberRequired('该角色为会员专属')
    }
    name = character.name
    basePersona = `${character.title}·${character.occupation}`
  }

  const prompt = buildPortraitPrompt({
    characterName: name,
    basePersona,
    ...(body.hairstyle !== undefined ? { hairstyle: body.hairstyle } : {}),
    ...(body.outfit !== undefined ? { outfit: body.outfit } : {}),
  })

  let url: string
  let provider: string
  try {
    const result = await getImageProvider().generate({
      prompt,
      characterName: name,
    })
    url = result.url
    provider = result.provider
  } catch {
    url = placeholderAvatarUrl(name, [body.hairstyle, body.outfit].filter(Boolean).join(','))
    provider = 'placeholder'
  }

  await audit('IMAGE_GENERATE', {
    userId: user.id,
    ip: ctx.ip ?? null,
    detail: { characterId, characterName: name, provider },
  })

  return ok(
    {
      url,
      provider,
      prompt,
      expiresIn: 3600,
    },
    '形象生成成功',
  )
}

export function registerImageRoutes(router: HttpRouter): void {
  router.define('images::generate', '/api/v1/images/generate', 'POST', generateImage)
}
