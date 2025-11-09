import type { fastifyTypedInstance } from "../types.ts"
import tarefasRoutes from "./tarefas/routes.ts"
import usuariosRoutes from "./usuarios/routes.ts"
import authRoutes from "./auth/routes.ts"

export async function registerHttp(app: fastifyTypedInstance) {
  await app.register(tarefasRoutes, { prefix: "/tarefas" })
  await app.register(usuariosRoutes, { prefix: "/usuarios" })
  await app.register(authRoutes, { prefix: "/v1/auth" })
}


