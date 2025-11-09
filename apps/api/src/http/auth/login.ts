import type { fastifyTypedInstance } from '../../types.ts'
import { LoginBodySchema } from './types.ts'
import { auth } from '../../lib/auth.ts'
import { fromNodeHeaders } from 'better-auth/node'

export default async function loginRoutes(app: fastifyTypedInstance) {
  app.post('/login', {
    schema: {
      tags: ['auth'],
      body: LoginBodySchema,
    },
  }, async (request, reply) => {
    const { email, password, rememberMe, callbackURL } = LoginBodySchema.parse(request.body)
    const { headers, response } = await auth.api.signInEmail({
      body: { email: email.toLowerCase(), password, rememberMe, callbackURL },
      headers: fromNodeHeaders(request.headers as any),
      returnHeaders: true,
    })
    const cookies = (headers as any).getSetCookie?.()
    request.log.info({ cookies }, 'set-cookie headers for /v1/auth/login')
    if (cookies && cookies.length) reply.header('set-cookie', cookies)
    return reply.send(response)
  })
}

