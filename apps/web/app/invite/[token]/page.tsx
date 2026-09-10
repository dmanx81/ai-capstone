"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { InvitePreview } from "@/lib/types";

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { session, register, login, refresh } = useAuth();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api<InvitePreview>(`/invites/preview/${params.token}`)
      .then(setPreview)
      .catch((err) => setError(err instanceof ApiError ? err.detail : "Invitation not found"));
  }, [params.token]);

  async function acceptExisting() {
    setPending(true);
    try {
      await apiPost(`/invites/accept/${params.token}`);
      await refresh();
      toast.success("Joined workspace");
      router.replace("/dashboard");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "Unable to accept invitation");
    } finally {
      setPending(false);
    }
  }

  async function createAndAccept(event: React.FormEvent) {
    event.preventDefault();
    if (!preview) return;
    setPending(true);
    try {
      await register({
        email: preview.email,
        password,
        full_name: fullName,
        invite_token: params.token,
      });
      toast.success("Workspace joined");
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        try {
          await login(preview.email, password);
          await apiPost(`/invites/accept/${params.token}`);
          await refresh();
          toast.success("Signed in and joined workspace");
          router.replace("/dashboard");
          return;
        } catch (inner) {
          toast.error(inner instanceof ApiError ? inner.detail : "Sign in to accept this invitation");
          return;
        }
      }
      toast.error(err instanceof ApiError ? err.detail : "Unable to accept invitation");
    } finally {
      setPending(false);
    }
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-3 rounded-xl border bg-card p-6">
          <h1 className="text-xl font-semibold">Invitation unavailable</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button render={<Link href="/login" />} nativeButton={false} className="w-full">
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  if (!preview) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading invitation…</div>;
  }

  const sameEmail = session?.user?.email?.toLowerCase() === preview.email.toLowerCase();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">Join {preview.organization}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {preview.email} was invited as {preview.role}.
          </p>
        </div>
        {session?.user && sameEmail ? (
          <Button className="w-full" disabled={pending} onClick={() => void acceptExisting()}>
            {pending ? "Joining…" : "Accept invitation"}
          </Button>
        ) : session?.user ? (
          <p className="text-sm text-muted-foreground">
            You are signed in as {session.user.email}. Sign out and use {preview.email} to accept.
          </p>
        ) : (
          <form className="grid gap-3" onSubmit={createAndAccept}>
            <Field label="Your name">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </Field>
            <Field label="Email">
              <Input value={preview.email} disabled />
            </Field>
            <Field label="Password">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </Field>
            <Button type="submit" disabled={pending}>
              {pending ? "Joining…" : "Create account and join"}
            </Button>
          </form>
        )}
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link className="underline" href={`/login?invite=${params.token}`}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
