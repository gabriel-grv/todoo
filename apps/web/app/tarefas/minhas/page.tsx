"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "../../../lib/auth-client";
import { createAbilityFor, subject } from "../../../lib/ability";
import { useGetUser } from "../../src/generated/useGetUser";
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
};

export default function UserTasksPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");

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
      router.replace("/login?from=/tarefas/minhas");
    }
  }, [isSessionLoading, session, router]);

  const userId = session?.user?.id as string | undefined;
  const userQuery = useGetUser(userId ?? "", { query: { enabled: !!userId } });
  const logout = usePostV1AuthLogout();

  useEffect(() => {
    if (userQuery.isLoading) return;
    const role = userQuery.data?.role;
    if (role === "ADMIN") {
      router.replace("/tarefas/admin");
    }
  }, [userQuery.isLoading, userQuery.data?.role, router]);

  const ability = useMemo(() => {
    if (!userId || !userQuery.data?.role) return createAbilityFor(null);
    return createAbilityFor({ id: userId, role: userQuery.data.role });
  }, [userId, userQuery.data?.role]);

  const tasksQuery = useListTasks(
    userId ? { userId } : undefined,
    {
      query: { enabled: !!userId },
    },
  );

  const tasks = useMemo(() => {
    const raw = tasksQuery.data ?? [];
    return raw as unknown as UiTask[];
  }, [tasksQuery.data]);

  const remainingCount = useMemo(
    () => tasks.filter((task) => !task.completo).length,
    [tasks],
  );

  const createTask = useCreateTask({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: listTasksQueryKey({ userId }) }),
    },
  });
  const updateTask = useUpdateTask({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: listTasksQueryKey({ userId }) }),
    },
  });
  const deleteTask = useDeleteTask({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: listTasksQueryKey({ userId }) }),
    },
  });

  function getTaskById(id: string) {
    return tasks.find((task) => task.id === id);
  }

  function addTask() {
    if (!userId) return;
    if (!ability.can("create", subject("Task", { userId }))) return;
    const titulo = newTitle.trim();
    if (!titulo) return;
    const descricao = newDescription.trim();

    createTask.mutate({ data: { titulo, descricao, completo: false, userId } });
    setNewTitle("");
    setNewDescription("");
  }

  function startEdit(task: UiTask) {
    setEditingId(task.id);
    setEditingTitle(task.titulo);
    setEditingDescription(task.descricao ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingTitle("");
    setEditingDescription("");
  }

  function saveEdit() {
    if (!editingId || !userId) return;
    const titulo = editingTitle.trim();
    if (!titulo) return;
    const descricao = editingDescription.trim();
    if (!ability.can("update", subject("Task", { id: editingId, userId }))) return;

    const current = getTaskById(editingId);
    updateTask.mutate({
      id: editingId,
      data: {
        titulo,
        descricao,
        completo: current?.completo ?? false,
        userId,
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

  function clearCompleted() {
    tasks
      .filter((task) => task.completo && ability.can("delete", subject("Task", { id: task.id, userId: task.userId })))
      .forEach((task) => deleteTask.mutate({ id: task.id }));
  }

  const canClearCompleted = tasks.some(
    (task) => task.completo && ability.can("delete", subject("Task", { id: task.id, userId: task.userId })),
  );

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
      <main className="max-w-3xl mx-auto p-4">
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Minhas tarefas</h1>
          <p className="text-sm text-neutral-400">Gerencie suas atividades diárias.</p>
        </div>
        <nav className="flex gap-3 text-sm text-muted">
          <button
            onClick={handleLogout}
            disabled={logout.isPending}
            className="underline disabled:opacity-60"
          >
            {logout.isPending ? "Saindo..." : "Sair"}
          </button>
        </nav>
      </header>

      <section className="grid gap-2 rounded-lg border border-neutral-800 p-4">
        <h2 className="text-lg font-medium">Adicionar nova tarefa</h2>
        <input
          className="w-full rounded-md border border-neutral-800 bg-neutral-950 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-700 px-3 h-10"
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTask();
          }}
          placeholder="Título da tarefa"
        />
        <input
          className="w-full rounded-md border border-neutral-800 bg-neutral-950 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-700 px-3 h-10"
          type="text"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTask();
          }}
          placeholder="Descrição (opcional)"
        />
        <div>
          <button
            onClick={addTask}
            disabled={createTask.isPending}
            className="h-10 px-4 rounded-md border border-neutral-800 bg-white text-black disabled:opacity-60"
          >
            {createTask.isPending ? "Adicionando..." : "Adicionar"}
          </button>
        </div>
      </section>

      <section className="grid gap-2">
        <header className="flex items-center justify-between">
          <span className="text-sm text-neutral-400">
            {remainingCount} tarefa(s) pendente(s)
          </span>
          <button
            onClick={clearCompleted}
            disabled={!canClearCompleted}
            className="h-9 px-3 rounded-md border border-neutral-800 bg-neutral-900 text-sm disabled:opacity-60"
          >
            Limpar concluídas
          </button>
        </header>

        {tasksQuery.isLoading ? (
          <p className="text-muted">Carregando...</p>
        ) : tasks.length === 0 ? (
          <p className="text-muted">Nenhuma tarefa ainda. Adicione a primeira!</p>
        ) : (
          tasks.map((task) => {
            const canUpdate = ability.can("update", subject("Task", { id: task.id, userId: task.userId }));
            const canDelete = ability.can("delete", subject("Task", { id: task.id, userId: task.userId }));
            const isEditing = editingId === task.id;

            return (
              <article
                key={task.id}
                className="flex items-start gap-3 rounded-lg border border-neutral-800 p-4"
              >
                <input
                  type="checkbox"
                  checked={task.completo}
                  onChange={() => toggleTask(task)}
                  disabled={!canUpdate}
                  className="mt-1"
                  aria-label={task.completo ? "Marcar como não concluída" : "Marcar como concluída"}
                />
                <div className="flex-1 space-y-2">
                  {isEditing ? (
                    <>
                      <input
                        autoFocus
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className="w-full rounded-md border border-neutral-800 bg-neutral-950 text-white px-2 h-9"
                      />
                      <input
                        value={editingDescription}
                        onChange={(e) => setEditingDescription(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className="w-full rounded-md border border-neutral-800 bg-neutral-950 text-white px-2 h-9"
                        placeholder="Descrição"
                      />
                    </>
                  ) : (
                    <>
                      <h3 className={(task.completo ? "line-through text-neutral-500 " : "") + "font-medium"}>
                        {task.titulo}
                      </h3>
                      {task.descricao ? (
                        <p className="text-sm text-neutral-400">{task.descricao}</p>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {isEditing ? (
                    <>
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
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}


