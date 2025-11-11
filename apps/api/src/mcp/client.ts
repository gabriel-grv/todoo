import { prisma } from '../lib/prisma.ts'
import { createAbilityFor, subject } from '@repo/auth'
import type { Role } from '@prisma/client'

type ToolContext = {
	currentUserId: string
	currentUserRole: Role
}

async function resolveTargetUserId(
	args: { userId?: string; userEmail?: string; userName?: string } & ToolContext,
): Promise<{ userId: string } | { error: string }> {
	const { currentUserId, currentUserRole } = args
	if (currentUserRole !== 'ADMIN') {
		return { userId: currentUserId }
	}
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
	const resolvedUser = await resolveTargetUserId(args)
	if ('error' in resolvedUser) {
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
	// Apenas ADMIN pode listar tarefas de outro usuário explicitamente
	if (currentUserRole !== 'ADMIN' && (userId || userEmail || userName)) {
		return { error: 'Apenas ADMIN pode listar tarefas de outros usuários' }
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
	const ability = createAbilityFor({ id: currentUserId, role: currentUserRole } as any)
	if (confirm !== true) {
		return { error: 'Confirmação necessária para deletar tarefa. Confirme com confirm=true.', requireConfirmation: true }
	}
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
	const ability = createAbilityFor({ id: currentUserId, role: currentUserRole } as any)
	if (confirm !== true) {
		return { error: 'Confirmação necessária para atualizar tarefa. Confirme com confirm=true.', requireConfirmation: true }
	}
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

export const mcpTaskClient = {
	/**
	 * Chama uma "ferramenta" por nome, injetando contexto de usuário para autorização.
	 * Implementação local (sem depender do SDK), espelhando a lógica do servidor MCP.
	 */
	async callTool(
		name: string,
		args: Record<string, unknown>,
		meta: { currentUserId: string; currentUserRole: Role },
	): Promise<unknown> {
		switch (name) {
			case 'list_tasks':
				return await listTasksTool({
					userId: args?.userId as string | undefined,
					userEmail: args?.userEmail as string | undefined,
					userName: args?.userName as string | undefined,
					taskName: args?.taskName as string | undefined,
					...meta,
				})
			case 'create_task':
				return await createTaskTool({
					titulo: args?.titulo as string,
					descricao: args?.descricao as string,
					completo: Boolean(args?.completo),
					userId: args?.userId as string | undefined,
					userEmail: args?.userEmail as string | undefined,
					userName: args?.userName as string | undefined,
					confirm: Boolean(args?.confirm),
					...meta,
				})
			case 'delete_task':
				return await deleteTaskTool({
					id: args?.id as string | undefined,
					taskName: args?.taskName as string | undefined,
					userId: args?.userId as string | undefined,
					userEmail: args?.userEmail as string | undefined,
					userName: args?.userName as string | undefined,
					confirm: Boolean(args?.confirm),
					...meta,
				})
			case 'update_task':
				return await updateTaskTool({
					id: args?.id as string | undefined,
					taskName: args?.taskName as string | undefined,
					titulo: args?.titulo as string,
					descricao: args?.descricao as string,
					completo: Boolean(args?.completo),
					userId: args?.userId as string | undefined,
					userEmail: args?.userEmail as string | undefined,
					userName: args?.userName as string | undefined,
					confirm: Boolean(args?.confirm),
					...meta,
				})
			default:
				return { error: `Ferramenta desconhecida: ${name}` }
		}
	},
}


