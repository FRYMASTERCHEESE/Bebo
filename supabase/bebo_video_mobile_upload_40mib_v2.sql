-- Deployed to Bebo Supabase 2026-10-10; keep as incremental migration after bebo_videos_v1.sql.
-- Raise the per-file Bebo Videos limit to 40 MiB for phone videos while
-- reducing the sitewide pilot cap to 15 clips (~600 MiB maximum total).
-- Original file 35,507,185 bytes, 10.944 s, MP4 HEVC: accepted under new cap.
ALTER TABLE public.bebo_videos DROP CONSTRAINT bebo_videos_size_bytes_check;
ALTER TABLE public.bebo_videos ADD CONSTRAINT bebo_videos_size_bytes_check CHECK (size_bytes BETWEEN 1 AND 41943040);
UPDATE storage.buckets SET file_size_limit=41943040 WHERE id='bebo-videos';

CREATE OR REPLACE FUNCTION bebo_private.guard_video_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare user_id uuid; n integer;
begin
  if TG_OP='INSERT' then
    user_id:=auth.uid();
    if user_id is null or new.owner_id<>user_id then raise exception 'Sign in to upload videos';end if;
    if new.object_path<>new.owner_id::text||'/'||new.id::text||
         (case when new.content_type='video/mp4' then '.mp4' else '.webm' end)
    then raise exception 'Invalid video file path';end if;
    if new.status<>'pending' or new.reviewed_at is not null or new.reviewed_by is not null
    then raise exception 'Uploaded videos require approval';end if;
    if exists(select 1 from public.bebo_member_controls
      where member_id=user_id and status='suspended')
    then raise exception 'Your account cannot upload videos';end if;
    perform 1 from public.bebo_profiles where id=user_id for update;
    select count(*) into n from public.bebo_videos where owner_id=user_id;
    if n>=3 then raise exception 'Each member can keep up to 3 videos';end if;
    select count(*) into n from public.bebo_videos;
    if n>=15 then raise exception 'Bebo Videos pilot storage is full';end if;
    select count(*) into n from public.bebo_videos
      where owner_id=user_id and created_at>now()-interval '1 hour';
    if n>=2 then raise exception 'Upload limit: 2 videos per hour';end if;
    new.created_at:=now();
    return new;
  elsif TG_OP='UPDATE' then
    if not (select bebo_private.is_video_moderator()) then raise exception 'Moderator only';end if;
    if (new.id,new.owner_id,new.object_path,new.title,new.caption,new.content_type,new.size_bytes,
        new.duration_seconds,new.created_at)
       is distinct from
       (old.id,old.owner_id,old.object_path,old.title,old.caption,old.content_type,old.size_bytes,
        old.duration_seconds,old.created_at)
    then raise exception 'Video identity/content cannot be changed';end if;
    if new.status not in ('approved','rejected') then raise exception 'Invalid review state';end if;
    if new.status='approved' and not exists(select 1 from storage.objects
      where bucket_id='bebo-videos' and name=new.object_path)
    then raise exception 'Video upload is missing from Storage';end if;
    new.reviewed_by:=auth.uid();
    new.reviewed_at:=now();
    return new;
  end if;
  return new;
end $function$
;

