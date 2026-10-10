// Safe Bebo Verified test: no network calls, no live accounts changed.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../verified.js',import.meta.url),'utf8');
const {createVerification}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(code));
const owner='11111111-1111-4111-8111-111111111111';
const member='22222222-2222-4222-8222-222222222222';
const records={
  bebo_verified_profiles:[{user_id:member}],
  bebo_verification_requests:[{user_id:owner,status:'pending',requested_at:'2026-10-10T00:00:00Z'}]
};
const query=async(table,fn)=>{
 const options={single:false,filter:[]};
 const q={
   select(){return q},
   eq(c,v){options.filter.push(x=>x[c]===v);return q},
   in(c,ids){options.filter.push(x=>ids.includes(x[c]));return q},
   maybeSingle(){options.single=true;return q},
   insert(payload){records[table].push(payload);return q}
 };
 const chosen=await fn(q);
 assert.equal(chosen,q,'Expected a query builder');
 const rows=(records[table]||[]).filter(x=>options.filter.every(f=>f(x)));
 return options.single?(rows[0]||null):rows;
};
const safe=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const panel=(title,html)=>'<section><h2>'+title+'</h2>'+html+'</section>';
const verified=createVerification({},{safe,panel,query});
const approved=await verified.approved([owner,member]);
assert(!approved.has(owner),'A nonverified member gained a badge');
assert(approved.has(member),'An approved member lost their badge');
assert(verified.badge({id:member},approved).includes('Bebo Verified'),'Approved member has no badge');
assert.equal(verified.badge({id:owner},approved),'','Unapproved user was marked verified');
const people=verified.prioritizePeople([{id:owner},{id:member}],approved);
assert.equal(people[0].id,member,'Verified first boost missing');
const now=Date.now();
const activity=verified.prioritizeActivity([
 {id:'recent',owner_id:owner,date:new Date(now).toISOString()},
 {id:'verified',owner_id:member,date:new Date(now-3600000).toISOString()}
],approved);
assert.equal(activity[0].id,'verified','Verified content not boosted');
assert((await verified.requestPanel({id:owner})).includes('pending'),'Pending request not shown');
assert((await verified.requestPanel({id:member})).includes('already approved') ||
 (await verified.requestPanel({id:member})).includes('has been approved'),'Verified member view missing');
console.log('PASS: badge safety, approved discovery boost, recent activity boost, request status and self-service view');
