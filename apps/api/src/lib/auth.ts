import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma.ts";

const defaultPort = Number(process.env.PORT ?? 3001);
const defaultBaseURL = `http://localhost:${defaultPort}/api/auth`;

export const auth = betterAuth({
  // Better Auth espera o host base; os handlers expostos via Fastify atendem em /api/auth
  baseURL: process.env.AUTH_BASE_URL ?? defaultBaseURL,
  trustedOrigins: [
    process.env.WEB_APP_URL ?? "http://localhost:3000",
  ],
  advanced: {
    useSecureCookies: false,
    defaultCookieAttributes: {
      path: "/",
      sameSite: "lax",
      secure: false,
    },
    cookies: {
      session_token: {
        attributes: {
          path: "/",
          sameSite: "lax",
          secure: false,
        },
      },
      session_data: {
        attributes: {
          path: "/",
          sameSite: "lax",
          secure: false,
        },
      },
      dont_remember: {
        attributes: {
          path: "/",
          sameSite: "lax",
          secure: false,
        },
      },
    },
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
});