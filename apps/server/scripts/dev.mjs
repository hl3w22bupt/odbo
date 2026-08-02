/**
 * 心伴AI 开发启动脚本
 * 1. 启动 iii 引擎（config.yaml）
 * 2. 等待引擎 WebSocket 端口就绪
 * 3. 启动 TypeScript Worker（tsx watch）
 *
 * 用法：npm run dev
 */
import { spawn } from 'node:child_process'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
dotenv.config({ path: path.join(root, '.env') })

const III_URL = process.env.III_URL ?? 'ws://localhost:49144'
const HTTP_PORT = process.env.HTTP_PORT ?? '3888'
const match = III_URL.match(/:(\d+)/)
const WS_PORT = match ? Number(match[1]) : 49134

const children = []

function log(prefix, msg) {
  console.log(`\x1b[36m[${prefix}]\x1b[0m ${msg}`)
}

function isPortOpen(port, host = '127.0.0.1', timeout = 800) {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(timeout)
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.once('error', () => {
      socket.destroy()
      resolve(false)
    })
    socket.connect(port, host)
  })
}

async function waitForPort(port, label, attempts = 120) {
  for (let i = 0; i < attempts; i += 1) {
    const open = await isPortOpen(port)
    if (open) {
      log('engine', `${label} :${port} 已就绪`)
      return true
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`等待 ${label} :${port} 超时`)
}

async function main() {
  // 1. 启动 iii 引擎（若端口已被占用则跳过）
  const enginePortBusy = await isPortOpen(WS_PORT)
  if (!enginePortBusy) {
    log('engine', `启动 iii 引擎 config.yaml (ws://localhost:${WS_PORT})`)
    const engine = spawn('iii', ['-c', 'config.yaml'], {
      cwd: root,
      stdio: ['inherit', 'pipe', 'pipe'],
      env: { ...process.env },
    })
    children.push(engine)
    engine.stdout.on('data', (d) => process.stdout.write(`\x1b[2m[engine]\x1b[0m ${d}`))
    engine.stderr.on('data', (d) => process.stderr.write(`\x1b[33m[engine]\x1b[0m ${d}`))
    engine.on('exit', (code) => {
      log('engine', `引擎退出 code=${code}`)
      shutdown(code ?? 1)
    })
    await waitForPort(WS_PORT, '引擎 WebSocket')
  } else {
    log('engine', `:${WS_PORT} 已被占用，复用已运行的引擎`)
  }

  // 2. 启动 Worker
  log('worker', `连接 ${III_URL}`)
  const worker = spawn('npx', ['tsx', 'watch', 'src/index.ts'], {
    cwd: root,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, III_URL },
  })
  children.push(worker)
  worker.stdout.on('data', (d) => process.stdout.write(`\x1b[2m[worker]\x1b[0m ${d}`))
  worker.stderr.on('data', (d) => process.stderr.write(`\x1b[31m[worker]\x1b[0m ${d}`))
  worker.on('exit', (code) => {
    log('worker', `Worker 退出 code=${code}`)
    shutdown(code ?? 1)
  })

  log('ready', `HTTP API: http://localhost:${HTTP_PORT}  ·  Worker: ${III_URL}`)
}

function shutdown(code = 0) {
  log('dev', '正在停止子进程…')
  for (const child of children) {
    if (!child.killed) {
      try {
        child.kill('SIGTERM')
      } catch {
        /* noop */
      }
    }
  }
  setTimeout(() => process.exit(code), 500)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

main().catch((err) => {
  console.error(err)
  shutdown(1)
})
