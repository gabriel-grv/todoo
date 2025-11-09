import type { fastifyTypedInstance } from '../../types.ts'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.ts'
import { createAbilityFor, subject } from '../../lib/casl.ts'
import { getCurrentUser } from '../../lib/current-user.ts'

export default async function tarefasRoutes(app: fastifyTypedInstance) {
  const roleSchema = z.union([z.literal('ADMIN'), z.literal('USER')])
  const taskResponseSchema = z.object({
    id: z.string(),
    titulo: z.string(),
    descricao: z.string(),
    completo: z.boolean(),
    userId: z.string(),
    owner: z.object({
      id: z.string(),
      nome: z.string().nullable(),
      email: z.string().email(),
      role: roleSchema,
    }),
  })

  app.get('/tasks', {
    schema: {
      operationId: 'listTasks',
      description: 'Lista tarefas do usuário',
      tags: ['tarefas'],
      querystring: z.object({
        userId: z.string().min(1).optional(),
      }).optional(),
      response: {
        200: z.array(taskResponseSchema),
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
    if (!ability.can('read', 'Task')) {
      return reply.status(403).send({ error: 'Usuário não autorizado a listar tarefas' })
    }

    const { userId } = request.query ?? {}
    const where =
      currentUser.role === 'ADMIN'
        ? userId
          ? { userId }
          : undefined
        : { userId: currentUser.id }

    const tarefas = await prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })
    return tarefas.map((tarefa) => ({
      id: tarefa.id,
      titulo: tarefa.titulo,
      descricao: tarefa.descricao,
      completo: tarefa.completo,
      userId: tarefa.userId,
      owner: {
        id: tarefa.user.id,
        nome: tarefa.user.name ?? tarefa.user.email,
        email: tarefa.user.email,
        role: tarefa.user.role,
      },
    }))
  })

  app.post('/tasks', {
    schema: {
      operationId: 'createTask',
      description: 'Cria uma nova tarefa',
      tags: ['tarefas'],
      body: z.object({
        titulo: z.string(),
        descricao: z.string(),
        completo: z.boolean(),
        userId: z.string().min(1),
      }),
      response: {
        201: z.object({ message: z.string() }).describe('Tarefa criada com sucesso'),
        400: z.object({ error: z.string() }),
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

    const { titulo, descricao, completo, userId } = request.body

    if (!ability.can('create', subject('Task', { userId }))) {
      return reply.status(403).send({ error: 'Usuário não autorizado a criar tarefa para este usuário' })
    }

    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!userExists) {
      return reply.status(400).send({ error: 'Usuário não encontrado' })
    }

    await prisma.task.create({
      data: { titulo, descricao, completo, userId },
    })
    return reply.status(201).send({ message: 'Tarefa criada com sucesso' })
  })

  app.delete('/tasks/:id', {
    schema: {
      operationId: 'deleteTask',
      description: 'Deleta uma tarefa',
      tags: ['tarefas'],
      params: z.object({
        id: z.string(),
      }),
      response: {
        200: z.object({ message: z.string() }),
        403: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
        401: z.object({ error: z.string() }),
      },
    },
  }, async (request, reply) => {
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return reply.status(401).send({ error: 'Não autenticado' })
    }
    const ability = createAbilityFor(currentUser)

    const { id } = request.params
    const tarefa = await prisma.task.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })
    if (!tarefa) {
      return reply.status(404).send({ error: 'Tarefa não encontrada' })
    }

    if (!ability.can('delete', subject('Task', tarefa))) {
      return reply.status(403).send({ error: 'Usuário não autorizado a remover esta tarefa' })
    }
    await prisma.task.delete({ where: { id } })
    return reply.status(200).send({ message: 'Tarefa deletada com sucesso' })
  })

  app.put('/tasks/:id', {
    schema: {
      operationId: 'updateTask',
      description: 'Atualiza uma tarefa',
      tags: ['tarefas'],
      params: z.object({
        id: z.string(),
      }),
      body: z.object({
        titulo : z.string(),
        descricao : z.string(),
        completo : z.boolean(),
        userId: z.string().min(1),
      }),
      response: {
        200: z.object({ message: z.string() }),
        403: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
        401: z.object({ error: z.string() }),
      },
    },
  }, async (request, reply) => {
    const currentUser = await getCurrentUser(request)
    if (!currentUser) {
      return reply.status(401).send({ error: 'Não autenticado' })
    }
    const ability = createAbilityFor(currentUser)

    const { id } = request.params
    const { titulo, descricao, completo, userId } = request.body
    const tarefa = await prisma.task.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })
    if (!tarefa) {
      return reply.status(404).send({ error: 'Tarefa não encontrada' })
    }

    if (!ability.can('update', subject('Task', tarefa))) {
      return reply.status(403).send({ error: 'Usuário não autorizado a atualizar esta tarefa' })
    }

    const updatedSubject = { ...tarefa, userId }
    if (!ability.can('update', subject('Task', updatedSubject))) {
      return reply.status(403).send({ error: 'Usuário não autorizado a atribuir esta tarefa a outro usuário' })
    }

    await prisma.task.update({
      where: { id },
      data: { titulo, descricao, completo, userId },
    })
    return reply.status(200).send({ message: 'Tarefa atualizada com exito' })
  })
}
