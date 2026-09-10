import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Diario di Bordo — il diario dei successi e delle arrabbiature" },
      {
        name: "description",
        content:
          "Un diario per annotare arrabbiature, successi, lavori conclusi e gesti gentili, con punti e premi assegnati dalla docente.",
      },
      { property: "og:title", content: "Diario di Bordo" },
      {
        property: "og:description",
        content: "Il diario dei successi, delle arrabbiature e dei premi da conquistare.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-5 py-16">
      <p className="hand text-storm">ciao!</p>
      <h1 className="mt-2 text-5xl font-bold sm:text-6xl">Diario di Bordo</h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Qui scrivi le tue arrabbiature e i tuoi successi, disegni sulla lavagna e conquisti punti
        per i premi decisi insieme alla tua insegnante.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <Link
          to="/entra"
          className="paper group block p-7 transition-transform hover:-translate-y-1"
        >
          <span className="text-4xl">🎒</span>
          <h2 className="mt-3 text-2xl font-bold">Sono l'alunno</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Entra con il codice che ti ha dato l'insegnante e apri il tuo diario.
          </p>
          <span className="mt-4 inline-block font-semibold text-primary group-hover:underline">
            Entra con il codice →
          </span>
        </Link>

        <Link
          to="/auth"
          className="paper group block p-7 transition-transform hover:-translate-y-1"
        >
          <span className="text-4xl">🍎</span>
          <h2 className="mt-3 text-2xl font-bold">Sono l'insegnante</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Area riservata: crea i codici degli alunni, assegna punti e concorda i premi.
          </p>
          <span className="mt-4 inline-block font-semibold text-primary group-hover:underline">
            Accedi all'area docente →
          </span>
        </Link>
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        Ogni alunno vede soltanto il proprio diario. L'insegnante vede solo gli alunni che ha
        registrato.
      </p>
    </main>
  );
}
