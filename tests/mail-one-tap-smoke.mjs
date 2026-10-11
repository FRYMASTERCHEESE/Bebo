// Synthetic Bebo one-tap profile messaging contract tests.
// Nothing is sent to a real account or database.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createClassic} from '../classic-modules.js';
const sender='11111111-1111-4111-8111-111111111111';
const recipient='22222222-2222-4222-8222-222222222222';
const profiles=[
 {id:sender,username:'Sender_User',display_name:'Sender'},
 {id:recipient,username:'Bubbles.Rose-7',display_name:'Bubbles <3'}
];
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const writes=[];
const db=async(table,build)=>{
 let constraints=[],onlyOne=false,resultInsert=null;
 const q={
  select(){return q},
  eq(k,v){constraints.push(p=>p[k]===v);return q},
  ilike(k,v){const target=String(v).replaceAll('\\%','%').replaceAll('\\_','_');
   constraints.push(p=>String(p[k]).toLowerCase()===target.toLowerCase());return q},
  in(k,v){constraints.push(p=>v.includes(p[k]));return q},
  order(){return q},limit(){return q},maybeSingle(){onlyOne=true;return q},
  insert(row){resultInsert=row;return q}
 };
 build(q);
 if(resultInsert){writes.push({table,row:resultInsert});return null}
 const data=table==='bebo_profiles'?profiles:[];
 const matched=data.filter(x=>constraints.every(ok=>ok(x)));
 return onlyOne?matched[0]||null:matched;
};
const app=createClassic({storage:{}},{
 safe,panel:(heading,body)=>'<section><h2>'+safe(heading)+'</h2>'+body+'</section>',
 btn:(caption,action,id)=>'<button data-action="'+safe(action)+'" data-id="'+safe(id)+'">'+safe(caption)+'</button>',
 query:db
});
const messageTo=await app.route('messages/to/'+recipient,{id:sender});
assert.match(messageTo,/To: Bubbles &lt;3/,'profile display name must be safely escaped');
assert.match(messageTo,/name="recipient_id" value="22222222-2222-4222-8222-222222222222"/);
assert.doesNotMatch(messageTo,/name="recipient" /,'profile recipient should not be typed manually');
assert.match(messageTo,/Write to another member/);
assert(!messageTo.includes('Bubbles <3'),'untrusted display name should never be injected raw');
let form=new FormData();
form.set('recipient_id',recipient);
form.set('subject','heyyy ♥');
form.set('body','Hi Bubbles!');
assert.match(await app.form('classic-mail',form,{me:{id:sender}}),/sent/);
assert.equal(writes.length,1);
assert.equal(writes[0].row.recipient_id,recipient,'send by pinned account ID');
assert.equal(writes[0].row.sender_id,sender);
const manual=await app.route('messages',{id:sender});
assert.match(manual,/pattern="\[A-Za-z0-9_.-\]\{3,25\}"/,'manual mail supports uppercase and punctuation');
form=new FormData();form.set('recipient','Bubbles.Rose-7');form.set('subject','Hello');form.set('body','A manual note');
assert.match(await app.form('classic-mail',form,{me:{id:sender}}),/sent/);
assert.equal(writes.at(-1).row.recipient_id,recipient);
const legacy=await app.route('messages/Bubbles.Rose-7',{id:sender});
assert.match(legacy,/name="recipient_id"/,'old username deep links must still preselect');
await assert.rejects(()=>app.route('messages/to/not-a-valid-id',{id:sender}),/Invalid/);
await assert.rejects(()=>app.route('messages/to/'+sender,{id:sender}),/another member/);
form=new FormData();form.set('recipient_id','not-a-uuid');form.set('subject','x');form.set('body','y');
await assert.rejects(()=>app.form('classic-mail',form,{me:{id:sender}}),/Invalid/);
form=new FormData();form.set('recipient_id',sender);form.set('subject','x');form.set('body','y');
await assert.rejects(()=>app.form('classic-mail',form,{me:{id:sender}}),/another member/);
globalThis.location={hash:''};
await app.action('classic-message-to',recipient,{me:{id:sender}});
assert.equal(globalThis.location.hash,'#/messages/to/'+recipient);
const source=readFileSync(new URL('../social.js',import.meta.url),'utf8');
assert(source.includes("href=\"#/messages/to/'+encodeURIComponent(who.id)"),'profile Mail link must use stable account ID');
assert(source.includes("classic-modules.js?v=20261011-profile-mail-fix-v1"),'classic module needs cache refresh');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert(/social\.js\?v=20261011-(?:profile-mail-fix|notifications)-v1/.test(index),'browser must load updated JS');
console.log('PASS: 16 synthetic one-tap mail checks, valid dotted/uppercase username fallback and safe recipient identity');
