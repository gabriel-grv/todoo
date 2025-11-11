import type { fastifyTypedInstance } from '../../types.ts'
import { z } from 'zod'
import { getCurrentUser } from '../../lib/current-user.ts'
import { chatWithTasksViaMCP } from '../../lib/azure.ts'

export default async function chatRoutes(app: fastifyTypedInstance) {
	const messageSchema = z.object({
		role: z.enum(['system', 'user', 'assistant', 'tool']).default('user'),
		content: z.string(),
		tool_call_id: z.string().optional(),
		name: z.string().optional(),
	})

	app.post('/chat', {
		schema: {
			operationId: 'chatTasks',
			description: 'Chat IA com acesso ao CRUD de tarefas via MCP',
			tags: ['chat', 'ia', 'tarefas'],
			body: z.object({
				messages: z.array(messageSchema),
			}),
			response: {
				200: z.object({
					reply: z.string(),
					messages: z.array(messageSchema).optional(),
				}),
				401: z.object({ error: z.string() }),
				500: z.object({ error: z.string() }),
			},
		},
	}, async (request, reply) => {
		const currentUser = await getCurrentUser(request)
		if (!currentUser) {
			return reply.status(401).send({ error: 'Não autenticado' })
		}
		try {
			const { messages } = request.body as { messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; name?: string }> }
			const system =
				`Você é um assistente que ajuda a gerenciar tarefas.
Contexto do usuário logado (fonte confiável do servidor):
- currentUserId: ${currentUser.id}
- currentUserRole: ${currentUser.role}
- currentUserName: ${currentUser.name ?? ''}
- currentUserEmail: ${currentUser.email}

Regras:
- Nunca pergunte quem é o usuário logado e nunca questione o papel (role). Utilize os valores acima.
- Interprete "minhas tarefas", "eu" ou termos equivalentes sempre como o usuário de id ${currentUser.id}.
- Para operações de escrita (criar, atualizar, remover), peça confirmação explícita e inclua confirm=true nos parâmetros.
- Para listagens/leitura, não solicite confirmação.
- Você pode identificar usuários por nome ou email (sem exigir id) e tarefas pelo título (nome da tarefa); se houver ambiguidades, peça para especificar o usuário (id/email/nome) ou o id da tarefa.
Responda em português.`
			const result = await chatWithTasksViaMCP({
				history: messages,
				currentUser: { id: currentUser.id, role: currentUser.role },
				systemPrompt: system,
			})
			// Normaliza mensagens para o schema de resposta: content deve ser string e somente campos permitidos
			const normalizedMessages = (result.messages ?? []).map((m) => ({
				role: m.role,
				content: m.content ?? '',
				tool_call_id: m.tool_call_id,
				name: m.name,
			}))
			return reply.send({ reply: result.reply, messages: normalizedMessages })
		} catch (e: any) {
			request.server.log.error(e)
			return reply.status(500).send({ error: 'Falha ao processar chat' })
		}
	})
}




