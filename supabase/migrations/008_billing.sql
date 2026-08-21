create table if not exists public.user_billing (
    user_id uuid primary key references auth.users(id) on delete cascade,
    plan text not null default 'FREE' check (plan in ('FREE', 'PRO')),
    status text not null default 'inactive' check (status in ('inactive', 'active', 'trialing', 'past_due', 'canceled', 'unpaid')),
    monthly_analysis_allowance integer not null default 5,
    stripe_customer_id text,
    stripe_subscription_id text,
    stripe_price_id text,
    current_period_start timestamptz,
    current_period_end timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists user_billing_plan_idx
    on public.user_billing(plan, status);

create index if not exists user_billing_stripe_customer_idx
    on public.user_billing(stripe_customer_id);

alter table public.user_billing enable row level security;

-- Authenticated users may only read their own billing row. All billing
-- mutations happen through trusted server/service-role paths (service_role
-- bypasses RLS) so a client can never self-promote to PRO or reset usage.
create policy "user_billing_select_own"
on public.user_billing
for select
to authenticated
using ((select auth.uid()) = user_id);
