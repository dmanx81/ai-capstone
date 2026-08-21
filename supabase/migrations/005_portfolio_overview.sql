create or replace view public.portfolio_overview
with (security_invoker = true)
as
with scored_briefs as (
    select
        b.account_id,
        b.health_score,
        b.created_at,
        row_number() over (
            partition by b.account_id
            order by b.created_at desc, b.id desc
        ) as score_position
    from public.briefs b
    where b.health_score is not null
),
interaction_summary as (
    select
        i.account_id,
        max(i.occurred_at) as last_interaction_at
    from public.interactions i
    group by i.account_id
),
open_item_summary as (
    select
        item.account_id,
        count(*) filter (
            where item.kind = 'risk'
        ) as open_risks,
        count(*) filter (
            where item.kind = 'action'
        ) as open_actions
    from public.extracted_items item
    where item.status = 'open'
    group by item.account_id
)
select
    a.id as account_id,
    a.name as relationship_name,
    a.renewal_date,
    latest.health_score as latest_health_score,
    previous.health_score as previous_health_score,
    interaction_summary.last_interaction_at,
    coalesce(open_item_summary.open_risks, 0)::integer as open_risks,
    coalesce(open_item_summary.open_actions, 0)::integer as open_actions
from public.accounts a
left join scored_briefs latest
    on latest.account_id = a.id
    and latest.score_position = 1
left join scored_briefs previous
    on previous.account_id = a.id
    and previous.score_position = 2
left join interaction_summary
    on interaction_summary.account_id = a.id
left join open_item_summary
    on open_item_summary.account_id = a.id;

grant select on public.portfolio_overview to authenticated;