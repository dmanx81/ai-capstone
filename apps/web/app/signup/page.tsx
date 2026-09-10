"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function SignupPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [org, setOrg] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await register({
        email,
        password,
        full_name: fullName,
        organization_name: org,
      });
      toast.success("Workspace created");
      router.replace("/dashboard");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Unable to create account");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">Create your Relia workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">Start with accounts, then add intelligence as you go.</p>
        </div>
        <Field label="Your name">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </Field>
        <Field label="Work email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        </Field>
        <Field label="Workspace name">
          <Input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Acme Customer Success" required />
        </Field>
        <Button className="w-full" disabled={pending} type="submit">
          {pending ? "Creating…" : "Create workspace"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link className="underline" href="/login">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
