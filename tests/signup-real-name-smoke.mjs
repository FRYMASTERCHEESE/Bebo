// Bebo signup-name privacy contract (no real user accounts created).
// Run with: node tests/signup-real-name-smoke.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const social=read('social.js'), admin=read('admin-advanced.js'), schema=read('supabase/bebo_private_signup_names_v1.sql');
const policy=read('privacy.html'), page=read('index.html');
assert.match(social,/name="real_name"[^>]*required[^>]*maxlength="100"/,'signup real name must be required');
assert.match(social,/autocomplete="name"/,'use standard accessible real-name autofill');
assert.match(social,/data:\{bebo_real_name:realName\}/,'signup should include name as Supabase Auth metadata');
assert.match(social,/realName\.length<2\|\|realName\.length>100/,'reject bad names before signup');
assert.match(admin,/sb\.rpc\('bebo_admin_signup_directory'\)/,'private names should be queried via protected RPC');
assert.match(admin,/safe\(namesByID\.get\(p\.id\)/,'private names should be escaped before displaying in admin');
assert.match(admin,/Profile not created yet/,'list signups before choosing a profile');
assert.match(schema,/references auth\.users\(id\) on delete cascade/,'member deletion should remove private name records');
assert.match(schema,/alter table bebo_private\.bebo_signup_names enable row level security/);
assert.match(schema,/revoke all on bebo_private\.bebo_signup_names from public, anon, authenticated/);
assert.match(schema,/where \(select bebo_private\.is_bebo_owner\(\)\)/,'only the owner may use the directory');
assert.match(schema,/revoke all on function public\.bebo_admin_signup_directory\(\) from public, anon, authenticated/);
assert.match(schema,/grant execute on function public\.bebo_admin_signup_directory\(\) to authenticated/);
assert.match(schema,/create trigger bebo_store_signup_name after insert on auth\.users/);
assert.match(policy,/self-reported real name/,'privacy must disclose requested real names');
assert.match(policy,/not shown on public profiles/,'privacy must distinguish real vs display names');
assert.match(page,/social\.js\?v=20261012-private-album-v1/,'live browsers need fresh signup code');
assert.doesNotMatch(social,/(?:select\(|insert\()\s*['"](?:bebo_signup_names|auth\.users)/,'no client-side query of private names');
console.log('PASS 17/17: real-name signup data, owner-only directory, privacy and existing profile separation');
