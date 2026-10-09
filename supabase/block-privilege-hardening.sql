-- Harden the block list: ordinary visitors must not query block data.
revoke all privileges on public.bebo_blocks from public,anon;
grant select,insert,delete on public.bebo_blocks to authenticated;
-- Only a logged-in blocker can read their own rows, enforced by existing RLS.
