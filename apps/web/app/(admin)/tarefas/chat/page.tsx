'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type ChatMessage = {
	role: 'system' | 'user' | 'assistant' | 'tool'
	content: string
	tool_call_id?: string
	name?: string
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '')

export default function ChatPage() {
	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [input, setInput] = useState('')
	const [loading, setLoading] = useState(false)
	const inputRef = useRef<HTMLInputElement | null>(null)
	const scrollContainerRef = useRef<HTMLDivElement | null>(null)
	const scrollToBottom = () => {
		const el = scrollContainerRef.current
		if (el) {
			el.scrollTop = el.scrollHeight
		}
	}
	useEffect(() => {
		scrollToBottom()
	}, [messages, loading])

	async function sendMessage(e: React.FormEvent) {
		e.preventDefault()
		if (!input.trim()) return
		const nextMessages = [...messages, { role: 'user' as const, content: input }]
		setMessages(nextMessages)
		setInput('')
		setLoading(true)
		try {
			const res = await fetch(`${API_BASE}/ai/chat`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ messages: nextMessages }),
			})
			if (!res.ok) {
				throw new Error(await res.text())
			}
			const data = (await res.json()) as { reply: string }
			setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
		} catch {
			setMessages((prev) => [...prev, { role: 'assistant', content: 'Ocorreu um erro ao processar sua mensagem.' }])
		} finally {
			setLoading(false)
			// garantir que o foco volte para o campo após o envio
			setTimeout(() => {
				inputRef.current?.focus()
			}, 0)
		}
	}

	return (
		<div className="space-y-3 text-sm">
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Chat IA (tarefas)</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div ref={scrollContainerRef} className="space-y-2 max-h-[70vh] overflow-auto pr-2">
						{messages.map((m, i) => (
							<div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
								<div className={`inline-block whitespace-pre-wrap break-words rounded px-2 py-1 leading-5 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
									<ReactMarkdown remarkPlugins={[remarkGfm]}>
										{m.content}
									</ReactMarkdown>
								</div>
							</div>
						))}
						{loading && <div className="text-xs text-muted-foreground">Pensando...</div>}
					</div>
					<form onSubmit={sendMessage} className="flex gap-2">
						<Input
							placeholder="Pergunte ou peça para criar/atualizar/remover/listar tarefas..."
							value={input}
							onChange={(e) => setInput(e.target.value)}
							disabled={loading}
							ref={inputRef}
							autoFocus
							className="h-9 text-sm"
						/>
						<Button type="submit" disabled={loading || !input.trim()} className="h-9 px-3 text-sm">
							Enviar
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	)
}




