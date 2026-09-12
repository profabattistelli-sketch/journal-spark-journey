import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Area docente — Diario di Bordo" },
      {
        name: "description",
        content: "Accesso riservato all'insegnante per gestire diari, punti e premi.",
      },
      { property: "og:title", content: "Area docente" },
      { property: "og:description", content: "Accesso riservato all'insegnante." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeCode(username);
    if (clean.length < 3) {
      toast.error("Scegli un nome utente di almeno 3 lettere (senza spazi).");
      return;
    }
    setLoading(true);
    const email = usernameToEmail(clean);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName || clean, role: "docente" },
        },
      });
      if (error) {
        setLoading(false);
        toast.error(
          error.message.includes("already")
            ? "Questo nome utente è già in uso: scegline un altro."
            : error.message,
        );
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (signInError) {
        toast.success("Accesso creato. Ora puoi entrare.");
        setMode("login");
        return;
      }
      navigate({ to: "/docente" });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Nome utente o password non corretti.");
      return;
    }
    navigate({ to: "/docente" });
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← Torna all'inizio
      </Link>
      <div className="paper mt-4 p-7">
        <span className="text-4xl">🍎</span>
        <h1 className="mt-3 text-3xl font-bold">
          {mode === "login" ? "Area docente" : "Crea il tuo accesso"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Riservato all'insegnante: qui si creano i codici degli alunni, i punti e i premi.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Nome e cognome</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="username">Nome utente</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="es. maestra-anna"
            />
            {mode === "signup" && (
              <p className="text-xs text-muted-foreground">
                Solo lettere, numeri e trattini. Servirà per entrare ogni volta.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Un attimo…" : mode === "login" ? "Entra" : "Crea l'accesso"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 w-full text-sm text-primary hover:underline"
        >
          {mode === "login"
            ? "Non hai ancora un accesso? Creane uno"
            : "Hai già un accesso? Entra"}
        </button>
      </div>
    </main>
  );
}
