-- Bebo.nz: self-reported real name at registration, private to the site owner.
-- Does not retroactively change or delete existing accounts.
-- An entered name is NOT proof of legal identity.
create schema if not exists bebo_private;
create table if not exists bebo_private.bebo_signup_names (
  user_id uuid primary key references auth.users(id) on delete cascade,
  real_name text not null check (
    char_length(real_name) between 2 and 100
    and real_name ~ '[[:alpha:]]'
  ),
  recorded_at timestamptz not null default now()
);
alter table bebo_private.bebo_signup_names enable row level security;
revoke all on bebo_private.bebo_signup_names from public, anon, authenticated;

create or replace function bebo_private.capture_bebo_signup_name()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare supplied text;
begin
  supplied := regexp_replace(btrim(coalesce(new.raw_user_meta_data->>'bebo_real_name','')), '[[:space:]]+', ' ', 'g');
  -- Existing, legacy or other Auth clients are not locked out during deployment.
  if supplied = '' then return new; end if;
  if char_length(supplied) not between 2 and 100 or supplied !~ '[[:alpha:]]' then
    raise exception 'Enter a valid real name (2 to 100 characters)' using errcode='23514';
  end if;
  insert into bebo_private.bebo_signup_names(user_id,real_name)
  values (new.id,supplied) on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function bebo_private.capture_bebo_signup_name() from public, anon, authenticated;
drop trigger if exists bebo_store_signup_name on auth.users;
create trigger bebo_store_signup_name after insert on auth.users
for each row execute function bebo_private.capture_bebo_signup_name();

-- A narrowly scoped Admin Panel directory, including accounts without a profile.
-- Only Bebo's authenticated, server-assigned owner can retrieve these private names.
create or replace function public.bebo_admin_signup_directory()
returns table (
  user_id uuid,
  real_name text,
  username text,
  display_name text,
  registered_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select u.id, coalesce(n.real_name,''), p.username, p.display_name, u.created_at
  from auth.users u
  left join bebo_private.bebo_signup_names n on n.user_id=u.id
  left join public.bebo_profiles p on p.id=u.id
  where (select bebo_private.is_bebo_owner())
  order by u.created_at desc
  limit 200;
$$;
revoke all on function public.bebo_admin_signup_directory() from public, anon, authenticated;
grant execute on function public.bebo_admin_signup_directory() to authenticated;
