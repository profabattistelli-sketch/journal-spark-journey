import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { codeToEmail, normalizeCode } from "@/lib/diario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/entra")({
  head: () => ({
    meta: [
      { title: "Entra nel tuo diario — Diario di Bordo" },
      { name: "description", content: "Inserisci il codice che ti ha dato l'insegnante." },
      { property: "og:title", content: "Entra nel tuo diario" },
      { property: "og:description", content: "Accesso alunno con codice personale." },
    ],
  }),
  component: EntraPage,
});

function EntraPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeCode(code);
    if (clean.length < 6) {
      toast.error("Il codice ha almeno 6 caratteri.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: codeToEmail(clean),
      password: clean,
    });
    setLoading(false);
    if (error) {
      toast.error("Codice non riconosciuto. Chiedi aiuto all'insegnante.");
      return;
    }
    navigate({ to: "/diario" });
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← Torna all'inizio
      </Link>
      <div className="paper mt-4 p-7">
        <span className="text-4xl">🎒</span>
        <h1 className="mt-3 text-3xl font-bold">Il tuo codice</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Scrivi il codice segreto che ti ha dato l'insegnante.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Codice</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="es. leone-2024"
              autoComplete="off"
              className="hand text-2xl"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Un attimo…" : "Apri il diario"}
          </Button>
        </form>
      </div>
    </main>
  );
}
