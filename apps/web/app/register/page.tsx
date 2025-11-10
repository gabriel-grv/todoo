"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { usePostV1AuthSignInEmail } from "../src/generated/usePostV1AuthSignInEmail";
import client from "../src/generated/.kubb/fetcher";
import { axiosInstance } from "../src/generated/.kubb/fetcher";
import type { RequestConfig } from "../src/generated/.kubb/fetcher";
import { useUpdateUser } from "../src/generated/useUpdateUser";
import { useGetUser } from "../src/generated/useGetUser";
import { authClient } from "../../lib/auth-client";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<"ADMIN" | "USER">("USER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAnyUsers, setHasAnyUsers] = useState<boolean | null>(null);
  // Cliente temporário sem credenciais para evitar qualquer Set-Cookie via CORS neste POST
  const noCredentialsClient: typeof client = ((
    cfg: RequestConfig<unknown>,
  ) => {
    const prev = axiosInstance.defaults.withCredentials;
    axiosInstance.defaults.withCredentials = false;
    return client(cfg).finally(() => {
      axiosInstance.defaults.withCredentials = prev;
    });
  }) as typeof client;
  noCredentialsClient.getConfig = client.getConfig;
  noCredentialsClient.setConfig = client.setConfig;
  const signUp = usePostV1AuthSignInEmail({ client: { client: noCredentialsClient } });
  const updateUser = useUpdateUser();

  const redirectTarget = useMemo(() => {
    const from = searchParams?.get("from");
    if (!from) return "/tarefas/admin";
    return from.startsWith("/") ? from : "/tarefas/admin";
  }, [searchParams]);

  const useSession = authClient.useSession;
  const {
    data: session,
    isPending: isSessionPending,
    isRefetching: isSessionRefetching,
  } = useSession?.() ?? { data: undefined, isPending: false, isRefetching: false };
  const isSessionLoading = Boolean(isSessionPending || isSessionRefetching);

  const adminQuery = useGetUser(session?.user?.id ?? "", {
    query: { enabled: !!session?.user?.id },
  });
  const isAdmin = adminQuery.data?.role === "ADMIN";

  // Verifica se já existem usuários no sistema
  useEffect(() => {
    let cancelled = false;
    async function checkHasAny() {
      try {
        const apiBaseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const res = await fetch(`${apiBaseURL.replace(/\/$/, "")}/usuarios/has-any`, {
          credentials: "include",
        });
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json();
            setHasAnyUsers(Boolean(data?.hasAny));
          } else {
            setHasAnyUsers(true); // falha: comporta-se como se já existissem usuários
          }
        }
      } catch {
        if (!cancelled) setHasAnyUsers(true);
      }
    }
    checkHasAny();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isSessionLoading) return;
    if (hasAnyUsers === null) return;
    // Se já existem usuários e não há sessão, redireciona para login
    if (hasAnyUsers && session === null) {
      router.replace("/login?from=/register");
    }
  }, [isSessionLoading, session, router, hasAnyUsers]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const fallbackName = email.split("@")[0] || "Usuário";
      const response = await signUp.mutateAsync({
        data: {
          name: fallbackName,
          email,
          password,
          // Define role no signup:
          // - Se não há usuários, permite escolher livremente (primeiro usuário pode ser ADMIN)
          // - Se já há usuários, somente admins verão esta tela; então respeitamos a escolha
          role: role,
        },
      });
      if (isAdmin && role === "ADMIN") {
        const createdUserId = (response as { user?: { id?: string | null } } | undefined)?.user?.id;
        if (createdUserId) {
          await updateUser.mutateAsync({
            id: createdUserId,
            data: { role },
          });
        }
      }
      router.replace(redirectTarget);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Não foi possível registrar.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (isSessionLoading || adminQuery.isLoading || hasAnyUsers === null) {
    return (
      <div className="min-h-[calc(100vh-2rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent>
            <p className="text-muted text-center py-8">Carregando...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Se não é admin e JÁ existem usuários, bloqueia criação;
  // se não existem usuários, libera tela sem sessão/admin.
  if (hasAnyUsers && !isAdmin) {
    return (
      <div className="min-h-[calc(100vh-2rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-muted">
              Somente administradores podem cadastrar novos usuários.
            </p>
            <Button onClick={() => router.replace(redirectTarget)}>
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-2rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Novo usuário</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Tipo de usuário</Label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as "ADMIN" | "USER")}
                className="h-10 rounded-md border border-neutral-800 bg-neutral-950 text-white px-3"
              >
                <option value="USER">Usuário comum</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            {error ? (
              <p className="text-red-400 text-sm">{error}</p>
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Registrando..." : "Registrar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.replace(redirectTarget)}
                disabled={loading}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

