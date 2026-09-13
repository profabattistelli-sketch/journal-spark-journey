import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { KINDS, formatDate, type Entry } from "@/lib/diario";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/il-mio-diario")({
  head: () => ({
    meta: [
      { title: "Il mio diario giorno per giorno — Diario di Bordo" },
      {
        name: "description",
        content:
          "Tutte le giornate del diario: cose belle, arrabbiature, disegni della lavagna e punti.",
      },
      { property: "og:title", content: "Il mio diario giorno per giorno" },
      {
        property: "og:description",
        content: "Cose belle, arrabbiature, disegni e punti raccolti giorno per giorno.",
      },
    ],
  }),
  component: MyDiaryPage,
});

interface Doodle {
  id: string;
  image: string;
  caption: string;
  created_at: string;
}

const MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

const monthKey = (isoDate: string) => isoDate.slice(0, 7);
const monthLabel = (key: string) => {
  const [year, month] = key.split("-");
  return `${MONTHS[Number(month) - 1]} ${year}`;
};

function MyDiaryPage() {
  const navigate = useNavigate();
  const { data: profile, isLoading } = useProfile();
  const studentId = profile?.id;
  const [month, setMonth] = useState("all");

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

  const days = useMemo(() => {
    const map = new Map<
      string,
      { date: string; positives: Entry[]; storms: Entry[]; doodles: Doodle[]; points: number }
    >();
    const get = (date: string) => {
      let day = map.get(date);
      if (!day) {
        day = { date, positives: [], storms: [], doodles: [], points: 0 };
        map.set(date, day);
      }
      return day;
    };

    for (const entry of entries.data ?? []) {
      const day = get(entry.occurred_on);
      if (KINDS[entry.kind].side === "pos") day.positives.push(entry);
      else day.storms.push(entry);
      day.points += entry.points;
    }
    for (const doodle of doodles.data ?? []) {
      get(doodle.created_at.slice(0, 10)).doodles.push(doodle);
    }

    return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [entries.data, doodles.data]);

  const months = useMemo(() => {
    const keys = [...new Set(days.map((d) => monthKey(d.date)))];
    return keys.sort().reverse();
  }, [days]);

  const visible = month === "all" ? days : days.filter((d) => monthKey(d.date) === month);

  if (isLoading || !profile) {
    return <p className="p-10 text-muted-foreground">Apro il diario…</p>;
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="hand text-storm">giorno per giorno</p>
          <h1 className="text-4xl font-bold">Il mio diario</h1>
        </div>
        <Link to="/diario">
          <Button variant="outline">← Torna a scrivere</Button>
        </Link>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label htmlFor="mese" className="text-sm text-muted-foreground">
          Mostra il mese:
        </label>
        <select
          id="mese"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">Tutti i mesi</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="hand mt-10 text-xl text-muted-foreground">
          Ancora nessuna giornata da rileggere qui.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {visible.map((day) => (
            <article key={day.date} className="paper p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                <h2 className="text-2xl font-bold">{formatDate(day.date)}</h2>
                {day.points !== 0 && (
                  <span className="rounded-full bg-positive px-4 py-1 text-sm font-bold text-positive-foreground">
                    {day.points > 0 ? `+${day.points}` : day.points} punti
                  </span>
                )}
              </div>

              {day.positives.length > 0 && (
                <section className="mt-4">
                  <h3 className="text-lg font-semibold text-positive">Cose belle</h3>
                  <ul className="mt-2 space-y-2">
                    {day.positives.map((e) => (
                      <li
                        key={e.id}
                        className="rounded-xl border border-positive/40 bg-positive-soft/40 p-3"
                      >
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {KINDS[e.kind].emoji} {KINDS[e.kind].label}
                        </p>
                        <p className="hand text-xl">{e.title}</p>
                        {e.body && <p className="mt-1 text-sm">{e.body}</p>}
                        {e.strategy_text && (
                          <p className="mt-1 text-sm text-muted-foreground">{e.strategy_text}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {day.storms.length > 0 && (
                <section className="mt-4">
                  <h3 className="text-lg font-semibold text-storm">Arrabbiature</h3>
                  <ul className="mt-2 space-y-2">
                    {day.storms.map((e) => (
                      <li key={e.id} className="rounded-xl border border-storm/40 bg-storm-soft/40 p-3">
                        <p className="hand text-xl">{e.title}</p>
                        {e.intensity && (
                          <p className="mt-1 text-sm text-storm">
                            Intensità {e.intensity}/5 {"🌩️".repeat(e.intensity)}
                          </p>
                        )}
                        {e.trigger_text && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            Scatenata da: {e.trigger_text}
                          </p>
                        )}
                        {e.strategy_text && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            Come è finita: {e.strategy_text}
                          </p>
                        )}
                        {e.body && <p className="mt-1 text-sm">{e.body}</p>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {day.doodles.length > 0 && (
                <section className="mt-4">
                  <h3 className="text-lg font-semibold">Dalla lavagna</h3>
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {day.doodles.map((d) => (
                      <img
                        key={d.id}
                        src={d.image}
                        alt={`Disegno del ${formatDate(day.date)}`}
                        className="rounded-xl border border-border bg-card p-1"
                      />
                    ))}
                  </div>
                </section>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
