alter table public.extracted_items
    add column severity text
        check (severity is null or severity in ('low', 'medium', 'high')),
    add column confidence numeric,
    add column owner text,
    add column evidence text,
    add column direction text
        check (direction is null or direction in ('ours', 'theirs'));