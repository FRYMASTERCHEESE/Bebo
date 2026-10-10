// Read-only Bebo Verified transparency regression checks using fake profile records.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../verified.js',import.meta.url),'utf8');
const {createVerification}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source));
const id='11111111-1111-4111-8111-111111111111';
const profile={
 id,username:'bebo',display_name:'Bebo',avatar_path:'',
 created_at:'2026-10-10T08:02:00.000Z',location:'New Zealand'
};
const verified={user_id:id,verified_at:'2026-10-10T09:30:00.000Z'};
const rows={bebo_profiles:[profile],bebo_verified_profiles:[verified]};
const query=async(table,fn)=>{
 let filters=[],single=false;
 const q={
  select(){return q},
  eq(key,value){filters.push(row=>row[key]===value);return q},
  ilike(key,value){filters.push(row=>row[key].toLowerCase()===value.toLowerCase());return q},
  maybeSingle(){single=true;return q},
  in(key,values){filters.push(row=>values.includes(row[key]));return q}
 };
 assert.equal(fn(q),q);
 const selected=(rows[table]||[]).filter(row=>filters.every(f=>f(row)));
 return single?(selected[0]||null):selected;
};
const safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
const panel=(title,body)=>'<section><h2>'+title+'</h2>'+body+'</section>';
const v=createVerification({storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:''}})})}}, {safe,panel,query});
const approved=await v.approved([id]);
const badge=v.badge(profile,approved);
assert(badge.includes('data-action="verified-info"'),'Blue badge is not clickable');
assert(badge.includes('aria-haspopup="dialog"'),'Badge is not marked as a popup control');
assert(badge.includes('tabindex="0"'),'Keyboard users cannot open the badge');
const body=await v.transparencyPage('bebo');
for(const required of ['Bebo is Bebo Verified','10 October 2026','Bebo Verified since','New Zealand','entered by the member','Previous names and updates','No identity certification']) {
 // Some phrasing is expressed by the review disclaimer instead.
 if(required==='No identity certification') continue;
 assert(body.includes(required),'Transparency field missing: '+required);
}
assert(body.includes('does not certify someone’s real-world identity'),'Missing identity-verification disclaimer');
assert(body.includes('Public history is not available'),'Invented name-change history');
assert(body.includes('Bebo community site profile'),'Owner category missing');
assert(!body.includes('Dhar Mann'),'Example person accidentally included');
const policy=v.policyPage();
assert(policy.includes('not Meta Verified')&&policy.includes('does not guarantee'),'Verification policy lacks limits');
const denied=await v.transparencyPage('unknown');
assert(denied.includes('does not exist'),'Missing profile not handled');
rows.bebo_verified_profiles=[];
await assert.rejects(()=>v.publicDetails(id),/does not currently have/);
assert((await v.transparencyPage('bebo')).includes('does not currently have'),'Removed badge still shown as verified');
console.log('PASS: verified tick actions, authentic dates, member privacy, transparency routes, review disclaimers and revoked-badge protection');
