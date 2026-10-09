-- Bebo social backend — execute on a NEW Supabase project only.
-- SQL is idempotent for first-time setup; do not apply to an unrelated project.
create extension if not exists pgcrypto;
create table if not exists public.bebo_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check (username ~ '^[a-z0-9_]{3,25}$'),
 display_name text not null check (char_length(display_name) between 1 and 60),
 bio text not null default '' check (char_length(bio) <= 2000),
 status text not null default '' check (char_length(status) <= 180),
 location text not null default '' check (char_length(location) <= 80),
 music text not null default '' check (char_length(music) <= 120),
 avatar_path text,
 skin text not null default 'classic' check (skin in ('classic','glitter','emo','ocean','sunset','mint','ruby','cloud','custom')),
 skin_primary text not null default '#c52d61' check (skin_primary ~ '^#[0-9a-fA-F]{6}$'),
 skin_secondary text not null default '#f5b2ce' check (skin_secondary ~ '^#[0-9a-fA-F]{6}$'),
 created_at timestamptz not null default now()
);
create table if not exists public.bebo_friendships (
 id uuid primary key default gen_random_uuid(),
 requester_id uuid not null references public.bebo_profiles(id) on delete cascade,
 addressee_id uuid not null references public.bebo_profiles(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(),
 check(requester_id <> addressee_id)
);
create unique index if not exists bebo_friend_pair on public.bebo_friendships
 (least(requester_id,addressee_id),greatest(requester_id,addressee_id));
create table if not exists public.bebo_wall_posts (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references public.bebo_profiles(id) on delete cascade,
 profile_id uuid not null references public.bebo_profiles(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 1200),
 created_at timestamptz not null default now()
);
create index if not exists bebo_wall_profile_created on public.bebo_wall_posts(profile_id,created_at desc);
create table if not exists public.bebo_skins (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null references public.bebo_profiles(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 70),
 primary_color text not null check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
 secondary_color text not null check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
 created_at timestamptz not null default now()
);
create table if not exists public.bebo_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references public.bebo_profiles(id) on delete cascade,
 reported_profile_id uuid references public.bebo_profiles(id) on delete set null,
 reported_post_id uuid references public.bebo_wall_posts(id) on delete set null,
 reason text not null check (char_length(reason) between 10 and 1000),
 created_at timestamptz not null default now(),
 check(reported_profile_id is not null or reported_post_id is not null)
);
alter table public.bebo_profiles enable row level security;
alter table public.bebo_friendships enable row level security;
alter table public.bebo_wall_posts enable row level security;
alter table public.bebo_skins enable row level security;
alter table public.bebo_reports enable row level security;
grant select on public.bebo_profiles, public.bebo_wall_posts, public.bebo_skins to anon, authenticated;
grant insert, update, delete on public.bebo_profiles to authenticated;
grant select, insert, delete on public.bebo_friendships to authenticated;
grant update(status) on public.bebo_friendships to authenticated;
grant insert, delete on public.bebo_wall_posts, public.bebo_skins to authenticated;
grant insert on public.bebo_reports to authenticated;
drop policy if exists "public read profiles" on public.bebo_profiles;
create policy "public read profiles" on public.bebo_profiles for select to anon, authenticated using(true);
drop policy if exists "insert own profile" on public.bebo_profiles;
create policy "insert own profile" on public.bebo_profiles for insert to authenticated with check(id=(select auth.uid()));
drop policy if exists "update own profile" on public.bebo_profiles;
create policy "update own profile" on public.bebo_profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
drop policy if exists "delete own profile" on public.bebo_profiles;
create policy "delete own profile" on public.bebo_profiles for delete to authenticated using(id=(select auth.uid()));
drop policy if exists "read own friendships" on public.bebo_friendships;
create policy "read own friendships" on public.bebo_friendships for select to authenticated using(requester_id=(select auth.uid()) or addressee_id=(select auth.uid()));
drop policy if exists "request friendship" on public.bebo_friendships;
create policy "request friendship" on public.bebo_friendships for insert to authenticated with check(requester_id=(select auth.uid()) and status='pending');
drop policy if exists "answer friendship" on public.bebo_friendships;
create policy "answer friendship" on public.bebo_friendships for update to authenticated
 using(addressee_id=(select auth.uid()) and status='pending')
 with check(addressee_id=(select auth.uid()) and status in ('accepted','declined'));
drop policy if exists "delete friendship" on public.bebo_friendships;
create policy "delete friendship" on public.bebo_friendships for delete to authenticated using(requester_id=(select auth.uid()) or addressee_id=(select auth.uid()));
drop policy if exists "read wall" on public.bebo_wall_posts;
create policy "read wall" on public.bebo_wall_posts for select to anon, authenticated using(true);
drop policy if exists "write own wall comment" on public.bebo_wall_posts;
create policy "write own wall comment" on public.bebo_wall_posts for insert to authenticated with check(author_id=(select auth.uid()));
drop policy if exists "delete wall comment" on public.bebo_wall_posts;
create policy "delete wall comment" on public.bebo_wall_posts for delete to authenticated using(author_id=(select auth.uid()) or profile_id=(select auth.uid()));
drop policy if exists "read skins" on public.bebo_skins;
create policy "read skins" on public.bebo_skins for select to anon, authenticated using(true);
drop policy if exists "create skin" on public.bebo_skins;
create policy "create skin" on public.bebo_skins for insert to authenticated with check(creator_id=(select auth.uid()));
drop policy if exists "delete skin" on public.bebo_skins;
create policy "delete skin" on public.bebo_skins for delete to authenticated using(creator_id=(select auth.uid()));
drop policy if exists "file report" on public.bebo_reports;
create policy "file report" on public.bebo_reports for insert to authenticated with check(reporter_id=(select auth.uid()));
-- Avatars are publicly readable, with write access restricted to each user's own folder.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('bebo-avatars','bebo-avatars',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
drop policy if exists "bebo avatar read" on storage.objects;
create policy "bebo avatar read" on storage.objects for select to anon, authenticated using(bucket_id='bebo-avatars');
drop policy if exists "bebo avatar upload" on storage.objects;
create policy "bebo avatar upload" on storage.objects for insert to authenticated
 with check(bucket_id='bebo-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "bebo avatar delete" on storage.objects;
create policy "bebo avatar delete" on storage.objects for delete to authenticated
 using(bucket_id='bebo-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
