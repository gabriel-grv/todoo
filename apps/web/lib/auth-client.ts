import { createAuthClient } from "better-auth/react"

const apiBaseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

export const authClient = createAuthClient({
  baseURL: `${apiBaseURL.replace(/\/$/, "")}/api/auth`,
  // Garante envio de cookies em CORS (sessão)
  fetchOptions: {
    credentials: "include",
  },
})
