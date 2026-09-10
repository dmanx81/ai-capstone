"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/form";
import { ReliaLogo } from "@/components/marketing/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const invite = search.get("invite");
  const [email, setEmail] = useState("demo@relia.app");
  const [password, setPassword] = useState("demo-password");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const session = await login(email, password);
      toast.success("Signed in");
      if (invite) {
        router.replace(`/invite/${invite}` as "/invite/[token]");
        return;
      }
      router.replace(session.organization ? "/dashboard" : "/onboarding");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Unable to sign in");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <ReliaLogo />
        <div>
          <h1 className="text-xl font-semibold">Sign in to Relia</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use the demo workspace or your own account.</p>
        </div>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Button className="w-full" disabled={pending} type="submit">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          No workspace yet?{" "}
          <Link className="underline" href="/signup">
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
