import { mcpTaskClient } from '../mcp/client.js'

type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

export type ChatMessage = {
	role: ChatRole
	content: string | null
	tool_call_id?: string
	name?: string
	tool_calls?: Array<{
		id: string
		type: 'function'
		function: { name: string; arguments: string }
	}>
}

type ToolSchema = {
	name: string
	description: string
	parameters: Record<string, unknown>
}

type AzureChatResponse = {
	choices: Array<{
		message: {
			role: 'assistant'
			content: string | null
			tool_calls?: Array<{
				id: string
				type: 'function'
				function: { name: string; arguments: string }
			}>
		}
	}>
}

function getAzureConfig() {
	// Usa endpoint completo vindo da variável de ambiente, sem montar por partes
	const endpoint = process.env.AZURE_OPENAI_ENDPOINT
	const apiKey = process.env.AZURE_OPENAI_API_KEY

	if (!endpoint) throw new Error('AZURE_OPENAI_ENDPOINT não configurado')
	if (!apiKey) throw new Error('AZURE_OPENAI_API_KEY não configurado')

	return { endpoint, apiKey }
}

async function callAzureChat(messages: ChatMessage[], tools: ToolSchema[]) {
	const { endpoint, apiKey } = getAzureConfig()
	const payload = {
		messages,
		tools: tools.map((t) => ({ type: 'function', function: t })),
		tool_choice: 'auto',
		temperature: 0.2,
	}
	const res = await fetch(endpoint, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'api-key': apiKey,
		},
		body: JSON.stringify(payload),
	})
	if (!res.ok) {
		const text = await res.text()
		throw new Error(`Azure Chat error: ${res.status} ${text}`)
	}
	return (await res.json()) as AzureChatResponse
}

export async function chatWithTasksViaMCP(params: {
	history: ChatMessage[]
	currentUser: { id: string; role: 'ADMIN' | 'USER' }
	systemPrompt?: string
}) {
	const { history, currentUser, systemPrompt } = params
	const tools: ToolSchema[] = [
		{
			name: 'list_tasks',
			description: 'Lista tarefas. Usuário comum vê as próprias. ADMIN pode filtrar por id/email/nome. Pode filtrar por nome da tarefa.',
			parameters: {
				type: 'object',
				properties: {
					userId: { type: 'string', description: 'Filtra por ID do usuário (somente ADMIN)' },
					userEmail: { type: 'string', description: 'Filtra por email (somente ADMIN)' },
					userName: { type: 'string', description: 'Filtra por nome (somente ADMIN; requer unicidade)' },
					taskName: { type: 'string', description: 'Filtra por título exato da tarefa' },
				},
				additionalProperties: false,
			},
		},
		{
			name: 'create_task',
			description: 'Cria uma tarefa. Usuário comum cria para si. ADMIN pode direcionar por id/email/nome.',
			parameters: {
				type: 'object',
				required: ['titulo', 'descricao', 'completo', 'confirm'],
				properties: {
					titulo: { type: 'string' },
					descricao: { type: 'string' },
					completo: { type: 'boolean' },
					confirm: { type: 'boolean', description: 'Precisa ser true para confirmar a operação' },
					userId: { type: 'string', description: 'ID do dono (ADMIN opcional)' },
					userEmail: { type: 'string', description: 'Email do dono (ADMIN opcional)' },
					userName: { type: 'string', description: 'Nome do dono (ADMIN opcional; requer unicidade)' },
				},
				additionalProperties: false,
			},
		},
		{
			name: 'delete_task',
			description: 'Remove uma tarefa por id ou nome.',
			parameters: {
				type: 'object',
				required: ['confirm'],
				properties: {
					id: { type: 'string', description: 'ID da tarefa (opcional quando taskName for informado)' },
					taskName: { type: 'string', description: 'Título exato da tarefa (alternativa ao id)' },
					userId: { type: 'string', description: 'Dono da tarefa (ADMIN opcional para desambiguar)' },
					userEmail: { type: 'string', description: 'Email do dono (ADMIN opcional para desambiguar)' },
					userName: { type: 'string', description: 'Nome do dono (ADMIN opcional; requer unicidade)' },
					confirm: { type: 'boolean', description: 'Precisa ser true para confirmar a operação' },
				},
				additionalProperties: false,
			},
		},
		{
			name: 'update_task',
			description: 'Atualiza uma tarefa por id ou nome. ADMIN pode reatribuir por id/email/nome.',
			parameters: {
				type: 'object',
				required: ['titulo', 'descricao', 'completo', 'confirm'],
				properties: {
					id: { type: 'string', description: 'ID da tarefa (opcional quando taskName for informado)' },
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
		},
	]

	const messages: ChatMessage[] = []
	if (systemPrompt) {
		messages.push({ role: 'system', content: systemPrompt })
	}
	messages.push(...history)

	// 1) Primeira chamada (modelo decide se chama ferramenta)
	const first = await callAzureChat(messages, tools)
	const choice = first.choices[0]
	const toolCalls = choice?.message?.tool_calls
	const assistantMsg = choice?.message

	if (toolCalls && toolCalls.length) {
		// Preserva a mensagem do assistente que contém os tool_calls,
		// pois cada mensagem 'tool' deve responder a esta.
		messages.push({
			role: 'assistant',
			content: assistantMsg?.content ?? null,
			tool_calls: assistantMsg?.tool_calls,
		})

		for (const tc of toolCalls) {
			let args: Record<string, unknown> = {}
			try {
				args = JSON.parse(tc.function.arguments ?? '{}')
			} catch {
				args = {}
			}
			// Executa via MCP, injetando contexto de usuário para autorização
			const toolResult = await mcpTaskClient.callTool(tc.function.name, args, {
				currentUserId: currentUser.id,
				currentUserRole: currentUser.role,
			})
			messages.push({
				role: 'tool',
				tool_call_id: tc.id,
				name: tc.function.name,
				content: JSON.stringify(toolResult),
			})
		}
		// 2) Resposta final após ferramentas
		const second = await callAzureChat(messages, tools)
		const finalMessage = second.choices[0]?.message
		// Filtra a mensagem assistant com tool_calls do retorno para não conflitar com schemas de resposta
		const messagesForReturn = messages.filter((m) => !(m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0))
		return {
			messages: messagesForReturn,
			reply: finalMessage?.content ?? '',
		}
	}

	// Sem ferramentas, apenas retorna
	return {
		messages,
		reply: choice?.message?.content ?? '',
	}
}


