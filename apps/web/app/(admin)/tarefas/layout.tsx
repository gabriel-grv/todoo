"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "../../../lib/auth-client";
import { useGetUser } from "../../src/generated/useGetUser";
import { usePostV1AuthLogout } from "../../src/generated/usePostV1AuthLogout";
import { Button } from "../../../components/ui/button";
// removed theme toggle

export default function TarefasLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();

  const useSession = authClient.useSession;
  const {
    data: session,
    isPending: isSessionPending,
    isRefetching: isSessionRefetching,
  } = useSession?.() ?? { data: undefined, isPending: false, isRefetching: false };
  const isSessionLoading = Boolean(isSessionPending || isSessionRefetching);

  useEffect(() => {
    if (isSessionLoading) return;
    if (session === null) {
      router.replace("/login?from=/tarefas");
    }
  }, [isSessionLoading, session, router]);

  const userId = session?.user?.id as string | undefined;
  const userQuery = useGetUser(userId ?? "", { query: { enabled: !!userId } });
  const role = userQuery.data?.role;

  const logout = usePostV1AuthLogout();
  async function handleLogout() {
    try {
      await logout.mutateAsync();
    } finally {
      qc.clear();
      if (typeof window !== "undefined") {
        window.location.replace("/login?from=/tarefas");
      } else {
        router.replace("/login");
        router.refresh();
      }
    }
  }

  const navItems = useMemo(() => {
    if (role === "ADMIN") {
      return [
        { href: "/tarefas/admin", label: "Painel Admin" },
        { href: "/tarefas/minhas", label: "Minhas tarefas" },
        { href: "/tarefas/usuarios", label: "Usuários" },
        { href: "/tarefas/chat", label: "Chat IA" },
      ] as Array<{ href: string; label: string }>;
    }
    return [
      { href: "/tarefas/minhas", label: "Minhas tarefas" },
      { href: "/tarefas/chat", label: "Chat IA" },
    ] as Array<{ href: string; label: string }>;
  }, [role]);

  function isActive(href: string) {
    if (!pathname) return false;
    if (href === "/tarefas/minhas") return pathname.startsWith("/tarefas/minhas");
    if (href === "/tarefas/admin") return pathname.startsWith("/tarefas/admin");
    if (href === "/tarefas/usuarios") return pathname.startsWith("/tarefas/usuarios");
    if (href === "/tarefas/chat") return pathname.startsWith("/tarefas/chat");
    return pathname === href;
  }

  return (
    <main className="max-w-6xl mx-auto min-h-screen p-4 md:p-6">
      <div className="flex gap-6">
        <aside className="w-56 shrink-0">
          <div className="mb-4">
            <Link href="/tarefas/minhas" className="text-xl font-semibold">
              TODOO
            </Link>
          </div>
          <nav className="grid gap-2 text-sm">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "rounded-md px-3 py-2 border " +
                  (isActive(item.href)
                    ? "border-neutral-600 bg-neutral-900"
                    : "border-transparent hover:border-neutral-700 hover:bg-neutral-900")
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 flex items-center justify-between gap-2">
            <span className="text-xs text-neutral-500 truncate">
              {userQuery.isLoading ? "Carregando..." : (userQuery.data?.nome || userQuery.data?.email || "")}
            </span>
            <Button
              onClick={handleLogout}
              disabled={logout.isPending}
              variant="outline"
              size="sm"
            >
              {logout.isPending ? "Saindo..." : "Sair"}
            </Button>
          </div>
        </aside>
        <section className="flex-1 flex flex-col">
          <div className="flex-1 flex flex-col">{children}</div>
        </section>
      </div>
    </main>
  );
}


