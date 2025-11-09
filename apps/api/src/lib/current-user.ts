import type { FastifyRequest } from 'fastify'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from './auth.ts'
import { prisma } from './prisma.ts'

export type RequestUser = {
  id: string
  name: string | null
  email: string
  role: 'ADMIN' | 'USER'
}

export async function getCurrentUser(request: FastifyRequest): Promise<RequestUser | null> {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers as any),
    })

    const session = sessionResponse?.session
    const sessionUserId = session?.userId ?? sessionResponse?.user?.id
    if (!sessionUserId) {
      request.log?.warn?.(
        {
          cookie: request.headers?.cookie,
          referer: request.headers?.referer,
        },
        'getCurrentUser: sessão ausente ou inválida',
      )
      return null
    }
    request.log?.debug?.(
      {
        sessionId: session?.id,
        userId: sessionUserId,
      },
      'getCurrentUser: sessão válida recebida',
    )

    const user = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    })

    if (!user) return null
    return user
  } catch (error) {
    request.log?.error?.({ error }, 'getCurrentUser failed')
    return null
  }
}

