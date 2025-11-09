"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "../../lib/auth-client";
import { useGetUser } from "../src/generated/useGetUser";

export default function TarefasPage() {
  const router = useRouter();

  const useSession = authClient.useSession;
  const {
    data: session,
    isPending: isSessionPending,
    isRefetching: isSessionRefetching,
  } = useSession?.() ?? { data: undefined, isPending: false, isRefetching: false };
  const isSessionLoading = Boolean(isSessionPending || isSessionRefetching);

  const userId = session?.user?.id as string | undefined;
  const userQuery = useGetUser(userId ?? "", {
    query: { enabled: !!userId },
  });

  useEffect(() => {
    if (isSessionLoading) return;
    if (session === null) {
      router.replace("/login?from=/tarefas");
    }
  }, [isSessionLoading, session, router]);

  useEffect(() => {
    if (!userId) return;
    if (userQuery.isLoading) return;

    const role = userQuery.data?.role;
    if (role === "ADMIN") {
      router.replace("/tarefas/admin");
      return;
    }
    if (role === "USER") {
      router.replace("/tarefas/minhas");
      return;
    }
  }, [userId, userQuery.isLoading, userQuery.data?.role, router]);

  return (
    <main className="flex min-h-[calc(100vh-2rem)] items-center justify-center p-4">
      <p className="text-muted text-center">Redirecionando...</p>
    </main>
  );
}
