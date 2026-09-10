"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function OnboardingPage() {
  const { session, refresh } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await apiPost("/auth/orgs", { name });
      await refresh();
      toast.success("Workspace ready");
      router.replace("/dashboard");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Unable to create workspace");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6">
        <h1 className="text-xl font-semibold">Name your workspace</h1>
        <p className="text-sm text-muted-foreground">
          {session?.user?.full_name ? `Welcome, ${session.user.full_name}. ` : ""}
          Accounts, contacts, and intelligence stay inside this organization.
        </p>
        <Field label="Workspace">
          <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </Field>
        <Button className="w-full" type="submit" disabled={pending}>
          Continue
        </Button>
        <Link className="block text-center text-sm underline" href="/login">
          Use a different account
        </Link>
      </form>
    </div>
  );
}
