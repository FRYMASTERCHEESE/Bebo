-- Bebo Videos V1: installed migrations kept together for reproducibility.
-- Migration A: bebo_videos_v1_private_moderated_uploads
-- Bebo Videos V1 (10 October 2026): intentionally small, private-until-approved
-- Max 25 MiB per file enforced by Storage; 60s duration checked in the browser.
-- 3 clips/member, 20 clips total (<= 500 MiB at maximum file size).
-- All video metadata is RLS-protected and no member can approve their own video.

create table if not exists public.bebo_videos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.bebo_profiles(id) on delete cascade,
  object_path text not null unique,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  caption text not null default '' check (char_length(caption)<=500),
  content_type text not null check(content_type in ('video/mp4','video/webm')),
  size_bytes bigint not null check(size_bytes between 1 and 26214400),
  duration_seconds numeric(7,2) not null check(duration_seconds>0 and duration_seconds<=60),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.bebo_moderators(user_id) on delete set null
);
create index if not exists bebo_videos_owner_time on public.bebo_videos(owner_id,created_at desc);
create index if not exists bebo_videos_status_time on public.bebo_videos(status,created_at desc);
create index if not exists bebo_videos_reviewer on public.bebo_videos(reviewed_by);
alter table public.bebo_videos enable row level security;

create table if not exists public.bebo_video_comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.bebo_videos(id) on delete cascade,
  author_id uuid not null references public.bebo_profiles(id) on delete cascade,
  body text not null check(char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists bebo_video_comments_video_time on public.bebo_video_comments(video_id,created_at desc);
create index if not exists bebo_video_comments_author_time on public.bebo_video_comments(author_id,created_at desc);
alter table public.bebo_video_comments enable row level security;

create table if not exists public.bebo_video_reactions (
  video_id uuid not null references public.bebo_videos(id) on delete cascade,
  member_id uuid not null references public.bebo_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_id,member_id)
);
create index if not exists bebo_video_reactions_member on public.bebo_video_reactions(member_id);
alter table public.bebo_video_reactions enable row level security;

create table if not exists public.bebo_video_reports (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.bebo_videos(id) on delete cascade,
  reporter_id uuid not null references public.bebo_profiles(id) on delete cascade,
  reason text not null check(char_length(btrim(reason)) between 10 and 500),
  status text not null default 'open' check(status in ('open','resolved')),
  created_at timestamptz not null default now(),
  unique(video_id,reporter_id)
);
create index if not exists bebo_video_reports_reporter on public.bebo_video_reports(reporter_id);
create index if not exists bebo_video_reports_status on public.bebo_video_reports(status,created_at desc);
alter table public.bebo_video_reports enable row level security;

-- Server identity helper: no user-editable client metadata used for moderator rights.
-- Existing bebo_moderators table limits ordinary members to their own row.
create schema if not exists bebo_private;
revoke all on schema bebo_private from public,anon;
grant usage on schema bebo_private to authenticated;
create or replace function bebo_private.is_video_moderator()
returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.bebo_moderators m
    where m.user_id=(select auth.uid()) and m.role in ('owner','moderator'));
$$;
revoke all on function bebo_private.is_video_moderator() from public,anon,authenticated;
grant execute on function bebo_private.is_video_moderator() to authenticated;

-- Normal profiles can see published video metadata; uploader sees own review status.
create policy "video published or owner or moderator read" on public.bebo_videos
 for select to anon,authenticated using
 (status='approved' or owner_id=(select auth.uid()) or (select bebo_private.is_video_moderator()));
create policy "video owner creates pending" on public.bebo_videos
 for insert to authenticated with check
 (owner_id=(select auth.uid()) and status='pending' and reviewed_at is null and reviewed_by is null);
create policy "video owner removes own" on public.bebo_videos
 for delete to authenticated using (owner_id=(select auth.uid()));
create policy "video moderator reviews" on public.bebo_videos
 for update to authenticated using ((select bebo_private.is_video_moderator()))
 with check ((select bebo_private.is_video_moderator()));

create policy "approved video comments public" on public.bebo_video_comments
 for select to anon,authenticated using
 (exists(select 1 from public.bebo_videos v where v.id=video_id and v.status='approved'));
create policy "member comments on approved" on public.bebo_video_comments
 for insert to authenticated with check
 (author_id=(select auth.uid()) and exists(
  select 1 from public.bebo_videos v where v.id=video_id and v.status='approved'));
create policy "member or moderator removes comment" on public.bebo_video_comments
 for delete to authenticated using
 (author_id=(select auth.uid()) or (select bebo_private.is_video_moderator()));

create policy "approved video hearts public" on public.bebo_video_reactions
 for select to anon,authenticated using
 (exists(select 1 from public.bebo_videos v where v.id=video_id and v.status='approved'));
create policy "member hearts approved" on public.bebo_video_reactions
 for insert to authenticated with check
 (member_id=(select auth.uid()) and exists(
  select 1 from public.bebo_videos v where v.id=video_id and v.status='approved'));
create policy "member removes own heart" on public.bebo_video_reactions
 for delete to authenticated using (member_id=(select auth.uid()));

create policy "moderator reads video reports" on public.bebo_video_reports
 for select to authenticated using ((select bebo_private.is_video_moderator()) or reporter_id=(select auth.uid()));
create policy "member reports approved videos" on public.bebo_video_reports
 for insert to authenticated with check
 (reporter_id=(select auth.uid()) and status='open'
  and exists(select 1 from public.bebo_videos v
   where v.id=video_id and v.status='approved' and v.owner_id<>(select auth.uid())));
create policy "moderator resolves video report" on public.bebo_video_reports
 for update to authenticated using ((select bebo_private.is_video_moderator()))
 with check ((select bebo_private.is_video_moderator()));

-- Serialized cap and immutable upload ownership/path, plus moderation audit.
create or replace function bebo_private.guard_video_row()
returns trigger language plpgsql security definer set search_path='' as $$
declare user_id uuid; n integer;
begin
  if TG_OP='INSERT' then
    user_id:=auth.uid();
    if user_id is null or new.owner_id<>user_id then raise exception 'Sign in to upload videos';end if;
    if new.object_path<>new.owner_id::text||'/'||new.id::text||
         (case when new.content_type='video/mp4' then '.mp4' else '.webm' end)
    then raise exception 'Invalid video file path';end if;
    if new.status<>'pending' or new.reviewed_at is not null or new.reviewed_by is not null
    then raise exception 'Uploaded videos require approval';end if;
    if exists(select 1 from public.bebo_member_controls
      where member_id=user_id and status='suspended')
    then raise exception 'Your account cannot upload videos';end if;
    perform 1 from public.bebo_profiles where id=user_id for update;
    select count(*) into n from public.bebo_videos where owner_id=user_id;
    if n>=3 then raise exception 'Each member can keep up to 3 videos';end if;
    select count(*) into n from public.bebo_videos;
    if n>=20 then raise exception 'Bebo Videos pilot storage is full';end if;
    select count(*) into n from public.bebo_videos
      where owner_id=user_id and created_at>now()-interval '1 hour';
    if n>=2 then raise exception 'Upload limit: 2 videos per hour';end if;
    new.created_at:=now();
    return new;
  elsif TG_OP='UPDATE' then
    if not (select bebo_private.is_video_moderator()) then raise exception 'Moderator only';end if;
    if (new.id,new.owner_id,new.object_path,new.title,new.caption,new.content_type,new.size_bytes,
        new.duration_seconds,new.created_at)
       is distinct from
       (old.id,old.owner_id,old.object_path,old.title,old.caption,old.content_type,old.size_bytes,
        old.duration_seconds,old.created_at)
    then raise exception 'Video identity/content cannot be changed';end if;
    if new.status not in ('approved','rejected') then raise exception 'Invalid review state';end if;
    if new.status='approved' and not exists(select 1 from storage.objects
      where bucket_id='bebo-videos' and name=new.object_path)
    then raise exception 'Video upload is missing from Storage';end if;
    new.reviewed_by:=auth.uid();
    new.reviewed_at:=now();
    return new;
  end if;
  return new;
end $$;
revoke all on function bebo_private.guard_video_row() from public,anon,authenticated;
create trigger bebo_video_write_guard before insert or update on public.bebo_videos
 for each row execute function bebo_private.guard_video_row();

create or replace function bebo_private.guard_video_activity()
returns trigger language plpgsql security definer set search_path='' as $$
declare user_id uuid; recent_count integer; video_owner uuid;
begin
  if TG_TABLE_NAME='bebo_video_comments' then user_id:=new.author_id;
  elsif TG_TABLE_NAME='bebo_video_reactions' then user_id:=new.member_id;
  else user_id:=new.reporter_id; end if;
  if user_id is distinct from auth.uid() then raise exception 'Sign in as your member';end if;
  if exists(select 1 from public.bebo_member_controls
    where member_id=user_id and status='suspended')
  then raise exception 'Your account cannot interact with videos';end if;
  select owner_id into video_owner from public.bebo_videos
  where id=new.video_id and status='approved';
  if video_owner is null then raise exception 'This video is unavailable';end if;
  if exists(select 1 from public.bebo_blocks b
    where (b.blocker_id=user_id and b.blocked_id=video_owner)
       or (b.blocker_id=video_owner and b.blocked_id=user_id))
  then raise exception 'This interaction is blocked';end if;
  perform 1 from public.bebo_profiles where id=user_id for update;
  if TG_TABLE_NAME='bebo_video_comments' then
    select count(*) into recent_count from public.bebo_video_comments
      where author_id=user_id and created_at>now()-interval '1 hour';
    if recent_count>=12 then raise exception 'Too many comments; try later';end if;
  elsif TG_TABLE_NAME='bebo_video_reports' then
    if video_owner=user_id then raise exception 'Cannot report your own video';end if;
    select count(*) into recent_count from public.bebo_video_reports
      where reporter_id=user_id and created_at>now()-interval '1 day';
    if recent_count>=10 then raise exception 'Daily reports limit reached';end if;
  end if;
  new.created_at:=now();
  return new;
end $$;
revoke all on function bebo_private.guard_video_activity() from public,anon,authenticated;
create trigger bebo_video_comment_guard before insert on public.bebo_video_comments
 for each row execute function bebo_private.guard_video_activity();
create trigger bebo_video_heart_guard before insert on public.bebo_video_reactions
 for each row execute function bebo_private.guard_video_activity();
create trigger bebo_video_report_guard before insert on public.bebo_video_reports
 for each row execute function bebo_private.guard_video_activity();

create or replace function bebo_private.guard_video_report_review()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not (select bebo_private.is_video_moderator()) then raise exception 'Moderator only';end if;
 if (new.id,new.reporter_id,new.video_id,new.reason,new.created_at) is distinct from
    (old.id,old.reporter_id,old.video_id,old.reason,old.created_at)
 then raise exception 'Report details cannot be changed';end if;
 if new.status<>'resolved' then raise exception 'Report status must be resolved';end if;
 return new;
end $$;
revoke all on function bebo_private.guard_video_report_review() from public,anon,authenticated;
create trigger bebo_video_report_review_guard before update on public.bebo_video_reports
 for each row execute function bebo_private.guard_video_report_review();

grant select on public.bebo_videos to anon;
grant select,insert,delete,update on public.bebo_videos to authenticated;
grant select on public.bebo_video_comments,public.bebo_video_reactions to anon;
grant select,insert,delete on public.bebo_video_comments,public.bebo_video_reactions to authenticated;
grant select,insert,update on public.bebo_video_reports to authenticated;

-- Storage files are PRIVATE until reviewed. Even unpublished blob URLs require RLS.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bebo-videos','bebo-videos',false,26214400,array['video/mp4','video/webm'])
on conflict(id) do update set
  public=false,file_size_limit=26214400,allowed_mime_types=array['video/mp4','video/webm'];

create policy "bebo video private review or approved read" on storage.objects
 for select to anon,authenticated using
 (bucket_id='bebo-videos' and exists(
    select 1 from public.bebo_videos v where v.object_path=name
     and (v.status='approved' or v.owner_id=(select auth.uid())
          or (select bebo_private.is_video_moderator()))));
create policy "bebo video matching upload only" on storage.objects
 for insert to authenticated with check
 (bucket_id='bebo-videos' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.bebo_videos v where v.object_path=name
   and v.owner_id=(select auth.uid()) and v.status='pending'));
create policy "bebo video owner or moderator removal" on storage.objects
 for delete to authenticated using
 (bucket_id='bebo-videos' and exists(select 1 from public.bebo_videos v
  where v.object_path=name and (v.owner_id=(select auth.uid())
          or (select bebo_private.is_video_moderator()))));


-- Migration B: bebo_videos_v1_guest_read_policy_fix
-- Separate guest and signed-in storage / metadata policies so anonymous
-- visitors do not evaluate a moderator-only helper function.
drop policy if exists "video published or owner or moderator read" on public.bebo_videos;
create policy "video published for guests" on public.bebo_videos
 for select to anon using(status='approved');
create policy "video published owner reviewer members" on public.bebo_videos
 for select to authenticated using(
   status='approved' or owner_id=(select auth.uid())
   or (select bebo_private.is_video_moderator()));

drop policy if exists "bebo video private review or approved read" on storage.objects;
create policy "bebo video approved guests read" on storage.objects
 for select to anon using(
  bucket_id='bebo-videos' and exists(
   select 1 from public.bebo_videos v
   where v.object_path=name and v.status='approved'));
create policy "bebo video owner reviewer and approved read" on storage.objects
 for select to authenticated using(
  bucket_id='bebo-videos' and exists(
   select 1 from public.bebo_videos v where v.object_path=name
   and (v.status='approved' or v.owner_id=(select auth.uid())
        or (select bebo_private.is_video_moderator()))));

