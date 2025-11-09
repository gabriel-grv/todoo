# TODOO – Monorepo

Monorepo com backend Fastify/Prisma (`apps/api`) e frontend Next.js (`apps/web`) usando autenticação Better Auth.

## Variáveis de Ambiente

Para rodar o projeto sem problemas, configure os arquivos abaixo.

### Raiz do projeto (`.env` – opcional)

```env
# Geral
NODE_ENV=development
```

### Backend (`apps/api/.env`)

```env
# Porta/host onde a API vai escutar
PORT=3001
HOST=0.0.0.0

# URL da API de autenticação. Em dev, use a própria API
AUTH_BASE_URL=http://localhost:3001/api/auth

# URL permitida para o frontend (CORS e cookies)
WEB_APP_URL=http://localhost:3000

# URL do banco de dados Prisma (PostgreSQL)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/todoo?schema=public
```

> Caso use Docker/Compose, ajuste `DATABASE_URL` e `WEB_APP_URL` conforme o endereço dos containers.

### Frontend (`apps/web/.env.local`)

```env
# URL base da API (usada pelo fetcher e auth-client)
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Rodando o Projeto

### Instalação

```bash
npm install
```

### Backend

```bash
cd apps/api
npm run dev
```

### Frontend

```bash
cd apps/web
npm run dev
```

Depois acesse `http://localhost:3000`.

## Estrutura

- `apps/api`: API Fastify com autenticação Better Auth, Prisma/SQL, CASL (autorização).
- `apps/web`: Next.js 14 App Router com React Query, geração de clients via Kubb.
- `packages/*`: Configurações compartilhadas (ESLint, TSConfig) e componentes UI.

## Scripts Úteis

```bash
# Rodar ambos (root)
npx turbo dev

# Backend: gerar Prisma e rodar migrations
cd apps/api
npm run prisma:generate
npm run prisma:migrate

# Frontend: gerar clients Kubb (quando necessário)
cd apps/web
npm run generate
```

## Licença

MIT.
