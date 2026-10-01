/**
 * 心伴AI · Prisma 客户端
 * Prisma 7 使用驱动适配器连接数据库（默认 PostgreSQL / @prisma/adapter-pg）。
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from './generated/prisma/client.js'
import { config } from './config.js'

function createPrisma(): PrismaClient {
  const adapter = config.databaseUrl.startsWith('file:')
    ? new PrismaBetterSqlite3({ url: config.databaseUrl })
    : new PrismaPg({ connectionString: config.databaseUrl })
  return new PrismaClient({ adapter: adapter as never })
}

declare global {
  // eslint-disable-next-line no-var
  var __xinbanPrisma: PrismaClient | undefined
}

/**
 * 单例 PrismaClient。开发期热重载（tsx watch）复用同一实例，避免连接泄漏。
 */
export const prisma: PrismaClient = globalThis.__xinbanPrisma ?? createPrisma()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__xinbanPrisma = prisma
}

export default prisma
