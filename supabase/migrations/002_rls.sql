alter table public.accounts enable row level security;
alter table public.interactions enable row level security;
alter table public.briefs enable row level security;
alter table public.extracted_items enable row level security;
alter table public.chunks enable row level security;
alter table public.user_settings enable row level security;

create policy "accounts_select_own"
on public.accounts
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "accounts_insert_own"
on public.accounts
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "accounts_update_own"
on public.accounts
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "accounts_delete_own"
on public.accounts
for delete
to authenticated
using ((select auth.uid()) = owner_id);

create policy "interactions_select_own"
on public.interactions
for select
to authenticated
using (
    exists (
        select 1
        from public.accounts a
        where a.id = interactions.account_id
        and a.owner_id = (select auth.uid())
    )
);

create policy "interactions_insert_own"
on public.interactions
for insert
to authenticated
with check (
    exists (
        select 1
        from public.accounts a
        where a.id = interactions.account_id
        and a.owner_id = (select auth.uid())
    )
);

create policy "interactions_update_own"
on public.interactions
for update
to authenticated
using (
    exists (
        select 1
        from public.accounts a
        where a.id = interactions.account_id
        and a.owner_id = (select auth.uid())
    )
)
with check (
    exists (
        select 1
        from public.accounts a
        where a.id = interactions.account_id
        and a.owner_id = (select auth.uid())
    )
);

create policy "interactions_delete_own"
on public.interactions
for delete
to authenticated
using (
    exists (
        select 1
        from public.accounts a
        where a.id = interactions.account_id
        and a.owner_id = (select auth.uid())
    )
);

create policy "briefs_select_own"
on public.briefs
for select
to authenticated
using (
    exists (
        select 1
        from public.accounts a
        where a.id = briefs.account_id
        and a.owner_id = (select auth.uid())
    )
);

create policy "briefs_insert_own"
on public.briefs
for insert
to authenticated
with check (
    exists (
        select 1
        from public.accounts a
        where a.id = briefs.account_id
        and a.owner_id = (select auth.uid())
    )
);

create policy "briefs_update_own"
on public.briefs
for update
to authenticated
using (
    exists (
        select 1
        from public.accounts a
        where a.id = briefs.account_id
        and a.owner_id = (select auth.uid())
    )
)
with check (
    exists (
        select 1
        from public.accounts a
        where a.id = briefs.account_id
        and a.owner_id = (select auth.uid())
    )
);

create policy "briefs_delete_own"
on public.briefs
for delete
to authenticated
using (
    exists (
        select 1
        from public.accounts a
        where a.id = briefs.account_id
        and a.owner_id = (select auth.uid())
    )
);

create policy "extracted_items_select_own"
on public.extracted_items
for select
to authenticated
using (
    exists (
        select 1
        from public.accounts a
        where a.id = extracted_items.account_id
        and a.owner_id = (select auth.uid())
    )
);

create policy "extracted_items_insert_own"
on public.extracted_items
for insert
to authenticated
with check (
    exists (
        select 1
        from public.accounts a
        where a.id = extracted_items.account_id
        and a.owner_id = (select auth.uid())
    )
);

create policy "extracted_items_update_own"
on public.extracted_items
for update
to authenticated
using (
    exists (
        select 1
        from public.accounts a
        where a.id = extracted_items.account_id
        and a.owner_id = (select auth.uid())
    )
)
with check (
    exists (
        select 1
        from public.accounts a
        where a.id = extracted_items.account_id
        and a.owner_id = (select auth.uid())
    )
);

create policy "extracted_items_delete_own"
on public.extracted_items
for delete
to authenticated
using (
    exists (
        select 1
        from public.accounts a
        where a.id = extracted_items.account_id
        and a.owner_id = (select auth.uid())
    )
);

create policy "chunks_select_own"
on public.chunks
for select
to authenticated
using (
    exists (
        select 1
        from public.accounts a
        where a.id = chunks.account_id
        and a.owner_id = (select auth.uid())
    )
);

create policy "chunks_insert_own"
on public.chunks
for insert
to authenticated
with check (
    exists (
        select 1
        from public.accounts a
        where a.id = chunks.account_id
        and a.owner_id = (select auth.uid())
    )
);

create policy "chunks_update_own"
on public.chunks
for update
to authenticated
using (
    exists (
        select 1
        from public.accounts a
        where a.id = chunks.account_id
        and a.owner_id = (select auth.uid())
    )
)
with check (
    exists (
        select 1
        from public.accounts a
        where a.id = chunks.account_id
        and a.owner_id = (select auth.uid())
    )
);

create policy "chunks_delete_own"
on public.chunks
for delete
to authenticated
using (
    exists (
        select 1
        from public.accounts a
        where a.id = chunks.account_id
        and a.owner_id = (select auth.uid())
    )
);

create policy "user_settings_select_own"
on public.user_settings
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "user_settings_insert_own"
on public.user_settings
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "user_settings_update_own"
on public.user_settings
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "user_settings_delete_own"
on public.user_settings
for delete
to authenticated
using ((select auth.uid()) = user_id);
