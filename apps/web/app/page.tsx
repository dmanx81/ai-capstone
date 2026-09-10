import Link from "next/link";

import { Button } from "@/components/ui/button";

const questions = [
  "What is happening with this account?",
  "What changed recently?",
  "What risks exist?",
  "What opportunities exist?",
  "What promises have been made?",
  "What should I do next?",
  "What should I know before the meeting?",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">R</span>
          Relia
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" render={<Link href="/login" />}>
            Sign in
          </Button>
          <Button render={<Link href="/signup" />}>Start workspace</Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-20 pt-10">
        <p className="text-sm font-medium text-muted-foreground">Relationship intelligence for customer teams</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Walk into every customer conversation already knowing the relationship.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Relia combines CRM-style account management with grounded AI briefs, so account managers,
          CSMs, and account executives can see risks, promises, and next actions — with evidence, not guesses.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" render={<Link href="/login" />}>
            Open demo workspace
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/signup" />}>
            Create an account
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Demo login: <code>demo@relia.app</code> / <code>demo-password</code>
        </p>
        <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {questions.map((item) => (
            <div key={item} className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-sm font-medium">{item}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Answered from the account timeline, stakeholders, and stored intelligence — never invented.
              </p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
