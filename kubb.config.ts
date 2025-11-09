import { defineConfig } from '@kubb/core'
import { pluginOas } from '@kubb/plugin-oas'
import { pluginReactQuery } from '@kubb/plugin-react-query'
import { pluginTs } from '@kubb/plugin-ts'

export default defineConfig({
  input: {
    // Permite override via env para apontar para uma API já rodando
    path: process.env.KUBB_OPENAPI_URL ?? 'http://localhost:3001/docs/json',
  },
  output: {
    path: './apps/web/app/src/generated',
    clean: true,
  },
  plugins: [
    pluginOas({
      validate: true,
    }),
    pluginTs({}),
    pluginReactQuery({
      output: {
        path: '.',
      },
      query: {
        // permite ajuste de options se necessário; usar defaults
      },
    }),
  ],
})


