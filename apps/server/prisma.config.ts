import dotenv from 'dotenv'
import path from 'node:path'
import { defineConfig } from '@prisma/config'

dotenv.config()

// v0.1 固定 SQLite：避免外部 DATABASE_URL 指向其他生产库。
if (!process.env.DATABASE_URL?.startsWith('file:')) {
  process.env.DATABASE_URL = 'file:./data/xinban-dev.db'
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./data/xinban.db',
  },
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
})
