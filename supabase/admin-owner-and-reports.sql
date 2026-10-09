-- Bebo owner administration: private reports, verified account assignment, review and moderation.
-- Production migration already applied to dedicated project rnxiggzyqqzjtgdbpedb.
do $$ declare n integer;
begin
 select count(*) into n from auth.users where lower(email)='coreyedge123@gmail.com' and email_confirmed_at is not null;
 if n<>1 then raise exception 'STOP expected one verified Bebo owner login, found %',n; end if;
end $$;
alter table public.bebo_moderators enable row level security;
revoke all on public.bebo_moderators from public,anon,authenticated;
grant select on public.bebo_moderators to authenticated;
drop policy if exists "bebo read own moderator role" on public.bebo_moderators;
create policy "bebo read own moderator role" on public.bebo_moderators for select to authenticated using(user_id=(select auth.uid()));
insert into public.bebo_moderators(user_id,role)
select id,'owner' from auth.users where lower(email)='coreyedge123@gmail.com' and email_confirmed_at is not null
on conflict(user_id) do update set role='owner';

create schema if not exists bebo_private;
revoke all on schema bebo_private from public,anon;
grant usage on schema bebo_private to authenticated;
create or replace function bebo_private.is_bebo_moderator() returns boolean
language sql stable security definer set search_path='' as $$
select auth.uid() is not null and exists(select 1 from public.bebo_moderators where user_id=auth.uid() and role in ('owner','moderator'));
$$;
revoke all on function bebo_private.is_bebo_moderator() from public,anon,authenticated;
grant execute on function bebo_private.is_bebo_moderator() to authenticated;

alter table public.bebo_reports enable row level security;
revoke all on public.bebo_reports from public,anon,authenticated;
grant insert,select on public.bebo_reports to authenticated;
grant update(status) on public.bebo_reports to authenticated;
drop policy if exists "bebo admins read reports" on public.bebo_reports;
create policy "bebo admins read reports" on public.bebo_reports for select to authenticated using((select bebo_private.is_bebo_moderator()));
drop policy if exists "bebo admins review reports" on public.bebo_reports;
create policy "bebo admins review reports" on public.bebo_reports for update to authenticated
using(status='open' and (select bebo_private.is_bebo_moderator()))
with check((select bebo_private.is_bebo_moderator()));
create or replace function bebo_private.stamp_bebo_report_review() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not bebo_private.is_bebo_moderator() then raise exception 'Only Bebo moderators may review reports'; end if;
 if old.status<>'open' or new.status not in ('dismissed','actioned') then raise exception 'Only open reports can be closed'; end if;
 new.reviewed_by:=auth.uid(); new.reviewed_at:=now(); return new;
end $$;
revoke all on function bebo_private.stamp_bebo_report_review() from public,anon,authenticated;
drop trigger if exists bebo_stamp_report_review on public.bebo_reports;
create trigger bebo_stamp_report_review before update of status on public.bebo_reports
for each row execute function bebo_private.stamp_bebo_report_review();

alter table public.bebo_wall_posts enable row level security;
revoke all on public.bebo_wall_posts from public,anon,authenticated;
grant select on public.bebo_wall_posts to anon,authenticated;
grant insert,delete on public.bebo_wall_posts to authenticated;
drop policy if exists "bebo moderator removes wall posts" on public.bebo_wall_posts;
create policy "bebo moderator removes wall posts" on public.bebo_wall_posts for delete to authenticated using((select bebo_private.is_bebo_moderator()));
