import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const apiBaseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const url = `${apiBaseURL.replace(/\/$/, "")}/usuarios/has-any`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data?.hasAny === false) {
        redirect("/register");
      }
    }
  } catch {
    // Em caso de erro na API, segue fluxo padrão para login
  }
  redirect("/login?from=/tarefas");
}
