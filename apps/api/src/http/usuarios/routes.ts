import type { fastifyTypedInstance } from '../../types.ts'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.ts'
import { randomUUID } from 'node:crypto'
import { createAbilityFor, subject } from '../../lib/casl.ts'
import { getCurrentUser } from '../../lib/current-user.ts'

export default async function usuariosRoutes(app: fastifyTypedInstance) {
  const roleSchema = z.union([z.literal('ADMIN'), z.literal('USER')])
  const userResponseSchema = z.object({
    id: z.string(),
    nome: z.string(),
    email: z.string().email(),
    role: roleSchema,
  })

  // Listar usuários (campos essenciais)
  app.get('/users', {
    schema: {
      operationId: 'listUsers',
      description: 'Lista todos os usuários',
      tags: ['usuarios'],
      response: {
        200: z.array(userResponseSchema),
        401: z.object({ error: z.string() }),
        403: z.object({ error: z.string() }),
      },
    },
  }, async (request, reply) => {
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return reply.status(401).send({ error: 'Não autenticado' })
    }
    if (currentUser.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Usuário não autorizado a listar usuários' })
    }

    const usuarios = await prisma.user.findMany({
      orderBy: { id: 'desc' },
      select: { id: true, name: true, email: true, role: true },
    })
    return usuarios.map((u) => ({
      id: u.id,
      nome: u.name ?? '',
      email: u.email,
      role: u.role,
    }))
  })

  // Buscar um usuário por ID
  app.get('/users/:id', {
    schema: {
      operationId: 'getUser',
      description: 'Busca um usuário pelo ID',
      tags: ['usuarios'],
      params: z.object({ id: z.string() }),
      response: {
        200: userResponseSchema,
        404: z.object({ error: z.string() }),
        401: z.object({ error: z.string() }),
        403: z.object({ error: z.string() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return reply.status(401).send({ error: 'Não autenticado' })
    }
    const ability = createAbilityFor(currentUser)
    if (!ability.can('read', subject('User', { id }))) {
      return reply.status(403).send({ error: 'Usuário não autorizado a visualizar este usuário' })
    }

    const usuario = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true } })
    if (!usuario) return reply.status(404).send({ error: 'Usuário não encontrado' })
    return { id: usuario.id, nome: usuario.name ?? '', email: usuario.email, role: usuario.role }
  })

  // Criar usuário
  app.post('/users', {
    schema: {
      operationId: 'createUser',
      description: 'Cria um usuário',
      tags: ['usuarios'],
      body: z.object({
        nome: z.string().min(1),
        email: z.string().email(),
        role: roleSchema.optional(),
      }),
      response: {
        201: z.object({ id: z.string(), message: z.string(), role: roleSchema }),
        401: z.object({ error: z.string() }),
        403: z.object({ error: z.string() }),
      },
    },
  }, async (request, reply) => {
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return reply.status(401).send({ error: 'Não autenticado' })
    }
    const ability = createAbilityFor(currentUser)
    if (!ability.can('create', 'User')) {
      return reply.status(403).send({ error: 'Usuário não autorizado a criar usuários' })
    }

    const { nome, email, role } = request.body
    const created = await prisma.user.create({
      data: { id: randomUUID(), name: nome, email, role: role ?? 'USER' },
    })
    return reply.status(201).send({ id: created.id, role: created.role, message: 'Usuário criado com sucesso' })
  })

  // Atualizar usuário
  app.put('/users/:id', {
    schema: {
      operationId: 'updateUser',
      description: 'Atualiza um usuário',
      tags: ['usuarios'],
      params: z.object({ id: z.string() }),
      body: z.object({
        nome: z.string().min(1).optional(),
        email: z.string().email().optional(),
        role: roleSchema.optional(),
      }),
      response: {
        200: z.object({ message: z.string() }),
        404: z.object({ error: z.string() }),
        401: z.object({ error: z.string() }),
        403: z.object({ error: z.string() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params
    const { nome, email, role } = request.body
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return reply.status(401).send({ error: 'Não autenticado' })
    }
    const ability = createAbilityFor(currentUser)

    const exists = await prisma.user.findUnique({ where: { id } })
    if (!exists) return reply.status(404).send({ error: 'Usuário não encontrado' })

    if (!ability.can('update', subject('User', { id }))) {
      return reply.status(403).send({ error: 'Usuário não autorizado a atualizar este usuário' })
    }

    if (role && currentUser.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Somente administradores podem alterar a role de um usuário' })
    }

    await prisma.user.update({
      where: { id },
      data: {
        name: nome ?? undefined,
        email: email ?? undefined,
        role: role ?? undefined,
      },
    })
    return { message: 'Usuário atualizado com sucesso' }
  })

  // Deletar usuário
  app.delete('/users/:id', {
    schema: {
      operationId: 'deleteUser',
      description: 'Deleta um usuário',
      tags: ['usuarios'],
      params: z.object({ id: z.string() }),
      response: {
        200: z.object({ message: z.string() }),
        404: z.object({ error: z.string() }),
        401: z.object({ error: z.string() }),
        403: z.object({ error: z.string() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return reply.status(401).send({ error: 'Não autenticado' })
    }
    if (currentUser.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Somente administradores podem remover usuários' })
    }

    const exists = await prisma.user.findUnique({ where: { id } })
    if (!exists) return reply.status(404).send({ error: 'Usuário não encontrado' })
    await prisma.user.delete({ where: { id } })
    return { message: 'Usuário deletado com sucesso' }
  })
}


