-- Reproducible Bebo member safety schema (already applied to dedicated Bebo database).

-- Requires the base and nostalgia-features migrations. Do not run against unrelated projects.

create schema if not exists bebo_private;

revoke all on schema bebo_private from public,anon,authenticated;

create table if not exists public.bebo_blocks(
 blocker_id uuid not null references public.bebo_profiles(id) on delete cascade,
 blocked_id uuid not null references public.bebo_profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(blocker_id,blocked_id),
 constraint bebo_blocks_cannot_block_self check(blocker_id<>blocked_id)
);

alter table public.bebo_blocks enable row level security;

grant select,insert,delete on public.bebo_blocks to authenticated;

drop policy if exists "read own blocks" on public.bebo_blocks;
create policy "read own blocks" on public.bebo_blocks for select to authenticated using(blocker_id=(select auth.uid()));

drop policy if exists "insert own blocks" on public.bebo_blocks;
create policy "insert own blocks" on public.bebo_blocks for insert to authenticated with check(blocker_id=(select auth.uid()));

drop policy if exists "delete own blocks" on public.bebo_blocks;
create policy "delete own blocks" on public.bebo_blocks for delete to authenticated using(blocker_id=(select auth.uid()));

CREATE OR REPLACE FUNCTION bebo_private.guard_member_interactions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid; recipient uuid; limit_per_min integer:=0; limit_per_day integer:=0; count_min integer; count_day integer;
begin
 case TG_TABLE_NAME
 when 'bebo_wall_posts' then
  actor:=new.author_id;recipient:=new.profile_id;limit_per_min:=5;limit_per_day:=120;
 when 'bebo_whiteboards' then
  actor:=new.author_id;recipient:=new.profile_id;limit_per_min:=5;limit_per_day:=60;
 when 'bebo_friendships' then
  actor:=new.requester_id;recipient:=new.addressee_id;limit_per_min:=4;limit_per_day:=30;
 else raise exception 'Unsupported interaction';
 end case;
 if actor is null or actor<>auth.uid() and TG_OP='INSERT' then raise exception 'Not signed in as this member'; end if;
 if exists(select 1 from public.bebo_blocks b where
    (b.blocker_id=actor and b.blocked_id=recipient)
    or (b.blocker_id=recipient and b.blocked_id=actor)) then
   raise exception 'This interaction is not allowed';
 end if;
 if TG_OP='INSERT' then
  -- Serialize requests by a single author to avoid parallel-limit bypass.
  perform 1 from public.bebo_profiles p where p.id=actor for update;
  if TG_TABLE_NAME='bebo_wall_posts' then
    select count(*) into count_min from public.bebo_wall_posts where author_id=actor and created_at>now()-interval '1 minute';
    select count(*) into count_day from public.bebo_wall_posts where author_id=actor and created_at>now()-interval '1 day';
  elsif TG_TABLE_NAME='bebo_whiteboards' then
    select count(*) into count_min from public.bebo_whiteboards where author_id=actor and created_at>now()-interval '1 minute';
    select count(*) into count_day from public.bebo_whiteboards where author_id=actor and created_at>now()-interval '1 day';
  else
    select count(*) into count_min from public.bebo_friendships where requester_id=actor and created_at>now()-interval '1 minute';
    select count(*) into count_day from public.bebo_friendships where requester_id=actor and created_at>now()-interval '1 day';
  end if;
  if count_min>=limit_per_min or count_day>=limit_per_day then raise exception 'Too many actions. Try again later.';end if;
 end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION bebo_private.guard_reports()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer;
begin
 if new.reporter_id is distinct from auth.uid() then raise exception 'Not your report';end if;
 perform 1 from public.bebo_profiles where id=new.reporter_id for update;
 select count(*) into n from public.bebo_reports where reporter_id=new.reporter_id and created_at>now()-interval '24 hours';
 if n>=10 then raise exception 'Daily report limit reached';end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION bebo_private.on_block()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 delete from public.bebo_top_friends t where
  (t.owner_id=new.blocker_id and t.friend_id=new.blocked_id)
  or (t.owner_id=new.blocked_id and t.friend_id=new.blocker_id);
 delete from public.bebo_friendships f where
  (f.requester_id=new.blocker_id and f.addressee_id=new.blocked_id)
  or (f.requester_id=new.blocked_id and f.addressee_id=new.blocker_id);
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.bebo_give_luv(p_recipient uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_sender uuid; v_today date; v_used integer;
begin
 v_sender:=auth.uid();
 if v_sender is null then raise exception 'Sign in to send Luv'; end if;
 if p_recipient is null or p_recipient=v_sender then raise exception 'Choose another member to send Luv'; end if;
 v_today:=(now() at time zone 'utc')::date;
 perform 1 from public.bebo_profiles where id=v_sender for update;
 if not found then raise exception 'Create your profile first';end if;
 perform 1 from public.bebo_profiles where id=p_recipient;
 if not found then raise exception 'Member not found';end if;
 if exists(select 1 from public.bebo_blocks b where
   (b.blocker_id=v_sender and b.blocked_id=p_recipient)
   or (b.blocker_id=p_recipient and b.blocked_id=v_sender)) then
    raise exception 'This interaction is not allowed';
 end if;
 select count(*) into v_used from public.bebo_luv where sender_id=v_sender and gifted_date=v_today;
 if v_used>=3 then raise exception 'You have used your 3 Luv today. Come back tomorrow (UTC)!';end if;
 insert into public.bebo_luv(sender_id,recipient_id,gifted_date) values(v_sender,p_recipient,v_today);
 return 2-v_used;
end $function$
;

revoke all on function bebo_private.guard_member_interactions() from public,anon,authenticated;

revoke all on function bebo_private.guard_reports() from public,anon,authenticated;

revoke all on function bebo_private.on_block() from public,anon,authenticated;

revoke all on function public.bebo_give_luv(uuid) from public,anon,authenticated;

grant execute on function public.bebo_give_luv(uuid) to authenticated;

drop trigger if exists bebo_guard_wall on public.bebo_wall_posts;
create trigger bebo_guard_wall before insert on public.bebo_wall_posts for each row execute function bebo_private.guard_member_interactions();
drop trigger if exists bebo_guard_draw on public.bebo_whiteboards;
create trigger bebo_guard_draw before insert on public.bebo_whiteboards for each row execute function bebo_private.guard_member_interactions();
drop trigger if exists bebo_guard_friendship on public.bebo_friendships;
create trigger bebo_guard_friendship before insert or update on public.bebo_friendships for each row execute function bebo_private.guard_member_interactions();
drop trigger if exists bebo_guard_report_limit on public.bebo_reports;
create trigger bebo_guard_report_limit before insert on public.bebo_reports for each row execute function bebo_private.guard_reports();
drop trigger if exists bebo_block_disconnect on public.bebo_blocks;
create trigger bebo_block_disconnect after insert on public.bebo_blocks for each row execute function bebo_private.on_block();
