-- Bebo Verified: independent Bebo community review. No Meta affiliation or ID-document collection.
-- Applied to the dedicated live Supabase project on 10 October 2026.
create table if not exists public.bebo_verified_profiles(
 user_id uuid primary key references public.bebo_profiles(id) on delete cascade,
 verified_at timestamptz not null default now()
);
alter table public.bebo_verified_profiles enable row level security;
revoke all on public.bebo_verified_profiles from public,anon,authenticated;
grant select on public.bebo_verified_profiles to anon,authenticated;
grant insert,delete on public.bebo_verified_profiles to authenticated;
drop policy if exists "Bebo public verified badge lookup" on public.bebo_verified_profiles;
create policy "Bebo public verified badge lookup" on public.bebo_verified_profiles for select to anon,authenticated using(true);
drop policy if exists "Only Bebo owner can verify" on public.bebo_verified_profiles;
create policy "Only Bebo owner can verify" on public.bebo_verified_profiles for insert to authenticated with check((select bebo_private.is_bebo_owner()));
drop policy if exists "Only Bebo owner can revoke verification" on public.bebo_verified_profiles;
create policy "Only Bebo owner can revoke verification" on public.bebo_verified_profiles for delete to authenticated using((select bebo_private.is_bebo_owner()));
create table if not exists public.bebo_verification_requests(
 user_id uuid primary key references public.bebo_profiles(id) on delete cascade,
 reason text not null default '' check(char_length(reason) between 10 and 350),
 status text not null default 'pending' check(status in('pending','approved','declined')),
 requested_at timestamptz not null default now(),
 reviewed_at timestamptz
);
alter table public.bebo_verification_requests enable row level security;
revoke all on public.bebo_verification_requests from public,anon,authenticated;
grant select,insert on public.bebo_verification_requests to authenticated;
grant update(status,reviewed_at) on public.bebo_verification_requests to authenticated;
drop policy if exists "Bebo applicants see their own verification request" on public.bebo_verification_requests;
create policy "Bebo applicants see their own verification request" on public.bebo_verification_requests for select to authenticated using(user_id=(select auth.uid()) or (select bebo_private.is_bebo_owner()));
drop policy if exists "Bebo applicants request verification" on public.bebo_verification_requests;
create policy "Bebo applicants request verification" on public.bebo_verification_requests for insert to authenticated with check(user_id=(select auth.uid()) and status='pending' and reviewed_at is null);
drop policy if exists "Bebo owner reviews verification requests" on public.bebo_verification_requests;
create policy "Bebo owner reviews verification requests" on public.bebo_verification_requests for update to authenticated using((select bebo_private.is_bebo_owner())) with check((select bebo_private.is_bebo_owner()));
create index if not exists bebo_verified_profiles_time_idx on public.bebo_verified_profiles(verified_at desc);
create index if not exists bebo_verification_requests_status_time_idx on public.bebo_verification_requests(status,requested_at desc);
