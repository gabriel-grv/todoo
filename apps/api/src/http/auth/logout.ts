import type { fastifyTypedInstance } from '../../types.ts'
import { auth } from '../../lib/auth.ts'
import { fromNodeHeaders } from 'better-auth/node'

export default async function logoutRoutes(app: fastifyTypedInstance) {
  app.post('/logout', {
    schema: { tags: ['auth'] },
  }, async (request, reply) => {
    const { headers, response } = await auth.api.signOut({
      headers: fromNodeHeaders(request.headers as any),
      returnHeaders: true,
    })
    const cookies = (headers as any).getSetCookie?.()
    if (cookies && cookies.length) reply.header('set-cookie', cookies)
    return reply.send(response)
  })
}

