-- Bebo photo review and reporting — applied to Supabase project rnxiggzyqqzjtgdbpedb.
-- Production: migration bebo_photos_owner_review_reports_20261011.
-- Existing member rows, albums and storage files were left unchanged.
alter table public.bebo_photos
 add column if not exists moderation_status text not null default 'pending'
  check(moderation_status in ('pending','approved','rejected')),
 add column if not exists reviewed_at timestamptz,
 add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

drop policy if exists "public photos" on public.bebo_photos;
drop policy if exists "bebo photo approved public" on public.bebo_photos;
create policy "bebo photo approved public" on public.bebo_photos
 for select to anon,authenticated using(moderation_status='approved');
drop policy if exists "bebo photo owner and moderator review" on public.bebo_photos;
create policy "bebo photo owner and moderator review" on public.bebo_photos
 for select to authenticated using(owner_id=(select auth.uid()) or (select bebo_private.is_bebo_moderator()));
drop policy if exists "own album photos" on public.bebo_photos;
create policy "own album photos" on public.bebo_photos
 for insert to authenticated with check(
 owner_id=(select auth.uid()) and moderation_status='pending'
 and reviewed_at is null and reviewed_by is null
 and exists(select 1 from public.bebo_albums a where a.id=album_id and a.owner_id=(select auth.uid())));
grant update(moderation_status,reviewed_at,reviewed_by) on table public.bebo_photos to authenticated;
drop policy if exists "bebo moderator reviews photos" on public.bebo_photos;
create policy "bebo moderator reviews photos" on public.bebo_photos
 for update to authenticated using((select bebo_private.is_bebo_moderator()))
 with check((select bebo_private.is_bebo_moderator()) and moderation_status in ('approved','rejected')
 and reviewed_at is not null and reviewed_by=(select auth.uid()));
create index if not exists bebo_photos_review_status_time on public.bebo_photos(moderation_status,created_at);

create table if not exists public.bebo_photo_reports(
 id uuid primary key default gen_random_uuid(),
 photo_id uuid not null references public.bebo_photos(id) on delete cascade,
 reporter_id uuid not null references public.bebo_profiles(id) on delete cascade,
 reason text not null check(char_length(btrim(reason)) between 10 and 1000),
 status text not null default 'open' check(status in ('open','reviewed')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete set null,
 unique(photo_id,reporter_id)
);
create index if not exists bebo_photo_reports_open_time on public.bebo_photo_reports(status,created_at desc);
alter table public.bebo_photo_reports enable row level security;
revoke all on table public.bebo_photo_reports from public,anon,authenticated;
grant insert,select on table public.bebo_photo_reports to authenticated;
grant update(status,reviewed_at,reviewed_by) on table public.bebo_photo_reports to authenticated;
drop policy if exists "member reports photo" on public.bebo_photo_reports;
create policy "member reports photo" on public.bebo_photo_reports
 for insert to authenticated with check(
 reporter_id=(select auth.uid()) and status='open'
 and reviewed_at is null and reviewed_by is null
 and exists(select 1 from public.bebo_photos p
  where p.id=photo_id and p.moderation_status='approved' and p.owner_id<>(select auth.uid())));
drop policy if exists "moderators read photo reports" on public.bebo_photo_reports;
create policy "moderators read photo reports" on public.bebo_photo_reports
 for select to authenticated using((select bebo_private.is_bebo_moderator()));
drop policy if exists "moderators resolve photo reports" on public.bebo_photo_reports;
create policy "moderators resolve photo reports" on public.bebo_photo_reports
 for update to authenticated using((select bebo_private.is_bebo_moderator()))
 with check((select bebo_private.is_bebo_moderator())
 and status='reviewed' and reviewed_at is not null and reviewed_by=(select auth.uid()));
create or replace function bebo_private.bebo_photo_report_limit()
 returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if (select count(*) from public.bebo_photo_reports
  where reporter_id=new.reporter_id and created_at>now()-interval '1 day')>=10
 then raise exception 'Daily photo report limit reached'; end if;
 return new;
end $$;
revoke all on function bebo_private.bebo_photo_report_limit() from public,anon,authenticated;
drop trigger if exists bebo_photo_report_rate_limit on public.bebo_photo_reports;
create trigger bebo_photo_report_rate_limit before insert on public.bebo_photo_reports
 for each row execute function bebo_private.bebo_photo_report_limit();
