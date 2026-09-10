import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useIsMobile } from "@/hooks/use-mobile";
import { DoodleCanvas } from "@/components/DoodleCanvas";
import {
  KINDS,
  POSITIVE_KINDS,
  formatDate,
  type Entry,
  type Kind,
  type Reward,
} from "@/lib/diario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/diario")({
  head: () => ({
    meta: [
      { title: "Il mio diario — Diario di Bordo" },
      { name: "description", content: "Le mie arrabbiature, i miei successi e i miei punti." },
      { property: "og:title", content: "Il mio diario" },
      { property: "og:description", content: "Arrabbiature, successi, punti e premi." },
    ],
  }),
  component: DiarioPage,
});

interface Doodle {
  id: string;
  image: string;
  caption: string;
  created_at: string;
}

function DiarioPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile, isLoading } = useProfile();
  const studentId = profile?.id;

  useEffect(() => {
    if (profile && profile.role === "docente") navigate({ to: "/docente" });
  }, [profile, navigate]);

  const entries = useQuery({
    queryKey: ["entries", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .eq("student_id", studentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Entry[];
    },
  });

  const rewards = useQuery({
    queryKey: ["rewards", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rewards")
        .select("*")
        .eq("student_id", studentId!)
        .order("cost");
      if (error) throw error;
      return data as Reward[];
    },
  });

  const doodles = useQuery({
    queryKey: ["doodles", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doodles")
        .select("id, image, caption, created_at")
        .eq("student_id", studentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Doodle[];
    },
  });

  const earned = (entries.data ?? []).reduce((sum, e) => sum + e.points, 0);
  const spent = (rewards.data ?? [])
    .filter((r) => r.redeemed_at)
    .reduce((sum, r) => sum + r.cost, 0);
  const balance = earned - spent;

  const addEntry = useMutation({
    mutationFn: async (entry: Partial<Entry> & { kind: Kind }) => {
      const { error } = await supabase.from("entries").insert({
        ...entry,
        student_id: studentId!,
        author_id: studentId!,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries", studentId] });
      toast.success("Scritto nel diario!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries", studentId] }),
  });

  const saveDoodle = useMutation({
    mutationFn: async (image: string) => {
      const { error } = await supabase
        .from("doodles")
        .insert({ student_id: studentId!, image } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doodles", studentId] });
      toast.success("Disegno salvato nel diario.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeDoodle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("doodles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["doodles", studentId] }),
  });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRatio = (ratio: number) => {
    if (!studentId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void supabase.from("profiles").update({ split_ratio: ratio }).eq("id", studentId);
    }, 600);
  };

  const isMobile = useIsMobile();

  if (isLoading || !profile) {
    return <p className="p-10 text-muted-foreground">Apro il diario…</p>;
  }

  const positives = (entries.data ?? []).filter((e) => KINDS[e.kind].side === "pos");
  const storms = (entries.data ?? []).filter((e) => KINDS[e.kind].side === "neg");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="hand text-storm">il diario di</p>
          <h1 className="text-4xl font-bold">{profile.full_name || "me"}</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="paper px-5 py-3 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Punti</p>
            <p className="text-3xl font-bold text-positive">{balance}</p>
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
        </div>
      </header>

      <p className="mt-6 text-sm text-muted-foreground">
        Trascina la linea in mezzo per dare più spazio alla parte che ti serve di più oggi.
      </p>

      <ResizablePanelGroup
        direction={isMobile ? "vertical" : "horizontal"}
        onLayout={(sizes) => saveRatio(Math.round(sizes[0] ?? 60))}
        className="mt-3 min-h-[560px] rounded-3xl"
      >
        <ResizablePanel defaultSize={profile.split_ratio} minSize={20}>
          <section className="paper mr-0 h-full overflow-y-auto border-positive/40 bg-positive-soft/40 p-5 md:mr-2">
            <h2 className="text-2xl font-bold text-positive">Cose belle</h2>
            <p className="text-sm text-muted-foreground">
              Successi, lavori finiti, gesti gentili, strategie che funzionano.
            </p>
            <EntryComposer
              kinds={POSITIVE_KINDS}
              onSubmit={(v) => addEntry.mutate(v)}
              busy={addEntry.isPending}
            />
            <div className="mt-5 space-y-3">
              {positives.map((e) => (
                <EntryCard key={e.id} entry={e} onDelete={() => removeEntry.mutate(e.id)} />
              ))}
              {positives.length === 0 && (
                <p className="hand text-muted-foreground">Ancora niente qui… scrivi la prima!</p>
              )}
            </div>
          </section>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={100 - profile.split_ratio} minSize={20}>
          <section className="paper ml-0 h-full overflow-y-auto border-storm/40 bg-storm-soft/40 p-5 md:ml-2">
            <h2 className="text-2xl font-bold text-storm">Arrabbiature</h2>
            <p className="text-sm text-muted-foreground">
              Cosa è successo, quanto era forte e come è andata a finire.
            </p>
            <EntryComposer
              kinds={["arrabbiatura"]}
              onSubmit={(v) => addEntry.mutate(v)}
              busy={addEntry.isPending}
            />
            <div className="mt-5 space-y-3">
              {storms.map((e) => (
                <EntryCard key={e.id} entry={e} onDelete={() => removeEntry.mutate(e.id)} />
              ))}
              {storms.length === 0 && (
                <p className="hand text-muted-foreground">Nessuna arrabbiatura annotata.</p>
              )}
            </div>
          </section>
        </ResizablePanel>
      </ResizablePanelGroup>

      <section className="paper mt-8 p-5">
        <h2 className="text-2xl font-bold">Lavagna: pasticcia pure</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Disegna con il dito o con il mouse, poi salva il disegno nel diario.
        </p>
        <DoodleCanvas onSave={(img) => saveDoodle.mutate(img)} saving={saveDoodle.isPending} />
        {(doodles.data ?? []).length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(doodles.data ?? []).map((d) => (
              <figure key={d.id} className="rounded-xl border border-border bg-card p-2">
                <img src={d.image} alt="Disegno del diario" className="rounded-lg" />
                <figcaption className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  {formatDate(d.created_at)}
                  <button
                    className="hover:text-destructive"
                    onClick={() => removeDoodle.mutate(d.id)}
                  >
                    elimina
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      <section className="paper mt-8 p-5">
        <h2 className="text-2xl font-bold">I premi da conquistare</h2>
        {(rewards.data ?? []).length === 0 ? (
          <p className="hand mt-2 text-muted-foreground">
            Nessun premio concordato per ora.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {(rewards.data ?? []).map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">🎁 {r.title}</span>
                  <span className="text-sm text-muted-foreground">{r.cost} punti</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-positive transition-all"
                    style={{ width: `${Math.min(100, (balance / Math.max(1, r.cost)) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.redeemed_at
                    ? `Conquistato il ${formatDate(r.redeemed_at)} 🎉`
                    : balance >= r.cost
                      ? "Ce l'hai fatta! Parlane con l'insegnante."
                      : `Mancano ${r.cost - balance} punti`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function EntryComposer({
  kinds,
  onSubmit,
  busy,
}: {
  kinds: Kind[];
  onSubmit: (v: Partial<Entry> & { kind: Kind }) => void;
  busy: boolean;
}) {
  const [kind, setKind] = useState<Kind>(kinds[0]!);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [intensity, setIntensity] = useState(3);
  const [trigger, setTrigger] = useState("");
  const [strategy, setStrategy] = useState("");
  const isStorm = kind === "arrabbiatura";

  return (
    <form
      className="mt-4 space-y-3 rounded-2xl border border-border bg-card/80 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) {
          toast.error("Scrivi almeno due parole nel titolo.");
          return;
        }
        onSubmit({
          kind,
          title: title.trim(),
          body: body.trim(),
          intensity: isStorm ? intensity : null,
          trigger_text: isStorm ? trigger.trim() : null,
          strategy_text: strategy.trim() || null,
        });
        setTitle("");
        setBody("");
        setTrigger("");
        setStrategy("");
        setIntensity(3);
      }}
    >
      {kinds.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                kind === k
                  ? "border-positive bg-positive text-positive-foreground"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              {KINDS[k].emoji} {KINDS[k].label}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor={`t-${kind}`}>{isStorm ? "Cosa è successo?" : "Che cosa è andato bene?"}</Label>
        <Input
          id={`t-${kind}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={KINDS[kind].hint}
          className="hand text-xl"
        />
      </div>

      {isStorm && (
        <>
          <div className="space-y-1">
            <Label>Quanto era forte?</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setIntensity(n)}
                  className={`size-9 rounded-full border text-sm font-bold transition-colors ${
                    intensity === n
                      ? "border-storm bg-storm text-storm-foreground"
                      : "border-border bg-background"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="trigger">Cosa l'ha fatta partire?</Label>
            <Input
              id="trigger"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder="es. mi hanno preso in giro"
            />
          </div>
        </>
      )}

      <div className="space-y-1">
        <Label htmlFor={`s-${kind}`}>
          {isStorm ? "Come è finita / cosa mi ha aiutato" : "Vuoi aggiungere qualcosa?"}
        </Label>
        <Textarea
          id={`s-${kind}`}
          value={isStorm ? strategy : body}
          onChange={(e) => (isStorm ? setStrategy(e.target.value) : setBody(e.target.value))}
          rows={2}
        />
      </div>

      <Button type="submit" disabled={busy} className="w-full">
        Scrivi nel diario
      </Button>
    </form>
  );
}

function EntryCard({ entry, onDelete }: { entry: Entry; onDelete?: () => void }) {
  const meta = KINDS[entry.kind];
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-paper">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {meta.emoji} {meta.label} · {formatDate(entry.occurred_on)}
          </p>
          <h3 className="hand mt-1 text-2xl">{entry.title}</h3>
        </div>
        {entry.points > 0 && (
          <span className="shrink-0 rounded-full bg-positive px-3 py-1 text-sm font-bold text-positive-foreground">
            +{entry.points}
          </span>
        )}
      </div>
      {entry.intensity && (
        <p className="mt-2 text-sm text-storm">Intensità: {"🌩️".repeat(entry.intensity)}</p>
      )}
      {entry.trigger_text && (
        <p className="mt-1 text-sm text-muted-foreground">Scatenata da: {entry.trigger_text}</p>
      )}
      {entry.strategy_text && (
        <p className="mt-1 text-sm text-muted-foreground">Come è finita: {entry.strategy_text}</p>
      )}
      {entry.body && <p className="mt-2 text-sm">{entry.body}</p>}
      {onDelete && (
        <button
          onClick={onDelete}
          className="mt-3 text-xs text-muted-foreground hover:text-destructive"
        >
          elimina
        </button>
      )}
    </article>
  );
}
