// Synthetic notification checks. No real accounts, emails, push or database writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBeboNotifications} from '../notifications.js';
const sql=readFileSync(new URL('../supabase/bebo_notifications_v1.sql',import.meta.url),'utf8');
const social=readFileSync(new URL('../social.js',import.meta.url),'utf8');
const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const admin=readFileSync(new URL('../admin-advanced.js',import.meta.url),'utf8');
const uid='11111111-1111-4111-8111-111111111111';
const stranger='22222222-2222-4222-8222-222222222222';
const sample=[{id:4,kind:'message',title:'New message',body:'Someone sent Bebo Mail',target_path:'#/messages',recipient_id:uid,created_at:'2026-10-11T01:00:00Z',read_at:null},
 {id:3,kind:'wall_comment',title:'Wall comment',body:'Someone posted on your page',target_path:'#/u/Bubbles',recipient_id:uid,created_at:'2026-10-11T00:00:00Z',read_at:null}];
const nav={hidden:true,setAttribute(k,v){this[k]=v}};
const count={hidden:true,textContent:''};
globalThis.document={hidden:false,querySelector(s){return s==='#bebo-notification-nav'?nav:s==='#bebo-notification-count'?count:null},addEventListener(){}};
globalThis.window={addEventListener(){},focus(){}};
globalThis.location={hash:'#/notifications'};
const calls=[];
const sb={from(table){
 assert.equal(table,'bebo_notifications');
 let operation='',member='',id=null,condition=null;
 const q={
  select(){operation='select';return q},
  update(v){operation='update';condition=v;return q},
  eq(k,v){if(k==='recipient_id')member=v; if(k==='id')id=v;return q},
  order(){return q},
  is(){return Promise.resolve({error:null,data:sample.filter(x=>x.recipient_id===member)})},
  limit(){
   assert.equal(member,uid,'All reads scoped to signed in user');
   return Promise.resolve({data:sample.filter(x=>x.recipient_id===member),error:null});
  }
 };
 const originalEq=q.eq;
 q.eq=function(k,v){originalEq(k,v);return q};
 const originalIs=q.is;
 q.is=function(){calls.push({operation,member,id,condition});if(condition){
   sample.forEach(n=>{if(n.recipient_id===member && (id===null||n.id===Number(id)))n.read_at=condition.read_at});
 }return originalIs()};
 return q;
}};
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nt=createBeboNotifications(sb,{safe,panel:(title,html)=>'<section>'+title+html+'</section>'});
nt.start(uid);
await new Promise(r=>setImmediate(r));
const html=nt.page();
assert.match(html,/My Bebo Notifications/);
assert.match(html,/New message/);
assert.match(html,/Wall comment/);
assert.match(html,/Mark all read/);
assert.equal(nav.hidden,false,'bell visible for signed-in users');
assert.equal(count.textContent,'2');
assert.equal(count.hidden,false);
await nt.action('notice-read','4');
assert.equal(sample[0].read_at!==null,true);
assert.equal(count.textContent,'1');
await nt.action('notice-read-all');
assert.equal(count.hidden,true);
assert.equal(sample[1].read_at!==null,true);
nt.start(null);
assert.equal(nav.hidden,true,'bell hidden on logout');
assert.equal(count.hidden,true);
for(const trigger of ['mail','wall','friends','luv','whiteboard','blogs','videos','verified','suggestions','announcement'])
 assert(sql.includes('bebo_notify_'+trigger),trigger+' should have server-side trigger');
assert.match(sql,/revoke all on public\.bebo_notifications from public,anon,authenticated/);
assert.match(sql,/grant select on public\.bebo_notifications to authenticated/);
assert.match(sql,/grant update\(read_at\) on public\.bebo_notifications to authenticated/);
assert.match(sql,/recipient_id=\(select auth\.uid\(\)\)/);
assert.match(sql,/b\.blocker_id=actor/);
assert.match(sql,/from auth\.users u/,'published maintenance/news reaches accounts without a profile');
assert.match(sql,/new\.published and \(tg_op='INSERT' or not old\.published\)/);
assert.match(social,/createBeboNotifications/);
assert.match(social,/page==='notifications'/);
assert.match(page,/id="bebo-notification-nav"/);
assert.match(page,/social\.js\?v=20261011-notifications-v1/);
assert.match(admin,/planned maintenance, outages and service restoration/);
const mailBranch=sql.slice(sql.indexOf("tg_table_name='bebo_mail'"),sql.indexOf("elsif tg_table_name='bebo_wall_posts'"));
assert(!mailBranch.includes('new.body'), 'never copy private message text into notifications');
assert.equal(calls.length,2,'read one and all should update only recipient rows');
console.log('PASS Bebo notifications: private inbox, unread counter, read updates, 10 event hooks, maintenance broadcasts, no message previews or client insert permissions');
