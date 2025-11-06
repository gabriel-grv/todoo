"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListTasks, listTasksQueryKey } from "./src/generated/useListTasks";
import { useCreateTask } from "./src/generated/useCreateTask";
import { useUpdateTask } from "./src/generated/useUpdateTask";
import { useDeleteTask } from "./src/generated/useDeleteTask";

type UiTask = {
  id: string;
  titulo: string;
  descricao: string;
  completo: boolean;
};

export default function Home() {
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");

  const { data: tasks = [], isLoading } = useListTasks();

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

  const remainingCount = useMemo(
    () => tasks.filter((t) => !t.completo).length,
    [tasks]
  );

  function addTask() {
    const titulo = newTitle.trim();
    if (!titulo) return;
    const descricao = newDescription.trim();
    createTask.mutate({ data: { titulo, descricao, completo: false } });
    setNewTitle("");
    setNewDescription("");
  }

  function startEdit(task: UiTask) {
    setEditingId(task.id);
    setEditingTitle(task.titulo);
    setEditingDescription(task.descricao ?? "");
  }

  function saveEdit() {
    if (!editingId) return;
    const titulo = editingTitle.trim();
    if (!titulo) return;
    const descricao = editingDescription.trim();
    updateTask.mutate({ id: editingId, data: { titulo, descricao, completo: tasks.find(t => t.id === editingId)?.completo ?? false } });
    setEditingId(null);
    setEditingTitle("");
    setEditingDescription("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingTitle("");
    setEditingDescription("");
  }

  function toggleTask(task: UiTask) {
    updateTask.mutate({ id: task.id, data: { titulo: task.titulo, descricao: task.descricao, completo: !task.completo } });
  }

  function removeTask(id: string) {
    deleteTask.mutate({ id });
  }

  function clearCompleted() {
    tasks.filter((t) => t.completo).forEach((t) => deleteTask.mutate({ id: t.id }));
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h1 style={{ marginBottom: 16 }}>Todoo</h1>

      <section
        aria-label="Criar tarefa"
        style={{ display: "grid", gap: 8, marginBottom: 16 }}
      >
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTask();
          }}
          placeholder="Nova tarefa..."
          aria-label="Título da nova tarefa"
          style={{ padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
        />
        <input
          type="text"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTask();
          }}
          placeholder="Descrição (opcional)"
          aria-label="Descrição da nova tarefa"
          style={{ padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
        />
        <div>
          <button
            onClick={addTask}
            disabled={createTask.isPending}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ddd", background: "#111", color: "#fff" }}
          >
            {createTask.isPending ? "Adicionando..." : "Adicionar"}
          </button>
        </div>
      </section>

      <section aria-label="Lista de tarefas" style={{ display: "grid", gap: 8 }}>
        {isLoading ? (
          <p style={{ color: "#666" }}>Carregando...</p>
        ) : tasks.length === 0 ? (
          <p style={{ color: "#666" }}>Nenhuma tarefa ainda. Adicione a primeira!</p>
        ) : (
          tasks.map((task) => (
            <article
              key={task.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: 8,
                border: "1px solid #eee",
                borderRadius: 8,
              }}
            >
              <input
                type="checkbox"
                checked={task.completo}
                onChange={() => toggleTask(task)}
                aria-label={task.completo ? "Marcar como não concluída" : "Marcar como concluída"}
              />

              <div style={{ flex: 1, display: "grid", gap: 6 }}>
                {editingId === task.id ? (
                  <>
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                      aria-label="Editar título da tarefa"
                      placeholder="Título"
                      style={{ padding: 6, border: "1px solid #ddd", borderRadius: 6 }}
                    />
                    <input
                      value={editingDescription}
                      onChange={(e) => setEditingDescription(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                      aria-label="Editar descrição da tarefa"
                      placeholder="Descrição (opcional)"
                      style={{ padding: 6, border: "1px solid #ddd", borderRadius: 6 }}
                    />
                  </>
                ) : (
                  <>
                    <span style={{
                      textDecoration: task.completo ? "line-through" : "none",
                      color: task.completo ? "#888" : "inherit",
                      fontWeight: 500,
                    }}>
                      {task.titulo}
                    </span>
                    {task.descricao ? (
                      <span style={{ color: "#666", fontSize: 14 }}>
                        {task.descricao}
                      </span>
                    ) : null}
                  </>
                )}
              </div>

              {editingId === task.id ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={saveEdit}
                    style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", background: "#111", color: "#fff" }}
                  >
                    Salvar
                  </button>
                  <button
                    onClick={cancelEdit}
                    style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", background: "#fff" }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => startEdit(task)}
                    style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", background: "#fff" }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => removeTask(task.id)}
                    aria-label="Apagar tarefa"
                    style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", color: "#c00" }}
                  >
                    Apagar
                  </button>
                </div>
              )}
            </article>
          ))
        )}
      </section>

      {tasks.length > 0 && (
        <footer style={{ display: "flex", justifyContent: "space-between", marginTop: 16, color: "#555" }}>
          <span>{remainingCount} pendente(s)</span>
          <button
            onClick={clearCompleted}
            disabled={tasks.every((t) => !t.completo)}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", background: "#fff" }}
          >
            Limpar concluídas
          </button>
        </footer>
      )}
    </main>
  );
}
