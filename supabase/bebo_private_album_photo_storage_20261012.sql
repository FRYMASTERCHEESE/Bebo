-- Bebo.nz private album media: only approved photos can be signed by guests.
-- Initial inspection: 0 photo records and 0 storage objects. Does not delete files.
-- All member upload limits, folder ownership, metadata moderation and photo reports remain unchanged.
update storage.buckets set public=false where id='bebo-photos';
drop policy if exists "bebo photo public read" on storage.objects;
drop policy if exists "bebo photo signed access" on storage.objects;
create policy "bebo photo signed access" on storage.objects
for select to anon,authenticated
using (
 bucket_id='bebo-photos'
 and exists (
  select 1 from public.bebo_photos p
   where p.object_path = name
     and (
      p.moderation_status='approved'
      or (auth.uid() is not null and (p.owner_id=auth.uid() or bebo_private.is_bebo_moderator()))
     )
 )
);
