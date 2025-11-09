import { z } from "zod"

// Email & Password - Sign In
export const SignInBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  rememberMe: z.boolean().optional(),
  callbackURL: z.string().url().optional(),
})

// Alias para /login (mesmo payload de sign-in)
export const LoginBodySchema = SignInBodySchema

// Email & Password - Sign Up
export const SignUpBodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  image: z.string().url().optional(),
  callbackURL: z.string().url().optional(),
  role: z.enum(['ADMIN', 'USER']).optional(),
})