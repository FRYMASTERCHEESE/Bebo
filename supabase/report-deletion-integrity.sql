-- Preserve report referential integrity during user-requested account deletion.
-- Reports about deleted members or deleted posts are removed, never left with both target IDs null.
alter table public.bebo_reports
 drop constraint if exists bebo_reports_reported_profile_id_fkey,
 drop constraint if exists bebo_reports_reported_post_id_fkey;
alter table public.bebo_reports
 add constraint bebo_reports_reported_profile_id_fkey
 foreign key(reported_profile_id) references public.bebo_profiles(id) on delete cascade,
 add constraint bebo_reports_reported_post_id_fkey
 foreign key(reported_post_id) references public.bebo_wall_posts(id) on delete cascade;