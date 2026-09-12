export type Kind = "arrabbiatura" | "successo" | "lavoro" | "gentilezza" | "strategia" | "libera";

export const KINDS: Record<
  Kind,
  { label: string; emoji: string; side: "pos" | "neg"; hint: string }
> = {
  successo: {
    label: "Un successo",
    emoji: "⭐",
    side: "pos",
    hint: "Qualcosa che ti è riuscito bene oggi",
  },
  lavoro: {
    label: "Lavoro concluso",
    emoji: "✅",
    side: "pos",
    hint: "Un compito o un'attività portata fino in fondo",
  },
  gentilezza: {
    label: "Gesto gentile",
    emoji: "🤝",
    side: "pos",
    hint: "Aiutare, aspettare il turno, chiedere scusa",
  },
  strategia: {
    label: "Mi sono calmato così",
    emoji: "🌬️",
    side: "pos",
    hint: "La strategia che hai usato e se ha funzionato",
  },
  arrabbiatura: {
    label: "Arrabbiatura",
    emoji: "🌩️",
    side: "neg",
    hint: "Cosa è successo, quanto era forte, come è finita",
  },
  libera: { label: "Nota libera", emoji: "📝", side: "pos", hint: "Quello che ti va di scrivere" },
};

export const POSITIVE_KINDS: Kind[] = ["successo", "lavoro", "gentilezza", "strategia", "libera"];

export interface Entry {
  id: string;
  student_id: string;
  author_id: string;
  kind: Kind;
  title: string;
  body: string;
  intensity: number | null;
  trigger_text: string | null;
  strategy_text: string | null;
  points: number;
  occurred_on: string;
  created_at: string;
}

export interface Reward {
  id: string;
  student_id: string;
  title: string;
  cost: number;
  redeemed_at: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  role: "docente" | "studente";
  student_code: string | null;
  teacher_id: string | null;
  split_ratio: number;
}

export const normalizeCode = (code: string) =>
  code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");

export const codeToEmail = (code: string) => `${normalizeCode(code)}@studenti.diario.app`;

export const usernameToEmail = (username: string) =>
  `${normalizeCode(username)}@docenti.diario.app`;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
