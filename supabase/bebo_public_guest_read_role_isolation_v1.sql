-- Applied to dedicated Bebo project; review before reapplying.
-- Permit guest read of published announcements/visible skins without exposing private role helper.
drop policy if exists "bebo public announcements" on public.bebo_announcements;
drop policy if exists "bebo guest published announcements" on public.bebo_announcements;
create policy "bebo guest published announcements" on public.bebo_announcements
 for select to anon using(published);
drop policy if exists "bebo member announcements" on public.bebo_announcements;
create policy "bebo member announcements" on public.bebo_announcements
 for select to authenticated using(published or (select bebo_private.is_bebo_owner()));
drop policy if exists "bebo visible or owned skins" on public.bebo_skins;
drop policy if exists "bebo guest visible skins" on public.bebo_skins;
create policy "bebo guest visible skins" on public.bebo_skins for select to anon using(not is_hidden);
drop policy if exists "bebo member visible or owned skins" on public.bebo_skins;
create policy "bebo member visible or owned skins" on public.bebo_skins
 for select to authenticated using(not is_hidden or creator_id=(select auth.uid()) or (select bebo_private.is_bebo_owner()));
