-- Applied to dedicated Bebo project; review before reapplying.
-- Bebo owner admin expansion v1: announcement publishing, feature controls, member restrictions, skin review and audit.
-- All administrative permissions are tied to verified, server-assigned Supabase roles.

create schema if not exists bebo_private;
revoke all on schema bebo_private from public,anon;
grant usage on schema bebo_private to authenticated;
create or replace function bebo_private.is_bebo_owner()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
  select 1 from public.bebo_moderators m where m.user_id=auth.uid() and m.role='owner'
 );
$$;
revoke all on function bebo_private.is_bebo_owner() from public,anon,authenticated;
grant execute on function bebo_private.is_bebo_owner() to authenticated;

create table if not exists public.bebo_member_controls(
 member_id uuid primary key references public.bebo_profiles(id) on delete cascade,
 status text not null default 'active' check(status in('active','warned','suspended')),
 reason text not null default '' check(char_length(reason)<=500),
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
alter table public.bebo_member_controls enable row level security;
revoke all on public.bebo_member_controls from public,anon,authenticated;
grant select,insert on public.bebo_member_controls to authenticated;
grant update(status,reason) on public.bebo_member_controls to authenticated;
drop policy if exists "bebo member own status" on public.bebo_member_controls;
create policy "bebo member own status" on public.bebo_member_controls
 for select to authenticated using(member_id=(select auth.uid()) or (select bebo_private.is_bebo_owner()));
drop policy if exists "bebo owner creates member controls" on public.bebo_member_controls;
create policy "bebo owner creates member controls" on public.bebo_member_controls
 for insert to authenticated with check((select bebo_private.is_bebo_owner()));
drop policy if exists "bebo owner updates member controls" on public.bebo_member_controls;
create policy "bebo owner updates member controls" on public.bebo_member_controls
 for update to authenticated using((select bebo_private.is_bebo_owner()))
 with check((select bebo_private.is_bebo_owner()));

create table if not exists public.bebo_admin_audit(
 id bigint generated always as identity primary key,
 admin_id uuid references auth.users(id) on delete set null,
 target_id uuid references public.bebo_profiles(id) on delete set null,
 action text not null check(char_length(action)<=80),
 summary text not null default '' check(char_length(summary)<=600),
 created_at timestamptz not null default now()
);
alter table public.bebo_admin_audit enable row level security;
revoke all on public.bebo_admin_audit from public,anon,authenticated;
grant select on public.bebo_admin_audit to authenticated;
drop policy if exists "bebo owner audit access" on public.bebo_admin_audit;
create policy "bebo owner audit access" on public.bebo_admin_audit for select to authenticated
 using((select bebo_private.is_bebo_owner()));

create or replace function bebo_private.guard_member_controls()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not bebo_private.is_bebo_owner() then raise exception 'Owner permission required';end if;
 if exists(select 1 from public.bebo_moderators m where m.user_id=new.member_id) then
  raise exception 'Administrator accounts cannot be restricted using member controls';
 end if;
 if tg_op='UPDATE' and new.member_id is distinct from old.member_id then
  raise exception 'Cannot transfer a member restriction';
 end if;
 new.updated_by:=auth.uid();new.updated_at:=now();
 return new;
end $$;
revoke all on function bebo_private.guard_member_controls() from public,anon,authenticated;
drop trigger if exists bebo_member_controls_guard on public.bebo_member_controls;
create trigger bebo_member_controls_guard before insert or update on public.bebo_member_controls
 for each row execute function bebo_private.guard_member_controls();

create or replace function bebo_private.audit_member_control()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.bebo_admin_audit(admin_id,target_id,action,summary)
 values(auth.uid(),new.member_id,'member_'||new.status,left(new.reason,600));
 return new;
end $$;
revoke all on function bebo_private.audit_member_control() from public,anon,authenticated;
drop trigger if exists bebo_member_controls_audit on public.bebo_member_controls;
create trigger bebo_member_controls_audit after insert or update on public.bebo_member_controls
 for each row execute function bebo_private.audit_member_control();

create table if not exists public.bebo_announcements(
 id uuid primary key default gen_random_uuid(),
 title text not null check(char_length(title) between 3 and 110),
 body text not null check(char_length(body) between 5 and 1600),
 published boolean not null default false,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bebo_announcements enable row level security;
revoke all on public.bebo_announcements from public,anon,authenticated;
grant select on public.bebo_announcements to anon,authenticated;
grant insert,update,delete on public.bebo_announcements to authenticated;
drop policy if exists "bebo public announcements" on public.bebo_announcements;
create policy "bebo public announcements" on public.bebo_announcements
 for select to anon,authenticated using(published or (select bebo_private.is_bebo_owner()));
drop policy if exists "bebo owner announces" on public.bebo_announcements;
create policy "bebo owner announces" on public.bebo_announcements
 for insert to authenticated with check((select bebo_private.is_bebo_owner()));
drop policy if exists "bebo owner edits announcements" on public.bebo_announcements;
create policy "bebo owner edits announcements" on public.bebo_announcements
 for update to authenticated using((select bebo_private.is_bebo_owner()))
 with check((select bebo_private.is_bebo_owner()));
drop policy if exists "bebo owner removes announcements" on public.bebo_announcements;
create policy "bebo owner removes announcements" on public.bebo_announcements
 for delete to authenticated using((select bebo_private.is_bebo_owner()));

create or replace function bebo_private.guard_announcement()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not bebo_private.is_bebo_owner() then raise exception 'Only Bebo owner can publish announcements';end if;
 if tg_op='INSERT' then new.created_by:=auth.uid();new.created_at:=now();end if;
 if tg_op='UPDATE' then new.created_by:=old.created_by;new.created_at:=old.created_at;end if;
 new.updated_at:=now();return new;
end $$;
revoke all on function bebo_private.guard_announcement() from public,anon,authenticated;
drop trigger if exists bebo_announcement_owner_guard on public.bebo_announcements;
create trigger bebo_announcement_owner_guard before insert or update on public.bebo_announcements
 for each row execute function bebo_private.guard_announcement();

create table if not exists public.bebo_site_settings(
 key text primary key check(key in ('wall_posts','custom_skins','group_creation','announcements')),
 enabled boolean not null default true,
 description text not null default '' check(char_length(description)<=200)
);
alter table public.bebo_site_settings enable row level security;
revoke all on public.bebo_site_settings from public,anon,authenticated;
grant select on public.bebo_site_settings to anon,authenticated;
grant update(enabled) on public.bebo_site_settings to authenticated;
drop policy if exists "bebo public site switches" on public.bebo_site_settings;
create policy "bebo public site switches" on public.bebo_site_settings
 for select to anon,authenticated using(true);
drop policy if exists "bebo owner changes site switches" on public.bebo_site_settings;
create policy "bebo owner changes site switches" on public.bebo_site_settings
 for update to authenticated using((select bebo_private.is_bebo_owner()))
 with check((select bebo_private.is_bebo_owner()));
insert into public.bebo_site_settings(key,enabled,description) values
 ('wall_posts',true,'Allow new profile wall comments'),
 ('custom_skins',true,'Allow members to share new custom skins'),
 ('group_creation',true,'Allow members to create new groups'),
 ('announcements',true,'Display published owner announcements to visitors')
on conflict(key) do nothing;

alter table public.bebo_skins add column if not exists is_hidden boolean not null default false;
alter table public.bebo_skins enable row level security;
-- Keep original owner creation / removal policies. Hide removed designs from public listings.
drop policy if exists "read skins" on public.bebo_skins;
drop policy if exists "bebo visible or owned skins" on public.bebo_skins;
create policy "bebo visible or owned skins" on public.bebo_skins
 for select to anon,authenticated using(
   not is_hidden or creator_id=(select auth.uid()) or (select bebo_private.is_bebo_owner())
 );
revoke update on public.bebo_skins from public,anon,authenticated;
grant update(is_hidden) on public.bebo_skins to authenticated;
drop policy if exists "bebo owner hide shared skins" on public.bebo_skins;
create policy "bebo owner hide shared skins" on public.bebo_skins
 for update to authenticated using((select bebo_private.is_bebo_owner()))
 with check((select bebo_private.is_bebo_owner()));

create or replace function bebo_private.guard_bebo_public_writes()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid; setting text;
begin
 actor:=auth.uid();
 if actor is null then raise exception 'Sign in to post to Bebo';end if;
 if exists(select 1 from public.bebo_member_controls x where x.member_id=actor and x.status='suspended') then
   raise exception 'Your Bebo account is temporarily suspended from posting';
 end if;
 if tg_op='INSERT' then
   if tg_table_name='bebo_wall_posts' then setting:='wall_posts';
   elsif tg_table_name='bebo_skins' then setting:='custom_skins';
   elsif tg_table_name='bebo_groups' then setting:='group_creation';
   end if;
   if setting is not null and exists(select 1 from public.bebo_site_settings s where s.key=setting and not s.enabled) then
     raise exception 'This Bebo feature is temporarily paused by the administrator';
   end if;
 end if;
 return new;
end $$;
revoke all on function bebo_private.guard_bebo_public_writes() from public,anon,authenticated;

do $$
declare name text;
begin
 foreach name in array array[
 'bebo_profiles','bebo_wall_posts','bebo_whiteboards','bebo_skins','bebo_friendships',
 'bebo_mail','bebo_albums','bebo_photos','bebo_blogs','bebo_blog_comments',
 'bebo_groups','bebo_group_members','bebo_luv','bebo_creations',
 'bebo_quizzes','bebo_polls','bebo_poll_votes','bebo_quiz_answers',
 'bebo_other_halves','bebo_top_friends'
 ] loop
  execute format('drop trigger if exists bebo_guard_suspended_account on public.%I',name);
  execute format('create trigger bebo_guard_suspended_account before insert or update on public.%I for each row execute function bebo_private.guard_bebo_public_writes()',name);
 end loop;
end $$;

create index if not exists bebo_announcements_published_at on public.bebo_announcements(published,created_at desc);
create index if not exists bebo_admin_audit_at on public.bebo_admin_audit(created_at desc);
create index if not exists bebo_profiles_created_at on public.bebo_profiles(created_at desc);
create index if not exists bebo_wall_created_at on public.bebo_wall_posts(created_at desc);

