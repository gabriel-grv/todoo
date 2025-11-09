/* eslint-disable no-console */
const { spawn } = require('node:child_process')

const API_URL = process.env.API_URL || 'http://localhost:3001'
const SWAGGER_JSON = `${API_URL}/docs/json`
const NPM_CMD = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForSwagger(timeoutMs = 30000, intervalMs = 1000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(SWAGGER_JSON, { cache: 'no-store' })
      if (res.ok) return true
    } catch (_) {}
    await wait(intervalMs)
  }
  return false
}

async function main() {
  // 1) Se já houver API rodando, usa ela
  const alreadyRunning = await waitForSwagger(1_000, 250)
  if (alreadyRunning) {
    console.log(`[gen] API detectada em ${API_URL}. Gerando usando ela...`)
    await new Promise((resolve, reject) => {
      const gen = spawn(NPM_CMD, ['run', 'generate:client'], {
        stdio: 'inherit',
        env: { ...process.env, KUBB_OPENAPI_URL: SWAGGER_JSON },
        shell: process.platform === 'win32',
      })
      gen.on('exit', (code) => {
        if (typeof code === 'number' && code !== 0) return reject(new Error(`kubb saiu com código ${code}`))
        resolve()
      })
      gen.on('error', reject)
    })
    return
  }

  // 2) Caso contrário, sobe API temporária em outra porta (evita conflito com dev)
  const TEMP_PORT = process.env.API_TEMP_PORT || '4001'
  const tempApiUrl = `http://localhost:${TEMP_PORT}`
  console.log(`[gen] Subindo API temporária em ${tempApiUrl} ...`)
  const apiProc = spawn(NPM_CMD, ['run', 'dev', '-w', 'apps/api'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: TEMP_PORT, HOST: '127.0.0.1' },
    shell: process.platform === 'win32',
  })

  const ready = await (async () => {
    const url = `${tempApiUrl}/docs/json`
    const start = Date.now()
    while (Date.now() - start < 30_000) {
      try {
        const res = await fetch(url, { cache: 'no-store' })
        if (res.ok) return true
      } catch (_) {}
      await wait(1_000)
    }
    return false
  })()

  if (!ready) {
    console.error(`[gen] Swagger não ficou disponível em ${tempApiUrl}/docs/json a tempo.`)
    apiProc.kill('SIGTERM')
    process.exit(1)
  }

  console.log(`[gen] Swagger pronto em ${tempApiUrl}. Gerando cliente/hooks com Kubb...`)
  await new Promise((resolve, reject) => {
    const gen = spawn(NPM_CMD, ['run', 'generate:client'], {
      stdio: 'inherit',
      env: { ...process.env, KUBB_OPENAPI_URL: `${tempApiUrl}/docs/json` },
      shell: process.platform === 'win32',
    })
    gen.on('exit', (code) => {
      if (typeof code === 'number' && code !== 0) return reject(new Error(`kubb saiu com código ${code}`))
      resolve()
    })
    gen.on('error', reject)
  })

  console.log(`[gen] Geração concluída. Encerrando API temporária...\n`)
  apiProc.kill('SIGTERM')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})


