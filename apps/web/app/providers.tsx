"use client"

import { PropsWithChildren, useEffect, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { setConfig } from "./src/generated/.kubb/fetcher"

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient())
  // Configure o client ANTES de montar filhos, evitando primeira requisição sem baseURL
  const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
  setConfig({ baseURL, withCredentials: true })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}


