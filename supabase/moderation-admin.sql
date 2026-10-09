-- Bebo moderation: membership is server-controlled, not user-selectable.
create table if not exists public.bebo_moderators(
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in('owner','moderator')),
 created_at timestamptz not null default now()
);
alter table public.bebo_moderators enable row level security;
revoke all on public.bebo_moderators from public,anon,authenticated;
-- No client-facing RLS policies. Moderation Edge Function reads this via server credential.
alter table public.bebo_reports
 add column if not exists status text not null default 'open' check(status in('open','dismissed','actioned')),
 add column if not exists reviewed_at timestamptz,
 add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
create index if not exists bebo_report_status_created on public.bebo_reports(status,created_at desc);
-- Never grant ordinary users report SELECT/UPDATE/DELETE.
revoke select,update,delete on public.bebo_reports from anon,authenticated;