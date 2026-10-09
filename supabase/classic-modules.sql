-- Bebo Classic expansion: Photos, Blogs, Private Mail, Other Half, Groups.
-- Dedicated Bebo project ONLY; original tables remain unchanged.
create table if not exists public.bebo_albums (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.bebo_profiles(id) on delete cascade,
  title text not null check(char_length(title) between 1 and 80),
  description text not null default '' check(char_length(description)<=500),
  created_at timestamptz not null default now()
);
create table if not exists public.bebo_photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.bebo_albums(id) on delete cascade,
  owner_id uuid not null references public.bebo_profiles(id) on delete cascade,
  object_path text not null check (char_length(object_path)<=240),
  caption text not null default '' check(char_length(caption)<=250),
  created_at timestamptz not null default now(),
  unique(object_path)
);
create index if not exists bebo_photo_album_time on public.bebo_photos(album_id,created_at desc);
create table if not exists public.bebo_blogs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.bebo_profiles(id) on delete cascade,
  title text not null check(char_length(title) between 3 and 130),
  body text not null check(char_length(body) between 10 and 12000),
  created_at timestamptz not null default now()
);
create index if not exists bebo_blog_owner_time on public.bebo_blogs(owner_id,created_at desc);
create table if not exists public.bebo_blog_comments (
  id uuid primary key default gen_random_uuid(),
  blog_id uuid not null references public.bebo_blogs(id) on delete cascade,
  author_id uuid not null references public.bebo_profiles(id) on delete cascade,
  body text not null check(char_length(body) between 1 and 800),
  created_at timestamptz not null default now()
);
create index if not exists bebo_blog_comment_time on public.bebo_blog_comments(blog_id,created_at);
create table if not exists public.bebo_mail (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.bebo_profiles(id) on delete cascade,
  recipient_id uuid not null references public.bebo_profiles(id) on delete cascade,
  subject text not null check(char_length(subject) between 1 and 120),
  body text not null check(char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  check(sender_id<>recipient_id)
);
create index if not exists bebo_mail_recipient_time on public.bebo_mail(recipient_id,created_at desc);
create index if not exists bebo_mail_sender_time on public.bebo_mail(sender_id,created_at desc);
create table if not exists public.bebo_other_halves (
  owner_id uuid primary key references public.bebo_profiles(id) on delete cascade,
  person_id uuid not null references public.bebo_profiles(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  check(owner_id<>person_id)
);
create table if not exists public.bebo_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.bebo_profiles(id) on delete cascade,
  name text not null check(char_length(name) between 3 and 75),
  description text not null default '' check(char_length(description)<=900),
  created_at timestamptz not null default now()
);
create table if not exists public.bebo_group_members (
  group_id uuid not null references public.bebo_groups(id) on delete cascade,
  member_id uuid not null references public.bebo_profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(group_id,member_id)
);
alter table public.bebo_albums enable row level security;
alter table public.bebo_photos enable row level security;
alter table public.bebo_blogs enable row level security;
alter table public.bebo_blog_comments enable row level security;
alter table public.bebo_mail enable row level security;
alter table public.bebo_other_halves enable row level security;
alter table public.bebo_groups enable row level security;
alter table public.bebo_group_members enable row level security;
grant select on public.bebo_albums,public.bebo_photos,public.bebo_blogs,public.bebo_blog_comments,public.bebo_groups,public.bebo_group_members to anon,authenticated;
grant select on public.bebo_mail,public.bebo_other_halves to authenticated;
grant select on public.bebo_other_halves to anon;
grant insert,delete on public.bebo_albums,public.bebo_photos,public.bebo_blogs,public.bebo_blog_comments,public.bebo_groups,public.bebo_group_members to authenticated;
grant insert on public.bebo_mail to authenticated;
grant insert,update,delete on public.bebo_other_halves to authenticated;

drop policy if exists "public albums" on public.bebo_albums;
create policy "public albums" on public.bebo_albums for select to anon,authenticated using(true);
drop policy if exists "own new album" on public.bebo_albums;
create policy "own new album" on public.bebo_albums for insert to authenticated with check(owner_id=(select auth.uid()));
drop policy if exists "delete own album" on public.bebo_albums;
create policy "delete own album" on public.bebo_albums for delete to authenticated using(owner_id=(select auth.uid()));

drop policy if exists "public photos" on public.bebo_photos;
create policy "public photos" on public.bebo_photos for select to anon,authenticated using(true);
drop policy if exists "own album photos" on public.bebo_photos;
create policy "own album photos" on public.bebo_photos for insert to authenticated
 with check(owner_id=(select auth.uid()) and exists(select 1 from public.bebo_albums a where a.id=album_id and a.owner_id=(select auth.uid())));
drop policy if exists "delete own photos" on public.bebo_photos;
create policy "delete own photos" on public.bebo_photos for delete to authenticated using(owner_id=(select auth.uid()));

drop policy if exists "public blogs" on public.bebo_blogs;
create policy "public blogs" on public.bebo_blogs for select to anon,authenticated using(true);
drop policy if exists "write own blog" on public.bebo_blogs;
create policy "write own blog" on public.bebo_blogs for insert to authenticated with check(owner_id=(select auth.uid()));
drop policy if exists "delete own blog" on public.bebo_blogs;
create policy "delete own blog" on public.bebo_blogs for delete to authenticated using(owner_id=(select auth.uid()));

drop policy if exists "public blog comments" on public.bebo_blog_comments;
create policy "public blog comments" on public.bebo_blog_comments for select to anon,authenticated using(true);
drop policy if exists "author blog comment" on public.bebo_blog_comments;
create policy "author blog comment" on public.bebo_blog_comments for insert to authenticated with check(author_id=(select auth.uid()));
drop policy if exists "remove blog comment" on public.bebo_blog_comments;
create policy "remove blog comment" on public.bebo_blog_comments for delete to authenticated
 using(author_id=(select auth.uid()) or exists(select 1 from public.bebo_blogs b where b.id=blog_id and b.owner_id=(select auth.uid())));

drop policy if exists "private mail participants" on public.bebo_mail;
create policy "private mail participants" on public.bebo_mail for select to authenticated
 using(sender_id=(select auth.uid()) or recipient_id=(select auth.uid()));
drop policy if exists "send own mail" on public.bebo_mail;
create policy "send own mail" on public.bebo_mail for insert to authenticated
 with check(sender_id=(select auth.uid()) and not exists(
   select 1 from public.bebo_blocks b where
   (b.blocker_id=sender_id and b.blocked_id=recipient_id) or
   (b.blocker_id=recipient_id and b.blocked_id=sender_id)));

drop policy if exists "public accepted other halves or involved" on public.bebo_other_halves;
create policy "public accepted other halves or involved" on public.bebo_other_halves for select to anon,authenticated
 using(status='accepted' or owner_id=(select auth.uid()) or person_id=(select auth.uid()));
drop policy if exists "send other half request" on public.bebo_other_halves;
create policy "send other half request" on public.bebo_other_halves for insert to authenticated
 with check(owner_id=(select auth.uid()) and status='pending' and exists(
 select 1 from public.bebo_friendships f where status='accepted' and
 ((f.requester_id=owner_id and f.addressee_id=person_id) or (f.addressee_id=owner_id and f.requester_id=person_id)))
 and not exists(select 1 from public.bebo_blocks b where
 (b.blocker_id=owner_id and b.blocked_id=person_id) or (b.blocker_id=person_id and b.blocked_id=owner_id)));
drop policy if exists "accept nominated other half" on public.bebo_other_halves;
create policy "accept nominated other half" on public.bebo_other_halves for update to authenticated
 using(person_id=(select auth.uid()) and status='pending')
 with check(person_id=(select auth.uid()) and status='accepted');
drop policy if exists "remove other half" on public.bebo_other_halves;
create policy "remove other half" on public.bebo_other_halves for delete to authenticated
 using(owner_id=(select auth.uid()) or person_id=(select auth.uid()));

drop policy if exists "public groups" on public.bebo_groups;
create policy "public groups" on public.bebo_groups for select to anon,authenticated using(true);
drop policy if exists "create group" on public.bebo_groups;
create policy "create group" on public.bebo_groups for insert to authenticated with check(owner_id=(select auth.uid()));
drop policy if exists "remove own group" on public.bebo_groups;
create policy "remove own group" on public.bebo_groups for delete to authenticated using(owner_id=(select auth.uid()));
drop policy if exists "public group members" on public.bebo_group_members;
create policy "public group members" on public.bebo_group_members for select to anon,authenticated using(true);
drop policy if exists "join group" on public.bebo_group_members;
create policy "join group" on public.bebo_group_members for insert to authenticated with check(member_id=(select auth.uid()));
drop policy if exists "leave group" on public.bebo_group_members;
create policy "leave group" on public.bebo_group_members for delete to authenticated using(member_id=(select auth.uid()));

-- Uploads remain stored under the uploader's UUID prefix, not under other users.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bebo-photos','bebo-photos',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
drop policy if exists "bebo photo public read" on storage.objects;
create policy "bebo photo public read" on storage.objects for select to anon,authenticated using(bucket_id='bebo-photos');
drop policy if exists "bebo photo own uploads" on storage.objects;
create policy "bebo photo own uploads" on storage.objects for insert to authenticated
 with check(bucket_id='bebo-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "bebo photo own deletion" on storage.objects;
create policy "bebo photo own deletion" on storage.objects for delete to authenticated
 using(bucket_id='bebo-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Protect conversations from spam and enforce Other Half limits.
create schema if not exists bebo_private;
revoke all on schema bebo_private from public,anon,authenticated;
create or replace function bebo_private.guard_classic_writes()
returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid; target uuid; recent_count integer; max_count integer;
begin
 if TG_TABLE_NAME='bebo_mail' then
   actor:=new.sender_id;target:=new.recipient_id;max_count:=12;
 elsif TG_TABLE_NAME='bebo_blog_comments' then
   actor:=new.author_id;
   select owner_id into target from public.bebo_blogs where id=new.blog_id;
   max_count:=15;
 elsif TG_TABLE_NAME='bebo_photos' then
   actor:=new.owner_id;target:=actor;max_count:=15;
 else
   return new;
 end if;
 if actor is distinct from auth.uid() then raise exception 'Not allowed';end if;
 if actor<>target and exists(select 1 from public.bebo_blocks where
    (blocker_id=actor and blocked_id=target) or (blocker_id=target and blocked_id=actor))
 then raise exception 'This interaction is blocked';end if;
 perform 1 from public.bebo_profiles where id=actor for update;
 if TG_TABLE_NAME='bebo_mail' then
   select count(*) into recent_count from public.bebo_mail where sender_id=actor and created_at>now()-interval '1 hour';
 elsif TG_TABLE_NAME='bebo_blog_comments' then
   select count(*) into recent_count from public.bebo_blog_comments where author_id=actor and created_at>now()-interval '1 hour';
 else
   select count(*) into recent_count from public.bebo_photos where owner_id=actor and created_at>now()-interval '1 hour';
 end if;
 if recent_count>=max_count then raise exception 'You reached the hourly limit. Try again later.';end if;
 return new;
end $$;
revoke all on function bebo_private.guard_classic_writes() from public,anon,authenticated;
drop trigger if exists bebo_mail_safety on public.bebo_mail;
create trigger bebo_mail_safety before insert on public.bebo_mail for each row execute function bebo_private.guard_classic_writes();
drop trigger if exists bebo_blog_comment_safety on public.bebo_blog_comments;
create trigger bebo_blog_comment_safety before insert on public.bebo_blog_comments for each row execute function bebo_private.guard_classic_writes();
drop trigger if exists bebo_photo_upload_safety on public.bebo_photos;
create trigger bebo_photo_upload_safety before insert on public.bebo_photos for each row execute function bebo_private.guard_classic_writes();
