// Safe simulated member-profile regression test. Read-only; no live accounts touched.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const social=await readFile(new URL('../social.js',import.meta.url),'utf8');
const begin=social.indexOf('async function showProfile(username){');
const end=social.indexOf('async function showFriends(){',begin);
assert(begin>=0&&end>begin,'Profile renderer not found');
const rendererSource=social.slice(begin,end);
const id='11111111-1111-4111-8111-111111111111';
const otherID='22222222-2222-4222-8222-222222222222';
const owner={id,username:'bebo',display_name:'Bebo',status:'Welcome back ❤️',bio:'My world'};
const other={id:otherID,username:'opal',display_name:'Opal',status:'Hi'};
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const panel=(t,b)=>'<section class="panel"><h2>'+escape(t)+'</h2>'+b+'</section>';
const makeRenderer=({approved=false,pending=false,visitingOther=false,guest=false}={})=>{
  const app={innerHTML:''};
  const me=guest?null:{id};
  const chosen=visitingOther?other:owner;
  const isApproved=approved;
  const verified={
    approved:async ids=>new Set(isApproved?ids:[]),
    badge:(p,ids)=>ids.has(p.id)?'<span class="bebo-verified-badge">✓</span>':'',
    requestPanel:async ()=>pending?panel('Bebo Verification','<p>Request status: pending</p>'):
      isApproved?panel('Bebo Verified','You are verified!'):
      panel('Request Bebo Verified','<form data-form="verification-request"><textarea name="reason"></textarea></form>')
  };
  const query=async (table,cb)=>{
    const filters=[];const q={
      select:()=>q,ilike(k,v){filters.push(z=>z[k]?.toLowerCase()===v?.toLowerCase());return q},
      eq(k,v){filters.push(z=>z[k]===v);return q},
      neq(k,v){filters.push(z=>z[k]!==v);return q},
      order:()=>q,limit:()=>q,or:()=>q,in:()=>q,
      maybeSingle(){q.single=true;return q}
    };
    const request=cb(q);
    assert.equal(request,q);
    let records=table==='bebo_profiles'?[owner,other]:
      table==='bebo_verification_requests'?(pending?[{user_id:id,status:'pending'}]:[]):[];
    records=records.filter(x=>filters.every(fn=>fn(x)));
    return q.single?records[0]||null:records;
  };
  const helpers={
    me,profile:owner,app,userViewed:null,query,safe:escape,note:()=>'',panel,
    handlePattern:x=>x,verified,safety:{myBlocks:async()=>new Set(),profileTools:async()=>''},
    classic:{publicModules:async()=>''},videos:{profilePanel:async()=>'<section class="panel">🎬 My Bebo Videos</section>'},retro:{sharedPanel:async()=>'',imageStyle:()=> 'linear-gradient(#f0f,#fff)'},
    getSkin:()=>['classic','Classic','#ffdeee','#c33062','#862453','','','♥'],
    grad:()=> 'linear-gradient(#fff,#eaa)',
    badge:()=>'<div class="avatar">B</div>',btn:()=>'<button>Add friend</button>',time:()=>'',userViewed:null
  };
  const fn=new Function('deps','const {me,profile,app,query,safe,note,panel,handlePattern,verified,safety,classic,videos,retro,getSkin,grad,badge,btn,time}=deps;let userViewed=null;'+rendererSource+'\nreturn showProfile;')(helpers);
  return {app,run:()=>fn(visitingOther?'opal':undefined)};
};
const fresh=makeRenderer();
await fresh.run();
const doc=fresh.app.innerHTML;
assert(doc.includes('✎ Edit my profile'),'Edit profile disappeared');
assert(doc.includes('🎬 My Bebo Videos'),'Profile Bebo Videos panel disappeared');
assert(doc.includes('🎨 Change my skin'),'Change my skin disappeared');
assert(doc.includes('✓ Request Bebo Verified'),'Missing verification request next to profile actions');
assert(doc.includes('data-action="verified-profile-toggle"'),'No clickable verification control');
assert(doc.includes('data-form="verification-request"'),'No inline verification application form');
assert(doc.includes('id="bebo-profile-verification"'),'Inline application panel missing');
assert(doc.indexOf('✎ Edit my profile')<doc.indexOf('✓ Request Bebo Verified'),'Wrong action order');
assert(doc.indexOf('✓ Request Bebo Verified')<doc.indexOf('id="bebo-profile-verification"'),'Request form not below profile identity');
assert(doc.includes('id="bebo-profile-verification" class="bebo-profile-verification" hidden'),'Application not initially hidden');

const pending=makeRenderer({pending:true});await pending.run();
assert(pending.app.innerHTML.includes('✓ Verification Pending'),'Pending status missing');
assert(pending.app.innerHTML.includes('Request status: pending'),'Pending request details missing');

const approved=makeRenderer({approved:true});await approved.run();
assert(approved.app.innerHTML.includes('✓ Bebo Verified'),'Approved profile badge missing');
assert(!approved.app.innerHTML.includes('data-action="verified-profile-toggle"'),'Approved member shown request button');

const otherPage=makeRenderer({visitingOther:true});await otherPage.run();
assert(!otherPage.app.innerHTML.includes('id="bebo-profile-verification"'),'Private request exposed on another member profile');
assert(!otherPage.app.innerHTML.includes('✓ Request Bebo Verified'),'Visitors can request verification for someone else');

const drawer={hidden:true,scrollIntoView(){this.scrolled=true}};
const toggle=social.slice(social.indexOf("if(a==='verified-profile-toggle'){"),social.indexOf(" if(a.startsWith('admin-'))",social.indexOf("if(a==='verified-profile-toggle'){")));
assert(toggle.includes("scrollIntoView"),'Toggle does not scroll to the verification form');
const element={attributes:{},setAttribute(k,v){this.attributes[k]=v}};
const click=new Function('a','b','document',toggle);
click('verified-profile-toggle',element,{querySelector:()=>drawer});
assert(!drawer.hidden&&element.attributes['aria-expanded']==='true'&&drawer.scrolled,'Button failed to open request form');
click('verified-profile-toggle',element,{querySelector:()=>drawer});
assert(drawer.hidden&&element.attributes['aria-expanded']==='false','Button failed to close request form');
console.log('PASS: owner profile CTA, inline application, pending status, approved badge, visitor privacy, open and close controls');
