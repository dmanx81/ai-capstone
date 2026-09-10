"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Field, NativeSelect } from "@/components/form";
import { PageHeader } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiPost, ApiError } from "@/lib/api";
import type { Account } from "@/lib/types";

export default function NewAccountPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    name: "",
    domain: "",
    industry: "",
    lifecycle: "active",
    arr: "",
    tags: "",
    description: "",
    renewal_date: "",
  });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const created = await apiPost<Account>("/accounts", {
        name: form.name,
        domain: form.domain || null,
        industry: form.industry || null,
        lifecycle: form.lifecycle,
        arr: form.arr ? Number(form.arr) : null,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        description: form.description || null,
        renewal_date: form.renewal_date ? new Date(form.renewal_date).toISOString() : null,
      });
      toast.success("Account created");
      router.replace(`/accounts/${created.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Unable to create account");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="New account" description="Capture the relationship first. Intelligence can wait." />
      <form onSubmit={onSubmit} className="grid gap-4 rounded-xl border bg-card p-5">
        <Field label="Account name">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Domain">
            <Input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="acme.example" />
          </Field>
          <Field label="Industry">
            <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lifecycle">
            <NativeSelect value={form.lifecycle} onChange={(e) => setForm({ ...form, lifecycle: e.target.value })}>
              <option value="prospect">Prospect</option>
              <option value="onboarding">Onboarding</option>
              <option value="active">Active</option>
              <option value="renewal">Renewal</option>
              <option value="churn_risk">Churn risk</option>
              <option value="churned">Churned</option>
            </NativeSelect>
          </Field>
          <Field label="ARR">
            <Input type="number" min="0" value={form.arr} onChange={(e) => setForm({ ...form, arr: e.target.value })} />
          </Field>
        </div>
        <Field label="Renewal date">
          <Input type="date" value={form.renewal_date} onChange={(e) => setForm({ ...form, renewal_date: e.target.value })} />
        </Field>
        <Field label="Tags">
          <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="enterprise, named" />
        </Field>
        <Field label="Description">
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Create account"}
          </Button>
        </div>
      </form>
    </div>
  );
}
