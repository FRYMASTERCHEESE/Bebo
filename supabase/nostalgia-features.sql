-- Bebo 2000s nostalgia features; adds to existing dedicated Bebo backend only.
-- All public-api tables use RLS. Preserve existing profiles, walls and friendships.
alter table public.bebo_profiles
 add column if not exists music_url text not null default '' check (char_length(music_url)<=500),
 add column if not exists flashbox_video_id text not null default '' check (flashbox_video_id='' or flashbox_video_id ~ '^[A-Za-z0-9_-]{11}$'),
 add column if not exists skin_banner_path text not null default '' check (char_length(skin_banner_path)<=300);
alter table public.bebo_skins
 add column if not exists banner_path text not null default '' check (char_length(banner_path)<=300);

create table if not exists public.bebo_top_friends(
 owner_id uuid not null references public.bebo_profiles(id) on delete cascade,
 friend_id uuid not null references public.bebo_profiles(id) on delete cascade,
 position smallint not null check (position between 1 and 16),
 primary key(owner_id,friend_id),
 unique(owner_id,position),
 check(owner_id<>friend_id)
);
alter table public.bebo_top_friends enable row level security;
grant select on public.bebo_top_friends to anon,authenticated;
grant insert,delete on public.bebo_top_friends to authenticated;
drop policy if exists "see top friends" on public.bebo_top_friends;
create policy "see top friends" on public.bebo_top_friends for select to anon,authenticated using(true);
drop policy if exists "choose accepted top friends" on public.bebo_top_friends;
create policy "choose accepted top friends" on public.bebo_top_friends for insert to authenticated
with check (owner_id=(select auth.uid()) and exists(
 select 1 from public.bebo_friendships f where f.status='accepted'
 and ((f.requester_id=owner_id and f.addressee_id=friend_id) or (f.addressee_id=owner_id and f.requester_id=friend_id))
));
drop policy if exists "remove own top friends" on public.bebo_top_friends;
create policy "remove own top friends" on public.bebo_top_friends for delete to authenticated using(owner_id=(select auth.uid()));

create table if not exists public.bebo_luv(
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references public.bebo_profiles(id) on delete cascade,
 recipient_id uuid not null references public.bebo_profiles(id) on delete cascade,
 gifted_date date not null default (now() at time zone 'utc')::date,
 created_at timestamptz not null default now(),
 check(sender_id<>recipient_id)
);
create index if not exists bebo_luv_by_day on public.bebo_luv(sender_id,gifted_date);
create index if not exists bebo_luv_received on public.bebo_luv(recipient_id);
alter table public.bebo_luv enable row level security;
grant select on public.bebo_luv to anon,authenticated;
drop policy if exists "view public luv" on public.bebo_luv;
create policy "view public luv" on public.bebo_luv for select to anon,authenticated using(true);
-- Atomic 3/day enforcement. Direct INSERT is not granted to browser roles.
create or replace function public.bebo_give_luv(p_recipient uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_sender uuid; v_today date; v_used integer;
begin
 v_sender:=auth.uid();
 if v_sender is null then raise exception 'Sign in to send Luv'; end if;
 if p_recipient is null or p_recipient=v_sender then raise exception 'Choose another member to send Luv'; end if;
 v_today:=(now() at time zone 'utc')::date;
 -- Serialize gifts from one sender, including concurrent browser sessions.
 perform 1 from public.bebo_profiles where id=v_sender for update;
 if not found then raise exception 'Create your profile first'; end if;
 perform 1 from public.bebo_profiles where id=p_recipient;
 if not found then raise exception 'Member not found'; end if;
 select count(*) into v_used from public.bebo_luv where sender_id=v_sender and gifted_date=v_today;
 if v_used>=3 then raise exception 'You have used your 3 Luv today. Come back tomorrow (UTC)!'; end if;
 insert into public.bebo_luv(sender_id,recipient_id,gifted_date) values(v_sender,p_recipient,v_today);
 return 2-v_used;
end $$;
revoke all on function public.bebo_give_luv(uuid) from public,anon,authenticated;
grant execute on function public.bebo_give_luv(uuid) to authenticated;

create table if not exists public.bebo_whiteboards(
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.bebo_profiles(id) on delete cascade,
 author_id uuid not null references public.bebo_profiles(id) on delete cascade,
 strokes jsonb not null check (jsonb_typeof(strokes)='array' and char_length(strokes::text) between 2 and 20000),
 created_at timestamptz not null default now()
);
create index if not exists bebo_whiteboards_profile on public.bebo_whiteboards(profile_id,created_at desc);
alter table public.bebo_whiteboards enable row level security;
grant select on public.bebo_whiteboards to anon,authenticated;
grant insert,delete on public.bebo_whiteboards to authenticated;
drop policy if exists "view whiteboards" on public.bebo_whiteboards;
create policy "view whiteboards" on public.bebo_whiteboards for select to anon,authenticated using(true);
drop policy if exists "draw for others" on public.bebo_whiteboards;
create policy "draw for others" on public.bebo_whiteboards for insert to authenticated with check(author_id=(select auth.uid()));
drop policy if exists "erase own drawing or board" on public.bebo_whiteboards;
create policy "erase own drawing or board" on public.bebo_whiteboards for delete to authenticated
 using(author_id=(select auth.uid()) or profile_id=(select auth.uid()));

create table if not exists public.bebo_polls(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.bebo_profiles(id) on delete cascade,
 question text not null check(char_length(question) between 5 and 180),
 options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 4 and char_length(options::text)<=480),
 created_at timestamptz not null default now()
);
create table if not exists public.bebo_poll_votes(
 poll_id uuid not null references public.bebo_polls(id) on delete cascade,
 voter_id uuid not null references public.bebo_profiles(id) on delete cascade,
 choice smallint not null check(choice between 0 and 3),
 created_at timestamptz not null default now(),
 primary key(poll_id,voter_id)
);
create table if not exists public.bebo_quizzes(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.bebo_profiles(id) on delete cascade,
 question text not null check(char_length(question) between 5 and 180),
 options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 4 and char_length(options::text)<=480),
 correct_choice smallint not null check(correct_choice between 0 and 3),
 created_at timestamptz not null default now()
);
create table if not exists public.bebo_quiz_answers(
 quiz_id uuid not null references public.bebo_quizzes(id) on delete cascade,
 voter_id uuid not null references public.bebo_profiles(id) on delete cascade,
 choice smallint not null check(choice between 0 and 3),
 created_at timestamptz not null default now(),
 primary key(quiz_id,voter_id)
);
alter table public.bebo_polls enable row level security;
alter table public.bebo_poll_votes enable row level security;
alter table public.bebo_quizzes enable row level security;
alter table public.bebo_quiz_answers enable row level security;
grant select on public.bebo_polls,public.bebo_poll_votes,public.bebo_quizzes,public.bebo_quiz_answers to anon,authenticated;
grant insert on public.bebo_polls,public.bebo_poll_votes,public.bebo_quizzes,public.bebo_quiz_answers to authenticated;
grant delete on public.bebo_polls,public.bebo_quizzes to authenticated;
drop policy if exists "view polls" on public.bebo_polls;
create policy "view polls" on public.bebo_polls for select to anon,authenticated using(true);
drop policy if exists "create polls" on public.bebo_polls;
create policy "create polls" on public.bebo_polls for insert to authenticated with check(owner_id=(select auth.uid()));
drop policy if exists "delete own polls" on public.bebo_polls;
create policy "delete own polls" on public.bebo_polls for delete to authenticated using(owner_id=(select auth.uid()));
drop policy if exists "view votes" on public.bebo_poll_votes;
create policy "view votes" on public.bebo_poll_votes for select to anon,authenticated using(true);
drop policy if exists "cast vote" on public.bebo_poll_votes;
create policy "cast vote" on public.bebo_poll_votes for insert to authenticated with check(voter_id=(select auth.uid()));
drop policy if exists "view quizzes" on public.bebo_quizzes;
create policy "view quizzes" on public.bebo_quizzes for select to anon,authenticated using(true);
drop policy if exists "create quizzes" on public.bebo_quizzes;
create policy "create quizzes" on public.bebo_quizzes for insert to authenticated with check(owner_id=(select auth.uid()));
drop policy if exists "delete own quizzes" on public.bebo_quizzes;
create policy "delete own quizzes" on public.bebo_quizzes for delete to authenticated using(owner_id=(select auth.uid()));
drop policy if exists "view quiz answers" on public.bebo_quiz_answers;
create policy "view quiz answers" on public.bebo_quiz_answers for select to anon,authenticated using(true);
drop policy if exists "submit quiz answer" on public.bebo_quiz_answers;
create policy "submit quiz answer" on public.bebo_quiz_answers for insert to authenticated with check(voter_id=(select auth.uid()));

create table if not exists public.bebo_creations(
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references public.bebo_profiles(id) on delete cascade,
 kind text not null check(kind in ('band','author')),
 title text not null check(char_length(title) between 3 and 120),
 body text not null check(char_length(body) between 3 and 3000),
 media_url text not null default '' check(char_length(media_url)<=500),
 created_at timestamptz not null default now()
);
alter table public.bebo_creations enable row level security;
grant select on public.bebo_creations to anon,authenticated;
grant insert,delete on public.bebo_creations to authenticated;
drop policy if exists "view creations" on public.bebo_creations;
create policy "view creations" on public.bebo_creations for select to anon,authenticated using(true);
drop policy if exists "publish creations" on public.bebo_creations;
create policy "publish creations" on public.bebo_creations for insert to authenticated with check(author_id=(select auth.uid()));
drop policy if exists "remove own creations" on public.bebo_creations;
create policy "remove own creations" on public.bebo_creations for delete to authenticated using(author_id=(select auth.uid()));

-- Uploaded skin banners must be images and within the creator's own UUID folder.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bebo-skin-banners','bebo-skin-banners',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
drop policy if exists "bebo public skin banner read" on storage.objects;
create policy "bebo public skin banner read" on storage.objects for select to anon,authenticated using(bucket_id='bebo-skin-banners');
drop policy if exists "bebo own skin banner upload" on storage.objects;
create policy "bebo own skin banner upload" on storage.objects for insert to authenticated
 with check(bucket_id='bebo-skin-banners' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "bebo own skin banner delete" on storage.objects;
create policy "bebo own skin banner delete" on storage.objects for delete to authenticated
 using(bucket_id='bebo-skin-banners' and (storage.foldername(name))[1]=(select auth.uid())::text);
