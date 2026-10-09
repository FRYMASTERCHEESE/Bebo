-- Restrict private Bebo mail access at SQL grant layer as well as RLS.
revoke all privileges on public.bebo_mail from public, anon, authenticated;
grant select,insert on public.bebo_mail to authenticated;
-- Other Half requests are only visible to the participants until accepted (RLS).
revoke all privileges on public.bebo_other_halves from public,anon,authenticated;
grant select on public.bebo_other_halves to anon,authenticated;
grant insert,update,delete on public.bebo_other_halves to authenticated;