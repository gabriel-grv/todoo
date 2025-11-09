import type { FastifyReply, FastifyRequest } from 'fastify'

const defaultPort = Number(process.env.PORT ?? 3001)
const rawAuthBaseURL = process.env.AUTH_BASE_URL ?? `http://localhost:${defaultPort}/api/auth`
const authBaseURL = rawAuthBaseURL.endsWith('/') ? rawAuthBaseURL : `${rawAuthBaseURL}/`

type ForwardOptions = {
  targetPath?: string
  method?: string
  body?: unknown
}

export async function forwardToBetterAuth(request: FastifyRequest, reply: FastifyReply, options: ForwardOptions) {
  // Determina caminho-alvo e corpo com base na URL original quando targetPath não for informado
  const originalUrl = new URL(request.url, 'http://localhost')
  const originalPath = originalUrl.pathname

  let targetPath = options.targetPath
  let method = (options.method || request.method || 'GET').toUpperCase()
  let body: unknown = options.body

  if (!targetPath) {
    switch (originalPath) {
      case '/v1/auth/emailotp': {
        targetPath = '/api/auth/email-otp/send-verification-otp'
        method = 'POST'
        const reqBody = (request as any).body ?? {}
        const email = typeof reqBody.email === 'string' ? reqBody.email.toLowerCase() : ''
        const type = reqBody.type ?? 'sign-in'
        body = { email, type }
        break
      }
      case '/v1/auth/sign-in/emailotp': {
        targetPath = '/api/auth/sign-in/email-otp'
        method = 'POST'
        const reqBody = (request as any).body ?? {}
        const email = typeof reqBody.email === 'string' ? reqBody.email.toLowerCase() : ''
        const otp = reqBody.otp
        body = { email, otp }
        break
      }
      case '/v1/auth/logout': {
        targetPath = '/api/auth/sign-out'
        method = 'POST'
        body = undefined
        break
      }
      default: {
        // fallback: mantém o caminho original
        targetPath = originalPath
      }
    }
  }

  const finalTarget = targetPath ?? originalPath
  const url = finalTarget?.startsWith('http')
    ? new URL(`${finalTarget}${originalUrl.search}`)
    : new URL(`${finalTarget}${originalUrl.search}`, authBaseURL)

  request.log?.info?.({
    originalPath,
    targetPath: finalTarget,
    resolvedUrl: url.toString(),
  }, 'forwardToBetterAuth')

  // Copia cabeçalhos relevantes, incluindo cookies
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  const cookie = request.headers['cookie']
  if (cookie && typeof cookie === 'string') headers['cookie'] = cookie
  const authorization = request.headers['authorization']
  if (authorization && typeof authorization === 'string') headers['authorization'] = authorization

  const init: RequestInit = {
    method,
    headers,
    // Só envia body em métodos com payload
    body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(body ?? {}),
    // Assegura que cookies sejam enviados quando o Node respeitar cookies (aqui propagamos via header manualmente)
  }

  const res = await fetch(url.toString(), init)

  // Propaga status
  reply.status(res.status)

  // Propaga headers, cuidando de múltiplos Set-Cookie
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      const cookies = res.headers.getSetCookie()
      if (cookies && cookies.length) reply.header('set-cookie', cookies)
    } else {
      // Evita reescrever content-length incorreto
      if (key.toLowerCase() !== 'content-length') reply.header(key, value)
    }
  })

  // Tenta enviar JSON; fallback para texto
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const data = await res.json().catch(() => null)
    return reply.send(data ?? null)
  }
  const text = await res.text().catch(() => '')
  return reply.send(text)
}

// Utilitário opcional para verificar Cloudflare Turnstile
export async function verifyTurnstileToken(token?: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!token) return true // sem token, não valida
  if (!secret) return false // solicitou validação, mas sem secret
  const form = new URLSearchParams()
  form.set('secret', secret)
  form.set('response', token)
  try {
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    })
    const json = (await resp.json()) as { success?: boolean }
    return !!json.success
  } catch {
    return false
  }
}


