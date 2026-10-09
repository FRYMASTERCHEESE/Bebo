-- Atomic ownership-checked Top 16 reorder; only accepted friends may appear.
create or replace function public.bebo_set_top_friends(p_friends uuid[])
returns integer language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_count integer; v_friend uuid;
begin
 v_owner:=auth.uid();
 if v_owner is null then raise exception 'Sign in first'; end if;
 if p_friends is null then p_friends:='{}'::uuid[]; end if;
 v_count:=coalesce(array_length(p_friends,1),0);
 if v_count>16 then raise exception 'Top 16 is limited to 16 friends'; end if;
 if (select count(distinct x) from unnest(p_friends) as x)<>v_count then raise exception 'Top 16 cannot have duplicates'; end if;
 perform 1 from public.bebo_profiles where id=v_owner for update;
 if not found then raise exception 'Create your profile first'; end if;
 foreach v_friend in array p_friends loop
  if v_friend=v_owner or not exists (
    select 1 from public.bebo_friendships f where f.status='accepted'
    and ((f.requester_id=v_owner and f.addressee_id=v_friend) or (f.addressee_id=v_owner and f.requester_id=v_friend))
  ) then raise exception 'Top 16 must contain accepted friends only'; end if;
 end loop;
 delete from public.bebo_top_friends where owner_id=v_owner;
 if v_count>0 then
   insert into public.bebo_top_friends(owner_id,friend_id,position)
   select v_owner,p_friends[i],i::smallint from generate_subscripts(p_friends,1) as i;
 end if;
 return v_count;
end $$;
revoke all on function public.bebo_set_top_friends(uuid[]) from public,anon,authenticated;
grant execute on function public.bebo_set_top_friends(uuid[]) to authenticated;