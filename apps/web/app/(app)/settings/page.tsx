"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Field, NativeSelect } from "@/components/form";
import { PageHeader } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, apiPatch, apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { BillingStatus, Invitation, Session } from "@/lib/types";

export default function SettingsPage() {
  const { session, refresh } = useAuth();
  const canInvite = session?.role === "owner" || session?.role === "admin";
  const [name, setName] = useState(session?.user?.full_name ?? "");
  const [title, setTitle] = useState(session?.user?.title ?? "");
  const [orgName, setOrgName] = useState(session?.organization?.name ?? "");
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [members, setMembers] = useState<{ full_name: string; email: string; role: string }[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  useEffect(() => {
    setName(session?.user?.full_name ?? "");
    setTitle(session?.user?.title ?? "");
    setOrgName(session?.organization?.name ?? "");
  }, [session]);

  async function loadWorkspace() {
    void api<BillingStatus>("/billing/status").then(setBilling);
    void api<{ full_name: string; email: string; role: string }[]>("/auth/members").then(setMembers);
    if (canInvite) {
      try {
        setInvites(await api<Invitation[]>("/invites"));
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 403)) {
          toast.error(error instanceof ApiError ? error.detail : "Unable to load invitations");
        }
      }
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, [canInvite]);

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

  async function saveOrg(event: React.FormEvent) {
    event.preventDefault();
    try {
      await apiPatch<Session>("/auth/org", { name: orgName });
      await refresh();
      toast.success("Workspace updated");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Unable to rename workspace");
    }
  }

  async function sendInvite(event: React.FormEvent) {
    event.preventDefault();
    try {
      const created = await apiPost<Invitation>("/invites", { email: inviteEmail, role: inviteRole });
      setInviteLink(created.invite_url ?? null);
      setInviteEmail("");
      toast.success(created.emailed ? "Invitation emailed" : "Invitation created. Share the link below.");
      await loadWorkspace();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Unable to invite");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Profile, workspace membership, invitations, and plan." />
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
                <Input value={session?.user?.email ?? ""} disabled />
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
            {canInvite ? (
              <form className="grid gap-3" onSubmit={saveOrg}>
                <Field label="Organization">
                  <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} minLength={2} />
                </Field>
                <Button type="submit" variant="outline" className="w-fit">
                  Save workspace name
                </Button>
              </form>
            ) : (
              <div>
                <div className="text-muted-foreground">Organization</div>
                <div className="font-medium">{session?.organization?.name}</div>
              </div>
            )}
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
        {canInvite ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Invitations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="grid gap-3 sm:grid-cols-[1fr_160px_auto]" onSubmit={sendInvite}>
                <Field label="Email">
                  <Input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com"
                  />
                </Field>
                <Field label="Role">
                  <NativeSelect value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                    <option value="viewer">Viewer</option>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </NativeSelect>
                </Field>
                <div className="flex items-end">
                  <Button type="submit">Send invite</Button>
                </div>
              </form>
              {inviteLink ? (
                <p className="rounded-lg border bg-muted/40 p-3 text-xs break-all">
                  Share this link if email is not configured: {inviteLink}
                </p>
              ) : null}
              {invites.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invitations yet.</p>
              ) : (
                <ul className="space-y-2">
                  {invites.map((invite) => (
                    <li key={invite.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm">
                        {invite.email} · {invite.role} · {invite.status}
                        <div className="text-xs text-muted-foreground">Expires {formatDate(invite.expires_at)}</div>
                      </div>
                      {invite.status === "pending" ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                const resent = await apiPost<Invitation>(`/invites/${invite.id}/resend`);
                                setInviteLink(resent.invite_url ?? null);
                                toast.success("Invitation resent");
                                await loadWorkspace();
                              } catch (error) {
                                toast.error(error instanceof ApiError ? error.detail : "Unable to resend");
                              }
                            }}
                          >
                            Resend
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await apiPost(`/invites/${invite.id}/revoke`);
                                toast.success("Invitation revoked");
                                await loadWorkspace();
                              } catch (error) {
                                toast.error(error instanceof ApiError ? error.detail : "Unable to revoke");
                              }
                            }}
                          >
                            Revoke
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}
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
