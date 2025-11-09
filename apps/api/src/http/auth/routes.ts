import type { fastifyTypedInstance } from '../../types.ts'
import loginRoutes from './login.ts'
import signInRoutes from './sign-in.ts'
import logoutRoutes from './logout.ts'

export default async function authRoutes(app: fastifyTypedInstance) {
  await app.register(loginRoutes)
  await app.register(signInRoutes)
  await app.register(logoutRoutes)
}


