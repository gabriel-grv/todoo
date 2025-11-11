import { prisma } from '../lib/prisma.ts'
import { createAbilityFor, subject } from '@repo/auth'
import type { Role } from '@prisma/client'

// MCP SDK (o usuário deverá instalar @modelcontextprotocol/sdk)

type CurrentUser = {
	id: string
	role: Role
	email?: string
}

type ToolContext = {
	currentUserId: string
	currentUserRole: Role
}

async function resolveTargetUserId(
	args: { userId?: string; userEmail?: string; userName?: string } & ToolContext,
): Promise<{ userId: string } | { error: string }> {
	const { currentUserId, currentUserRole } = args
	// Usuário comum: sempre ele mesmo, ignorando parâmetros de destino
	if (currentUserRole !== 'ADMIN') {
		return { userId: currentUserId }
	}
	// Admin pode direcionar por id, email ou nome; se nada informado, assume ele mesmo
	if (args.userId) {
		const found = await prisma.user.findUnique({ where: { id: args.userId }, select: { id: true } })
		if (!found) return { error: 'Usuário não encontrado' }
		return { userId: found.id }
	}
	if (args.userEmail) {
		const found = await prisma.user.findUnique({ where: { email: args.userEmail }, select: { id: true } })
		if (!found) return { error: 'Usuário não encontrado' }
		return { userId: found.id }
	}
	if (args.userName) {
		const matches = await prisma.user.findMany({ where: { name: args.userName }, select: { id: true } })
		if (matches.length === 0) return { error: 'Usuário não encontrado' }
		if (matches.length > 1) return { error: 'Nome de usuário não é único; especifique por email ou id' }
		return { userId: matches[0]!.id }
	}
	return { userId: currentUserId }
}

async function resolveTargetTask(
	args: { id?: string; taskName?: string; userId?: string; userEmail?: string; userName?: string } & ToolContext,
): Promise<{ id: string; userId: string } | { error: string }> {
	const { currentUserId, currentUserRole, id, taskName } = args
	if (id) {
		const tarefa = await prisma.task.findUnique({ where: { id }, select: { id: true, userId: true } })
		if (!tarefa) return { error: 'Tarefa não encontrada' }
		return tarefa
	}
	if (!taskName) {
		return { error: 'Informe o id da tarefa ou o nome (taskName) para localizar' }
	}
	// Busca por nome do título
	if (currentUserRole !== 'ADMIN') {
		const matches = await prisma.task.findMany({
			where: { titulo: taskName, userId: currentUserId },
			select: { id: true, userId: true },
			orderBy: { createdAt: 'desc' },
		})
		if (matches.length === 0) return { error: 'Tarefa não encontrada' }
		if (matches.length > 1) return { error: 'Nome de tarefa não é único; especifique o id' }
		return matches[0]!
	}
	// ADMIN: pode opcionalmente informar usuário alvo para desambiguar
	const resolvedUser = await resolveTargetUserId(args)
	if ('error' in resolvedUser) {
		// Se nenhum usuário foi informado (e portanto erro não por falta), tentamos global, mas teremos ambiguidade se houver mais de uma
		if (!(args.userId || args.userEmail || args.userName)) {
			const matches = await prisma.task.findMany({
				where: { titulo: taskName },
				select: { id: true, userId: true },
				orderBy: { createdAt: 'desc' },
			})
			if (matches.length === 0) return { error: 'Tarefa não encontrada' }
			if (matches.length > 1) {
				return { error: 'Nome de tarefa não é único; especifique o usuário (id/email/nome) ou o id da tarefa' }
			}
			return matches[0]!
		}
		return resolvedUser
	}
	// Com usuário alvo resolvido
	const matches = await prisma.task.findMany({
		where: { titulo: taskName, userId: resolvedUser.userId },
		select: { id: true, userId: true },
		orderBy: { createdAt: 'desc' },
	})
	if (matches.length === 0) return { error: 'Tarefa não encontrada' }
	if (matches.length > 1) return { error: 'Nome de tarefa não é único para este usuário; especifique o id' }
	return matches[0]!
}

async function listTasksTool(args: { userId?: string; userEmail?: string; userName?: string; taskName?: string } & ToolContext) {
	const { currentUserId, currentUserRole, userId, userEmail, userName, taskName } = args
	const ability = createAbilityFor({ id: currentUserId, role: currentUserRole } as any)
	if (!ability.can('read', 'Task')) {
		return { error: 'Usuário não autorizado a listar tarefas' }
	}
	let where: any =
		currentUserRole === 'ADMIN'
			? userId || userEmail || userName
				? null as any
				: undefined
			: { userId: currentUserId }

	if (where === null) {
		const resolved = await resolveTargetUserId({ currentUserId, currentUserRole, userId, userEmail, userName })
		if ('error' in resolved) return resolved
		const tarefas = await prisma.task.findMany({
			where: { userId: resolved.userId, ...(taskName ? { titulo: taskName } : {}) },
			orderBy: { createdAt: 'desc' },
			include: {
				user: {
					select: { id: true, name: true, email: true, role: true },
				},
			},
		})
		return tarefas.map((t) => ({
			id: t.id,
			titulo: t.titulo,
			descricao: t.descricao,
			completo: t.completo,
			userId: t.userId,
			owner: {
				id: t.user.id,
				nome: t.user.name ?? t.user.email,
				email: t.user.email,
				role: t.user.role,
			},
		}))
	}

	if (taskName) {
		where = { ...(where ?? {}), titulo: taskName }
	}
	const tarefas = await prisma.task.findMany({
		where: where as any,
		orderBy: { createdAt: 'desc' },
		include: {
			user: {
				select: { id: true, name: true, email: true, role: true },
			},
		},
	})
	return tarefas.map((t) => ({
		id: t.id,
		titulo: t.titulo,
		descricao: t.descricao,
		completo: t.completo,
		userId: t.userId,
		owner: {
			id: t.user.id,
			nome: t.user.name ?? t.user.email,
			email: t.user.email,
			role: t.user.role,
		},
	}))
}

async function createTaskTool(args: { titulo: string; descricao: string; completo: boolean; userId?: string; userEmail?: string; userName?: string; confirm?: boolean } & ToolContext) {
	const { currentUserId, currentUserRole, titulo, descricao, completo, confirm } = args
	if (confirm !== true) {
		return { error: 'Confirmação necessária para criar tarefa. Confirme com confirm=true.', requireConfirmation: true }
	}
	const resolved = await resolveTargetUserId(args)
	if ('error' in resolved) return resolved
	const targetUserId = resolved.userId
	const ability = createAbilityFor({ id: currentUserId, role: currentUserRole } as any)
	if (!ability.can('create', subject('Task', { userId: targetUserId } as any))) {
		return { error: 'Usuário não autorizado a criar tarefa para este usuário' }
	}
	const userExists = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } })
	if (!userExists) return { error: 'Usuário não encontrado' }
	await prisma.task.create({ data: { titulo, descricao, completo, userId: targetUserId } })
	return { ok: true }
}

async function deleteTaskTool(args: { id?: string; taskName?: string; userId?: string; userEmail?: string; userName?: string; confirm?: boolean } & ToolContext) {
	const { currentUserId, currentUserRole, confirm } = args
	if (confirm !== true) {
		return { error: 'Confirmação necessária para deletar tarefa. Confirme com confirm=true.', requireConfirmation: true }
	}
	const ability = createAbilityFor({ id: currentUserId, role: currentUserRole } as any)
	const resolvedTask = await resolveTargetTask(args)
	if ('error' in resolvedTask) return resolvedTask
	const tarefa = resolvedTask
	if (!ability.can('delete', subject('Task', tarefa as any))) {
		return { error: 'Usuário não autorizado a remover esta tarefa' }
	}
	await prisma.task.delete({ where: { id: tarefa.id } })
	return { ok: true }
}

async function updateTaskTool(args: { id?: string; taskName?: string; titulo: string; descricao: string; completo: boolean; userId?: string; userEmail?: string; userName?: string; confirm?: boolean } & ToolContext) {
	const { currentUserId, currentUserRole, titulo, descricao, completo, confirm } = args
	if (confirm !== true) {
		return { error: 'Confirmação necessária para atualizar tarefa. Confirme com confirm=true.', requireConfirmation: true }
	}
	const ability = createAbilityFor({ id: currentUserId, role: currentUserRole } as any)
	const resolvedTask = await resolveTargetTask(args)
	if ('error' in resolvedTask) return resolvedTask
	const tarefa = resolvedTask
	if (!ability.can('update', subject('Task', tarefa as any))) {
		return { error: 'Usuário não autorizado a atualizar esta tarefa' }
	}
	const resolved = await resolveTargetUserId(args)
	if ('error' in resolved) return resolved
	const targetUserId = resolved.userId
	const updatedSubject = { ...tarefa, userId: targetUserId }
	if (!ability.can('update', subject('Task', updatedSubject as any))) {
		return { error: 'Usuário não autorizado a atribuir esta tarefa a outro usuário' }
	}
	await prisma.task.update({ where: { id: tarefa.id }, data: { titulo, descricao, completo, userId: targetUserId } })
	return { ok: true }
}

// Inicialização do servidor MCP via stdio
async function bootstrap() {
	// imports dinâmicos para evitar falha caso o pacote não esteja instalado ainda
	const serverModule = '@modelcontextprotocol/sdk/server'
	const transportModule = '@modelcontextprotocol/sdk/transport/stdio'
	const { Server } = (await import(serverModule)) as any
	const { StdioServerTransport } = (await import(transportModule)) as any

	const server = new Server(
		{
			name: 'todoo-mcp-task-server',
			version: '0.1.0',
		},
		{
			capabilities: {
				tools: {},
			},
		},
	)

	// Definições das ferramentas públicas (sem campos de contexto expostos)
	server.tool('list_tasks', 'Lista tarefas. Usuário comum vê as próprias. ADMIN pode filtrar por id/email/nome. Pode filtrar por nome da tarefa.', {
		inputSchema: {
			type: 'object',
			properties: {
				userId: { type: 'string', description: 'Filtra por ID do usuário (somente ADMIN)' },
				userEmail: { type: 'string', description: 'Filtra por email do usuário (somente ADMIN)' },
				userName: { type: 'string', description: 'Filtra por nome do usuário (somente ADMIN; requer unicidade)' },
				taskName: { type: 'string', description: 'Filtra por título exato da tarefa' },
			},
			additionalProperties: false,
		},
		execute: async (args: any, context: { meta?: unknown }) => {
			// Os campos de contexto são injetados pelo cliente (API) e não pelo modelo
			const injected = ((context?.meta as any) ?? {}) as ToolContext
			return await listTasksTool({ userId: args?.userId, userEmail: args?.userEmail, userName: args?.userName, taskName: args?.taskName, ...injected })
		},
	})

	server.tool('create_task', 'Cria uma tarefa. Usuário comum cria para si. ADMIN pode direcionar por id/email/nome.', {
		inputSchema: {
			type: 'object',
			required: ['titulo', 'descricao', 'completo', 'confirm'],
			properties: {
				titulo: { type: 'string' },
				descricao: { type: 'string' },
				completo: { type: 'boolean' },
				confirm: { type: 'boolean', description: 'Precisa ser true para confirmar a operação' },
				userId: { type: 'string', description: 'Dono da tarefa (ADMIN opcional)' },
				userEmail: { type: 'string', description: 'Email do dono (ADMIN opcional)' },
				userName: { type: 'string', description: 'Nome do dono (ADMIN opcional; requer unicidade)' },
			},
			additionalProperties: false,
		},
		execute: async (args: any, context: { meta?: unknown }) => {
			const injected = ((context?.meta as any) ?? {}) as ToolContext
			return await createTaskTool({ ...args, ...injected })
		},
	})

	server.tool('delete_task', 'Remove uma tarefa por id ou nome', {
		inputSchema: {
			type: 'object',
			required: ['confirm'],
			properties: {
				id: { type: 'string' },
				taskName: { type: 'string', description: 'Título exato da tarefa' },
				userId: { type: 'string', description: 'Dono da tarefa (ADMIN opcional para desambiguar)' },
				userEmail: { type: 'string', description: 'Email do dono (ADMIN opcional para desambiguar)' },
				userName: { type: 'string', description: 'Nome do dono (ADMIN opcional; requer unicidade)' },
				confirm: { type: 'boolean', description: 'Precisa ser true para confirmar a operação' },
			},
			additionalProperties: false,
		},
		execute: async (args: any, context: { meta?: unknown }) => {
			const injected = ((context?.meta as any) ?? {}) as ToolContext
			if (args?.confirm !== true) {
				return { error: 'Confirmação necessária para deletar tarefa. Confirme com confirm=true.', requireConfirmation: true }
			}
			return await deleteTaskTool({ ...args, ...injected })
		},
	})

	server.tool('update_task', 'Atualiza uma tarefa por id ou nome. ADMIN pode reatribuir por id/email/nome.', {
		inputSchema: {
			type: 'object',
			required: ['titulo', 'descricao', 'completo', 'confirm'],
			properties: {
				id: { type: 'string', description: 'ID da tarefa (opcional caso use taskName)' },
				taskName: { type: 'string', description: 'Título exato da tarefa (alternativa ao id)' },
				titulo: { type: 'string' },
				descricao: { type: 'string' },
				completo: { type: 'boolean' },
				confirm: { type: 'boolean', description: 'Precisa ser true para confirmar a operação' },
				userId: { type: 'string', description: 'Novo dono (ADMIN opcional)' },
				userEmail: { type: 'string', description: 'Email do novo dono (ADMIN opcional)' },
				userName: { type: 'string', description: 'Nome do novo dono (ADMIN opcional; requer unicidade)' },
			},
			additionalProperties: false,
		},
		execute: async (args: any, context: { meta?: unknown }) => {
			const injected = ((context?.meta as any) ?? {}) as ToolContext
			return await updateTaskTool({ ...args, ...injected })
		},
	})

	const transport = new StdioServerTransport()
	await server.connect(transport)
}

// Executa apenas quando chamado como processo dedicado
if (import.meta.url === `file://${process.argv[1]}`) {
	bootstrap().catch((err) => {
		// eslint-disable-next-line no-console
		console.error('[mcp] falha ao iniciar:', err)
		process.exit(1)
	})
}


