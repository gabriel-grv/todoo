import type { fastifyTypedInstance } from '../../types.ts'
import { SignUpBodySchema } from './types.ts'
import { auth } from '../../lib/auth.ts'
import { fromNodeHeaders } from 'better-auth/node'
import { prisma } from '../../lib/prisma.ts'

export default async function signInRoutes(app: fastifyTypedInstance) {
  app.post('/sign-in/email', {
    schema: {
      tags: ['auth'],
      body: SignUpBodySchema,
    },
  }, async (request, reply) => {
    const { name, email, password, image, callbackURL, role } = SignUpBodySchema.parse(request.body)
    const { headers, response } = await auth.api.signUpEmail({
      body: { name, email: email.toLowerCase(), password, image, callbackURL },
      headers: fromNodeHeaders(request.headers as any),
      returnHeaders: true,
    })
    const cookies = (headers as any).getSetCookie?.()
    request.log.info({ cookies }, 'set-cookie headers for /v1/auth/sign-in')
    if (cookies && cookies.length) reply.header('set-cookie', cookies)

    if (role && response?.user?.id) {
      await prisma.user.update({
        where: { id: response.user.id },
        data: { role },
      })
    }

    return reply.send(response)
  })
}

