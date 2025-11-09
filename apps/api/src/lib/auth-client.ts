import { createAuthClient } from "better-auth/react"
export const authClient = createAuthClient({
    /** The base URL of the Next app (where /api/auth lives) */
    baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
})