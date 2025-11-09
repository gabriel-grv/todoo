"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "../../../lib/auth-client";
import { createAbilityFor, subject } from "../../../lib/ability";
import { useGetUser } from "../../src/generated/useGetUser";
import { useListUsers } from "../../src/generated/useListUsers";
import { useListTasks, listTasksQueryKey } from "../../src/generated/useListTasks";
import { useCreateTask } from "../../src/generated/useCreateTask";
import { useUpdateTask } from "../../src/generated/useUpdateTask";
import { useDeleteTask } from "../../src/generated/useDeleteTask";
import { usePostV1AuthLogout } from "../../src/generated/usePostV1AuthLogout";

type UiTask = {
  id: string;
  titulo: string;
  descricao: string;
  completo: boolean;
  userId: string;
  owner?: {
    id: string;
    nome: string | null;
    email: string;
    role: "ADMIN" | "USER";
  };
};

type UiUser = {
  id: string;
  nome: string;
  email: string;
  role: "ADMIN" | "USER";
};

export default function AdminTasksPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newOwnerId, setNewOwnerId] = useState<string | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingOwnerId, setEditingOwnerId] = useState<string | null>(null);

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
      router.replace("/login?from=/tarefas/admin");
    }
  }, [isSessionLoading, session, router]);

  const userId = session?.user?.id as string | undefined;
  const userQuery = useGetUser(userId ?? "", { query: { enabled: !!userId } });
  const logout = usePostV1AuthLogout();

  useEffect(() => {
    if (userQuery.isLoading) return;
    const role = userQuery.data?.role;
    if (role && role !== "ADMIN") {
      router.replace("/tarefas/minhas");
    }
  }, [userQuery.isLoading, userQuery.data?.role, router]);

  const ability = useMemo(() => {
    if (!userId) return createAbilityFor(null);
    return createAbilityFor({ id: userId, role: "ADMIN" });
  }, [userId]);

  const usersQuery = useListUsers({
    query: { enabled: true },
  });

  const availableUsers = useMemo(() => {
    const raw = usersQuery.data ?? [];
    return raw as unknown as UiUser[];
  }, [usersQuery.data]);

  useEffect(() => {
    if (!newOwnerId && userId) {
      setNewOwnerId(userId);
    }
  }, [newOwnerId, userId]);

  useEffect(() => {
    if (!newOwnerId && availableUsers.length > 0) {
      setNewOwnerId(availableUsers[0]?.id);
    }
  }, [availableUsers, newOwnerId]);

  const tasksQuery = useListTasks(undefined, {
    query: {
      enabled: Boolean(userId && userQuery.data?.role === "ADMIN"),
    },
  });

  const tasks = useMemo(() => {
    const raw = tasksQuery.data ?? [];
    return raw as unknown as UiTask[];
  }, [tasksQuery.data]);

  const createTask = useCreateTask({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: listTasksQueryKey() }),
    },
  });
  const updateTask = useUpdateTask({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: listTasksQueryKey() }),
    },
  });
  const deleteTask = useDeleteTask({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: listTasksQueryKey() }),
    },
  });

  function getTaskById(id: string) {
    return tasks.find((task) => task.id === id);
  }

  function addTask() {
    const titulo = newTitle.trim();
    if (!titulo) return;
    const descricao = newDescription.trim();
    const ownerId = newOwnerId;
    if (!ownerId) return;
    if (!ability.can("create", subject("Task", { userId: ownerId }))) return;

    createTask.mutate({ data: { titulo, descricao, completo: false, userId: ownerId } });
    setNewTitle("");
    setNewDescription("");
  }

  function startEdit(task: UiTask) {
    setEditingId(task.id);
    setEditingTitle(task.titulo);
    setEditingDescription(task.descricao ?? "");
    setEditingOwnerId(task.userId);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingTitle("");
    setEditingDescription("");
    setEditingOwnerId(null);
  }

  function saveEdit() {
    if (!editingId) return;
    const titulo = editingTitle.trim();
    if (!titulo) return;
    const descricao = editingDescription.trim();
    const ownerId = editingOwnerId ?? getTaskById(editingId)?.userId;
    if (!ownerId) return;
    if (!ability.can("update", subject("Task", { id: editingId, userId: ownerId }))) return;

    const current = getTaskById(editingId);
    updateTask.mutate({
      id: editingId,
      data: {
        titulo,
        descricao,
        completo: current?.completo ?? false,
        userId: ownerId,
      },
    });
    cancelEdit();
  }

  function toggleTask(task: UiTask) {
    if (!ability.can("update", subject("Task", { id: task.id, userId: task.userId }))) return;
    updateTask.mutate({
      id: task.id,
      data: {
        titulo: task.titulo,
        descricao: task.descricao,
        completo: !task.completo,
        userId: task.userId,
      },
    });
  }

  function removeTask(id: string) {
    const task = getTaskById(id);
    if (!task) return;
    if (!ability.can("delete", subject("Task", { id: task.id, userId: task.userId }))) return;
    deleteTask.mutate({ id: task.id });
  }

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

  if (isSessionLoading || userQuery.isLoading) {
    return (
      <main className="max-w-5xl mx-auto p-6">
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Painel de Tarefas (Admin)</h1>
          <p className="text-sm text-neutral-400">
            Gerencie todas as tarefas e usuários do sistema.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm text-muted">
          <Link className="underline" href="/register?from=/tarefas/admin">Novo usuário</Link>
          <button
            onClick={handleLogout}
            disabled={logout.isPending}
            className="underline disabled:opacity-60"
          >
            {logout.isPending ? "Saindo..." : "Sair"}
          </button>
        </nav>
      </header>

      <section aria-label="Criar tarefa" className="grid gap-3 rounded-lg border border-neutral-800 p-4">
        <h2 className="text-lg font-medium">Criar nova tarefa</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs uppercase tracking-wide text-neutral-400">Título</span>
            <input
              className="rounded-md border border-neutral-800 bg-neutral-950 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-700 px-3 h-10"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTask();
              }}
              placeholder="Nova tarefa..."
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs uppercase tracking-wide text-neutral-400">Responsável</span>
            <select
              className="h-10 rounded-md border border-neutral-800 bg-neutral-950 text-white focus:outline-none focus:ring-2 focus:ring-neutral-700 px-3"
              value={newOwnerId ?? ""}
              onChange={(e) => setNewOwnerId(e.target.value || undefined)}
            >
              {availableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {(user.nome || user.email) ?? user.email} ({user.role})
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="grid gap-1">
          <span className="text-xs uppercase tracking-wide text-neutral-400">Descrição</span>
          <input
            className="rounded-md border border-neutral-800 bg-neutral-950 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-700 px-3 h-10"
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Descrição (opcional)"
          />
        </label>
        <div className="flex justify-end">
          <button
            onClick={addTask}
            disabled={createTask.isPending || !newOwnerId}
            className="h-10 px-4 rounded-md border border-neutral-800 bg-white text-black disabled:opacity-60"
          >
            {createTask.isPending ? "Adicionando..." : "Adicionar"}
          </button>
        </div>
      </section>

      <section aria-label="Lista completa de tarefas" className="rounded-lg border border-neutral-800 overflow-hidden">
        <header className="flex items-center justify-between bg-neutral-950/80 px-4 py-3">
          <div>
            <h2 className="text-lg font-medium">Todas as tarefas</h2>
            <p className="text-xs text-neutral-500">{tasks.length} registro(s)</p>
          </div>
          <button
            onClick={() => tasks
              .filter((task) => task.completo && ability.can("delete", subject("Task", { id: task.id, userId: task.userId })))
              .forEach((task) => deleteTask.mutate({ id: task.id }))}
            disabled={!tasks.some((task) => task.completo && ability.can("delete", subject("Task", { id: task.id, userId: task.userId })))}
            className="h-9 px-3 rounded-md border border-neutral-800 bg-neutral-900 text-sm disabled:opacity-60"
          >
            Limpar concluídas
          </button>
        </header>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-950 text-neutral-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tasksQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                    Carregando...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                    Nenhuma tarefa cadastrada até o momento.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => {
                  const canUpdate = ability.can("update", subject("Task", { id: task.id, userId: task.userId }));
                  const canDelete = ability.can("delete", subject("Task", { id: task.id, userId: task.userId }));

                  const isEditing = editingId === task.id;
                  return (
                    <tr key={task.id} className="border-t border-neutral-800">
                      <td className="px-4 py-3 align-top">
                        {isEditing ? (
                          <input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="w-full rounded-md border border-neutral-800 bg-neutral-950 text-white px-2 h-9"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit();
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                        ) : (
                          <div className="font-medium">{task.titulo}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {isEditing ? (
                          <input
                            value={editingDescription}
                            onChange={(e) => setEditingDescription(e.target.value)}
                            className="w-full rounded-md border border-neutral-800 bg-neutral-950 text-white px-2 h-9"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit();
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                        ) : (
                          <span className="text-neutral-400">
                            {task.descricao || "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {isEditing ? (
                          <select
                            value={editingOwnerId ?? ""}
                            onChange={(e) => setEditingOwnerId(e.target.value)}
                            className="w-full rounded-md border border-neutral-800 bg-neutral-950 text-white px-2 h-9"
                          >
                            {availableUsers.map((user) => (
                              <option key={user.id} value={user.id}>
                                {(user.nome || user.email) ?? user.email} ({user.role})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="text-neutral-300">
                            <div>{task.owner?.nome || task.owner?.email || "Sem usuário"}</div>
                            <span className="text-xs uppercase text-neutral-500">{task.owner?.role ?? "N/A"}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <button
                          onClick={() => toggleTask(task)}
                          disabled={!canUpdate}
                          className="rounded-full border border-neutral-700 px-3 py-1 text-xs uppercase tracking-wide disabled:opacity-60"
                        >
                          {task.completo ? "Concluída" : "Pendente"}
                        </button>
                      </td>
                      <td className="px-4 py-3 align-top text-right space-y-2">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={saveEdit}
                              className="h-9 px-3 rounded-md border border-neutral-800 bg-white text-black"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="h-9 px-3 rounded-md border border-neutral-800 bg-neutral-900"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => startEdit(task)}
                              disabled={!canUpdate}
                              className="h-9 px-3 rounded-md border border-neutral-800 bg-neutral-900 disabled:opacity-60"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => removeTask(task.id)}
                              disabled={!canDelete}
                              className="h-9 px-3 rounded-md border border-neutral-800 bg-neutral-900 text-red-400 disabled:opacity-60"
                            >
                              Apagar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}


