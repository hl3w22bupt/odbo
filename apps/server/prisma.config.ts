import dotenv from 'dotenv'
import path from 'node:path'
import { defineConfig } from '@prisma/config'

dotenv.config({ override: process.env.NODE_ENV !== 'production' })

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  },
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
})
