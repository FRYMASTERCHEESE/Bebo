-- Migration history: deployed directly to the existing Bebo Supabase project on 2026-10-10.
-- Live analytics count one meaningful signed-in member view per approved video per UTC day.
-- bebo_video_organic_analytics_and_rankings_v1
-- Bebo organic video analytics V1. Count at most one meaningful view per
-- signed-in member per approved video per UTC day. Guests are not counted.
-- No member IDs or raw per-view records are exposed through the public API.
create table if not exists public.bebo_video_view_events (
 video_id uuid not null references public.bebo_videos(id) on delete cascade,
 viewer_id uuid not null references auth.users(id) on delete cascade,
 viewed_on date not null default (now() at time zone 'utc')::date,
 created_at timestamptz not null default now(),
 primary key(video_id,viewer_id,viewed_on)
);
create index if not exists bebo_video_view_events_viewer_idx
 on public.bebo_video_view_events(viewer_id,viewed_on);
create index if not exists bebo_video_view_events_recent_idx
 on public.bebo_video_view_events(video_id,viewed_on);
alter table public.bebo_video_view_events enable row level security;
revoke all on public.bebo_video_view_events from public,anon,authenticated;

create or replace function public.bebo_record_video_view(
 p_video_id uuid, p_watched_seconds numeric
) returns boolean language plpgsql volatile security definer set search_path=''
as $$
declare
 person uuid:=auth.uid();
 clip_length numeric;
 inserted integer;
begin
 if person is null or p_video_id is null then return false;end if;
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then return false;end if;
 -- This is a client-estimated watch threshold, not server-verified retention.
 select v.duration_seconds into clip_length from public.bebo_videos v
 where v.id=p_video_id and v.status='approved';
 if clip_length is null then return false;end if;
 if p_watched_seconds is null or p_watched_seconds < greatest(3,least(10,clip_length*0.5))
 then return false;end if;
 if exists(select 1 from public.bebo_member_controls c
   where c.member_id=person and c.status='suspended') then return false;end if;
 if exists(select 1 from public.bebo_blocks b
   join public.bebo_videos v on v.id=p_video_id
   where (b.blocker_id=person and b.blocked_id=v.owner_id)
      or (b.blocked_id=person and b.blocker_id=v.owner_id))
 then return false;end if;
 insert into public.bebo_video_view_events (video_id,viewer_id,viewed_on)
 values (p_video_id,person,(now() at time zone 'utc')::date)
 on conflict do nothing;
 get diagnostics inserted=row_count;
 return inserted=1;
end
$$;
revoke all on function public.bebo_record_video_view(uuid,numeric) from public,anon,authenticated;
grant execute on function public.bebo_record_video_view(uuid,numeric) to authenticated;

create or replace function public.bebo_video_stats(p_video_ids uuid[])
returns table (
 video_id uuid,
 views bigint,
 unique_members bigint,
 views_7d bigint,
 hearts bigint,
 comments bigint,
 engagement_rate numeric,
 ranking_score numeric
)
language sql stable security definer set search_path=''
as $$
 with selected as (
  select v.id,v.created_at from public.bebo_videos v
  where v.id=any(coalesce(p_video_ids,'{}'::uuid[]))
    and (v.status='approved' or v.owner_id=auth.uid())
  order by v.created_at desc limit 40
 ), activity as (
  select selected.id,selected.created_at,
  (select count(*) from public.bebo_video_view_events x where x.video_id=selected.id) as views,
  (select count(distinct viewer_id) from public.bebo_video_view_events x where x.video_id=selected.id) as unique_members,
  (select count(*) from public.bebo_video_view_events x where x.video_id=selected.id
    and x.viewed_on >= (now() at time zone 'utc')::date-6) as views_7d,
  (select count(*) from public.bebo_video_reactions x where x.video_id=selected.id) as hearts,
  (select count(*) from public.bebo_video_comments x where x.video_id=selected.id) as comments
  from selected
 )
 select id,views,unique_members,views_7d,hearts,comments,
  round(100.0*(hearts+comments)/greatest(views,1),1),
  round((2*views_7d+4*hearts+6*comments+
   greatest(0,7-extract(epoch from (now()-created_at))/86400))::numeric,2)
 from activity
$$;
revoke all on function public.bebo_video_stats(uuid[]) from public,anon,authenticated;
grant execute on function public.bebo_video_stats(uuid[]) to anon,authenticated;

comment on function public.bebo_record_video_view(uuid,numeric) is
'One signed-in member view per approved clip per UTC day after client-estimated watch threshold; not authenticated playback retention.';
comment on function public.bebo_video_stats(uuid[]) is
'Public aggregate stats only; member IDs not disclosed. Score=2*7-day member views+4*hearts+6*comments+7-day freshness bonus.';


-- bebo_video_analytics_zero_view_rate_fix
-- Do not claim 100% engagement on a video with no recorded member views.
CREATE OR REPLACE FUNCTION public.bebo_video_stats(p_video_ids uuid[])
returns table (
 video_id uuid,views bigint,unique_members bigint,views_7d bigint,
 hearts bigint,comments bigint,engagement_rate numeric,ranking_score numeric
)
language sql stable security definer set search_path=''
as $$
 with selected as (
  select v.id,v.created_at from public.bebo_videos v
  where v.id=any(coalesce(p_video_ids,'{}'::uuid[]))
    and (v.status='approved' or v.owner_id=auth.uid())
  order by v.created_at desc limit 40
 ), activity as (
  select selected.id,selected.created_at,
  (select count(*) from public.bebo_video_view_events x where x.video_id=selected.id) as views,
  (select count(distinct viewer_id) from public.bebo_video_view_events x where x.video_id=selected.id) as unique_members,
  (select count(*) from public.bebo_video_view_events x where x.video_id=selected.id
    and x.viewed_on >= (now() at time zone 'utc')::date-6) as views_7d,
  (select count(*) from public.bebo_video_reactions x where x.video_id=selected.id) as hearts,
  (select count(*) from public.bebo_video_comments x where x.video_id=selected.id) as comments
  from selected
 )
 select id,views,unique_members,views_7d,hearts,comments,
  case when views=0 then 0::numeric
       else round(100.0*(hearts+comments)/views,1) end,
  round((2*views_7d+4*hearts+6*comments+
   greatest(0,7-extract(epoch from (now()-created_at))/86400))::numeric,2)
 from activity
$$;
