-- Limit each album to 96 images as remembered from the original Bebo.
-- Reject forged timestamps that could bypass throttles.
create or replace function bebo_private.enforce_bebo_creation_rules()
returns trigger language plpgsql security definer set search_path='' as $$
declare count_photos integer;
begin
  new.created_at := now();
  if TG_TABLE_NAME='bebo_photos' then
    perform 1 from public.bebo_albums where id=new.album_id and owner_id=new.owner_id for update;
    if not found then raise exception 'This album does not belong to this user'; end if;
    select count(*) into count_photos from public.bebo_photos where album_id=new.album_id;
    if count_photos>=96 then raise exception 'Bebo photo albums are limited to 96 pictures'; end if;
  end if;
  return new;
end $$;
revoke all on function bebo_private.enforce_bebo_creation_rules() from public,anon,authenticated;
drop trigger if exists bebo_album_photo_limit on public.bebo_photos;
create trigger bebo_album_photo_limit before insert on public.bebo_photos
for each row execute function bebo_private.enforce_bebo_creation_rules();
drop trigger if exists bebo_mail_timestamp on public.bebo_mail;
create trigger bebo_mail_timestamp before insert on public.bebo_mail
for each row execute function bebo_private.enforce_bebo_creation_rules();
drop trigger if exists bebo_blog_comment_timestamp on public.bebo_blog_comments;
create trigger bebo_blog_comment_timestamp before insert on public.bebo_blog_comments
for each row execute function bebo_private.enforce_bebo_creation_rules();
drop trigger if exists bebo_wall_timestamp on public.bebo_wall_posts;
create trigger bebo_wall_timestamp before insert on public.bebo_wall_posts
for each row execute function bebo_private.enforce_bebo_creation_rules();
drop trigger if exists bebo_draw_timestamp on public.bebo_whiteboards;
create trigger bebo_draw_timestamp before insert on public.bebo_whiteboards
for each row execute function bebo_private.enforce_bebo_creation_rules();
drop trigger if exists bebo_friend_timestamp on public.bebo_friendships;
create trigger bebo_friend_timestamp before insert on public.bebo_friendships
for each row execute function bebo_private.enforce_bebo_creation_rules();

create or replace function bebo_private.on_block_other_half()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  delete from public.bebo_other_halves h where
   (h.owner_id=new.blocker_id and h.person_id=new.blocked_id)
   or (h.owner_id=new.blocked_id and h.person_id=new.blocker_id);
  return new;
end $$;
revoke all on function bebo_private.on_block_other_half() from public,anon,authenticated;
drop trigger if exists bebo_block_other_half on public.bebo_blocks;
create trigger bebo_block_other_half after insert on public.bebo_blocks
for each row execute function bebo_private.on_block_other_half();
