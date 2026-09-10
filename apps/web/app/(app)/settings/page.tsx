"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/form";
import { PageHeader } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, apiPatch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { BillingStatus } from "@/lib/types";

export default function SettingsPage() {
  const { session, refresh } = useAuth();
  const [name, setName] = useState(session?.user.full_name ?? "");
  const [title, setTitle] = useState(session?.user.title ?? "");
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [members, setMembers] = useState<{ full_name: string; email: string; role: string }[]>([]);

  useEffect(() => {
    setName(session?.user.full_name ?? "");
    setTitle(session?.user.title ?? "");
  }, [session]);

  useEffect(() => {
    void api<BillingStatus>("/billing/status").then(setBilling);
    void api<{ full_name: string; email: string; role: string }[]>("/auth/members").then(setMembers);
  }, []);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    try {
      await apiPatch("/auth/profile", { full_name: name, title });
      await refresh();
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Unable to save");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Profile, workspace membership, and plan." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={saveProfile}>
              <Field label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Title">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Account manager" />
              </Field>
              <Field label="Email">
                <Input value={session?.user.email ?? ""} disabled />
              </Field>
              <Button type="submit" className="w-fit">
                Save profile
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-muted-foreground">Organization</div>
              <div className="font-medium">{session?.organization?.name}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Your role</div>
              <div className="font-medium capitalize">{session?.role}</div>
            </div>
            <div>
              <div className="mb-2 text-muted-foreground">Members</div>
              <ul className="space-y-1">
                {members.map((member) => (
                  <li key={member.email}>
                    {member.full_name} · {member.email} · {member.role}
                  </li>
                ))}
              </ul>
            </div>
            <Button variant="outline" render={<Link href="/settings/billing" />}>
              Manage billing
            </Button>
          </CardContent>
        </Card>
        {billing ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Plan</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              You are on the <strong className="capitalize">{billing.plan}</strong> plan ({billing.plan_status}). AI
              actions used this month: {billing.ai_actions_used}
              {billing.ai_actions_limit ? ` / ${billing.ai_actions_limit}` : ""}.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
