/**
 * 心伴AI · 简易结构化日志
 */
const LEVELS = ['debug', 'info', 'warn', 'error'] as const
type Level = (typeof LEVELS)[number]

function ts(): string {
  return new Date().toISOString()
}

function emit(level: Level, msg: string, meta?: unknown): void {
  const line = `[${ts()}] [${level.toUpperCase()}] ${msg}${meta !== undefined ? ` ${JSON.stringify(meta)}` : ''}`
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  debug: (msg: string, meta?: unknown) => emit('debug', msg, meta),
  info: (msg: string, meta?: unknown) => emit('info', msg, meta),
  warn: (msg: string, meta?: unknown) => emit('warn', msg, meta),
  error: (msg: string, meta?: unknown) => emit('error', msg, meta),
}
