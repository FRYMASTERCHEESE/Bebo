-- Prevent Other Half acceptance from altering identities; limit photo path spoofing.
revoke update on public.bebo_other_halves from authenticated;
grant update(status) on public.bebo_other_halves to authenticated;
create or replace function bebo_private.enforce_bebo_creation_rules()
returns trigger language plpgsql security definer set search_path='' as $$
declare count_photos integer;
begin
  new.created_at := now();
  if TG_TABLE_NAME='bebo_photos' then
    if new.object_path !~ ('^'||new.owner_id::text||'/[0-9a-f-]{36}\.(jpg|png|webp)$') then
      raise exception 'Invalid uploaded photo path';
    end if;
    perform 1 from public.bebo_albums where id=new.album_id and owner_id=new.owner_id for update;
    if not found then raise exception 'This album does not belong to this user'; end if;
    select count(*) into count_photos from public.bebo_photos where album_id=new.album_id;
    if count_photos>=96 then raise exception 'Bebo photo albums are limited to 96 pictures'; end if;
  end if;
  return new;
end $$;
revoke all on function bebo_private.enforce_bebo_creation_rules() from public,anon,authenticated;