-- Report intake hardening, applied to the dedicated Bebo Supabase project.
create or replace function bebo_private.normalise_bebo_report()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.status:='open';
 new.reviewed_at:=null;
 new.reviewed_by:=null;
 new.created_at:=now();
 return new;
end $$;
revoke all on function bebo_private.normalise_bebo_report() from public,anon,authenticated;
drop trigger if exists bebo_report_open_on_insert on public.bebo_reports;
create trigger bebo_report_open_on_insert before insert on public.bebo_reports
for each row execute function bebo_private.normalise_bebo_report();
