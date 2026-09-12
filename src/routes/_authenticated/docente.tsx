import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { createStudent, changeStudentCode, deleteStudent } from "@/lib/students.functions";
import { KINDS, formatDate, type Entry, type Profile, type Reward } from "@/lib/diario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/docente")({
  head: () => ({
    meta: [
      { title: "Area docente — Diario di Bordo" },
      { name: "description", content: "Gestisci alunni, punti e premi del diario." },
      { property: "og:title", content: "Area docente" },
      { property: "og:description", content: "Alunni, punti e premi del diario." },
    ],
  }),
  component: DocentePage,
});

function DocentePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile, isLoading } = useProfile();
  const [selected, setSelected] = useState<string | null>(null);

  const createFn = useServerFn(createStudent);
  const codeFn = useServerFn(changeStudentCode);
  const deleteFn = useServerFn(deleteStudent);

  useEffect(() => {
    if (profile && profile.role === "studente") navigate({ to: "/diario" });
  }, [profile, navigate]);

  const students = useQuery({
    queryKey: ["students"],
    enabled: !!profile && profile.role === "docente",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, student_code, teacher_id, split_ratio")
        .eq("teacher_id", profile!.id)
        .order("full_name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");

  const addStudent = useMutation({
    mutationFn: async () => createFn({ data: { fullName: newName, code: newCode } }),
    onSuccess: () => {
      setNewName("");
      setNewCode("");
      qc.invalidateQueries({ queryKey: ["students"] });
      toast.success("Alunno registrato. Consegnagli il suo codice.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !profile) return <p className="p-10 text-muted-foreground">Un attimo…</p>;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="hand text-storm">area riservata</p>
          <h1 className="text-4xl font-bold">Ciao {profile.full_name || "prof"}</h1>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            await qc.cancelQueries();
            qc.clear();
            await supabase.auth.signOut();
            navigate({ to: "/", replace: true });
          }}
        >
          Esci
        </Button>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <div className="paper p-5">
            <h2 className="text-xl font-bold">Nuovo alunno</h2>
            <div className="mt-3 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="codice">Codice di accesso</Label>
                <Input
                  id="codice"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="almeno 6 caratteri"
                />
              </div>
              <Button
                className="w-full"
                disabled={addStudent.isPending}
                onClick={() => addStudent.mutate()}
              >
                Registra alunno
              </Button>
            </div>
          </div>

          <div className="paper p-5">
            <h2 className="text-xl font-bold">I miei alunni</h2>
            <ul className="mt-3 space-y-2">
              {(students.data ?? []).map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setSelected(s.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                      selected === s.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <span className="font-semibold">{s.full_name}</span>
                    <span className="block text-xs text-muted-foreground">
                      codice: {s.student_code}
                    </span>
                  </button>
                </li>
              ))}
              {(students.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Nessun alunno registrato.</p>
              )}
            </ul>
          </div>
        </aside>

        {selected ? (
          <StudentPanel
            key={selected}
            student={(students.data ?? []).find((s) => s.id === selected)!}
            onCodeChange={async (code) => {
              try {
                await codeFn({ data: { studentId: selected, code } });
                qc.invalidateQueries({ queryKey: ["students"] });
                toast.success("Codice aggiornato.");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
            onDelete={async () => {
              try {
                await deleteFn({ data: { studentId: selected } });
                setSelected(null);
                qc.invalidateQueries({ queryKey: ["students"] });
                toast.success("Alunno eliminato.");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          />
        ) : (
          <div className="paper flex items-center justify-center p-10 text-muted-foreground">
            Scegli un alunno per vedere il suo diario, assegnare punti e concordare i premi.
          </div>
        )}
      </div>
    </main>
  );
}

function StudentPanel({
  student,
  onCodeChange,
  onDelete,
}: {
  student: Profile;
  onCodeChange: (code: string) => void;
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [notePoints, setNotePoints] = useState(2);
  const [rewardTitle, setRewardTitle] = useState("");
  const [rewardCost, setRewardCost] = useState(20);
  const [codeDraft, setCodeDraft] = useState(student.student_code ?? "");

  const entries = useQuery({
    queryKey: ["entries", student.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .eq("student_id", student.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Entry[];
    },
  });

  const rewards = useQuery({
    queryKey: ["rewards", student.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rewards")
        .select("*")
        .eq("student_id", student.id)
        .order("cost");
      if (error) throw error;
      return data as Reward[];
    },
  });

  const earned = (entries.data ?? []).reduce((s, e) => s + e.points, 0);
  const spent = (rewards.data ?? []).filter((r) => r.redeemed_at).reduce((s, r) => s + r.cost, 0);
  const balance = earned - spent;

  const setPoints = useMutation({
    mutationFn: async ({ id, points }: { id: string; points: number }) => {
      const { error } = await supabase.from("entries").update({ points }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries", student.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const addNote = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("entries").insert({
        student_id: student.id,
        author_id: userData.user!.id,
        kind: "libera",
        title: note.trim(),
        points: notePoints,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["entries", student.id] });
      toast.success("Punti assegnati.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addReward = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rewards").insert({
        student_id: student.id,
        title: rewardTitle.trim(),
        cost: rewardCost,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setRewardTitle("");
      qc.invalidateQueries({ queryKey: ["rewards", student.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleReward = useMutation({
    mutationFn: async (r: Reward) => {
      const { error } = await supabase
        .from("rewards")
        .update({ redeemed_at: r.redeemed_at ? null : new Date().toISOString() })
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rewards", student.id] }),
  });

  return (
    <div className="space-y-6">
      <div className="paper flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="text-3xl font-bold">{student.full_name}</h2>
          <p className="text-sm text-muted-foreground">Codice: {student.student_code}</p>
        </div>
        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Punti disponibili</p>
          <p className="text-4xl font-bold text-positive">{balance}</p>
        </div>
      </div>

      <div className="paper p-5">
        <h3 className="text-xl font-bold">Assegna punti con una nota</h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-52 flex-1 space-y-1">
            <Label htmlFor="nota">Motivo</Label>
            <Input
              id="nota"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="es. ha aiutato un compagno in mensa"
            />
          </div>
          <div className="w-24 space-y-1">
            <Label htmlFor="punti">Punti</Label>
            <Input
              id="punti"
              type="number"
              value={notePoints}
              onChange={(e) => setNotePoints(Number(e.target.value))}
            />
          </div>
          <Button
            disabled={!note.trim() || addNote.isPending}
            onClick={() => addNote.mutate()}
          >
            Assegna
          </Button>
        </div>
      </div>

      <div className="paper p-5">
        <h3 className="text-xl font-bold">Premi concordati</h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-52 flex-1 space-y-1">
            <Label htmlFor="premio">Premio</Label>
            <Input
              id="premio"
              value={rewardTitle}
              onChange={(e) => setRewardTitle(e.target.value)}
              placeholder="es. 20 minuti di gioco scelto da te"
            />
          </div>
          <div className="w-24 space-y-1">
            <Label htmlFor="costo">Punti</Label>
            <Input
              id="costo"
              type="number"
              value={rewardCost}
              onChange={(e) => setRewardCost(Number(e.target.value))}
            />
          </div>
          <Button disabled={!rewardTitle.trim()} onClick={() => addReward.mutate()}>
            Aggiungi
          </Button>
        </div>
        <ul className="mt-4 space-y-2">
          {(rewards.data ?? []).map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
            >
              <span>
                🎁 {r.title} · <span className="text-muted-foreground">{r.cost} punti</span>
              </span>
              <Button
                size="sm"
                variant={r.redeemed_at ? "outline" : "default"}
                onClick={() => toggleReward.mutate(r)}
              >
                {r.redeemed_at ? "Annulla riscatto" : "Segna come conquistato"}
              </Button>
            </li>
          ))}
          {(rewards.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nessun premio concordato.</p>
          )}
        </ul>
      </div>

      <div className="paper p-5">
        <h3 className="text-xl font-bold">Il diario di {student.full_name}</h3>
        <ul className="mt-4 space-y-3">
          {(entries.data ?? []).map((e) => (
            <li key={e.id} className="rounded-2xl border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {KINDS[e.kind].emoji} {KINDS[e.kind].label} · {formatDate(e.occurred_on)}
              </p>
              <p className="hand mt-1 text-2xl">{e.title}</p>
              {e.intensity && (
                <p className="text-sm text-storm">Intensità: {"🌩️".repeat(e.intensity)}</p>
              )}
              {e.trigger_text && (
                <p className="text-sm text-muted-foreground">Scatenata da: {e.trigger_text}</p>
              )}
              {e.strategy_text && (
                <p className="text-sm text-muted-foreground">Come è finita: {e.strategy_text}</p>
              )}
              {e.body && <p className="mt-1 text-sm">{e.body}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Punti: {e.points}</span>
                {[1, 2, 5].map((n) => (
                  <Button
                    key={n}
                    size="sm"
                    variant="outline"
                    onClick={() => setPoints.mutate({ id: e.id, points: e.points + n })}
                  >
                    +{n}
                  </Button>
                ))}
                {e.points !== 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPoints.mutate({ id: e.id, points: 0 })}
                  >
                    azzera
                  </Button>
                )}
              </div>
            </li>
          ))}
          {(entries.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Il diario è ancora vuoto.</p>
          )}
        </ul>
      </div>

      <div className="paper p-5">
        <h3 className="text-xl font-bold">Impostazioni alunno</h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-52 flex-1 space-y-1">
            <Label htmlFor="nuovo-codice">Cambia codice di accesso</Label>
            <Input
              id="nuovo-codice"
              value={codeDraft}
              onChange={(e) => setCodeDraft(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => onCodeChange(codeDraft)}>
            Salva codice
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Eliminare l'alunno e tutto il suo diario?")) onDelete();
            }}
          >
            Elimina alunno
          </Button>
        </div>
      </div>
    </div>
  );
}
