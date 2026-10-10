// Offline suggestion-inbox verification. Synthetic accounts only: never writes to live Bebo.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../suggestions.js',import.meta.url),'utf8');
const {createSuggestions,validateSuggestion}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(code));
const owner='11111111-1111-4111-8111-111111111111';
const author='22222222-2222-4222-8222-222222222222';
const sample='33333333-3333-4333-8333-333333333333';
const malicious='<img src=x onerror=alert(1)>';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const panel=(t,body)=>'<section class="panel"><h2>'+esc(t)+'</h2>'+body+'</section>';
const valid=new FormData();
valid.set('category','feature');valid.set('title','Make profiles better');
valid.set('details','Please add a new feature for friends so that Bebo is more fun!');
assert.equal(validateSuggestion(valid).category,'feature');
assert.throws(()=>validateSuggestion(new FormData()),/category/,'Empty form rejected');
valid.set('category','<script>alert(1)</script>');
assert.throws(()=>validateSuggestion(valid),/category/,'Unknown category rejected');
valid.set('category','feature');valid.set('title','short');
assert.throws(()=>validateSuggestion(valid),/title/,'Short titles rejected');
valid.set('title','Make profiles better');valid.set('details','short');
assert.throws(()=>validateSuggestion(valid),/20 characters/,'Short descriptions rejected');
valid.set('details','Please add profile backgrounds and more colours.');

const db=[];
let activeUser=null;
const sb={from(table){
 assert(['bebo_suggestions','bebo_profiles'].includes(table));
 const q={table,op:'select',filters:[],max:999,rows:null,head:false,updateData:null,
   select(_cols,opt){if(opt?.head)this.head=true;return this},
   eq(key,value){this.filters.push(r=>r[key]===value);return this},
   in(key,values){this.filters.push(r=>values.includes(r[key]));return this},
   order(){return this},
   limit(n){this.max=n;return this},
   insert(data){this.op='insert';this.updateData=data;return this},
   update(data){this.op='update';this.updateData=data;return this},
   single(){this.one=true;return this},
   maybeSingle(){this.one=true;return this},
   then(done,fail){
     try{
       if(this.table==='bebo_profiles')return Promise.resolve(done({
         data:activeUser===owner?[{id:author,display_name:'Member',username:'member'}]:[],error:null}));
       if(this.op==='insert'){
         assert.equal(activeUser,author,'Only mock signed-in member may insert');
         const row={...this.updateData,id:sample,status:'new',priority:'normal',admin_note:'',
           created_at:'2026-10-10T09:00:00Z',updated_at:'2026-10-10T09:00:00Z'};
         db.push(row);return Promise.resolve(done({data:this.one?{id:sample}:[row],error:null}));
       }
       if(this.op==='update'){
         assert.equal(activeUser,owner,'Only mock owner may review');
         const row=db.filter(r=>this.filters.every(fn=>fn(r)))[0];
         if(row)Object.assign(row,this.updateData);
         return Promise.resolve(done({data:row?{id:row.id,status:row.status}:null,error:null}));
       }
       const candidates=db.filter(r=>this.filters.every(fn=>fn(r)));
       const filtered=candidates.filter(r=>activeUser===owner||r.author_id===activeUser);
       return Promise.resolve(done({data:this.head?null:filtered.slice(0,this.max),
         count:filtered.length,error:null}));
     }catch(err){return Promise.reject(err).then(done,fail)}
   }
 };
 return q;
}};
const app=createSuggestions(sb,{safe:esc,panel});
let html=await app.page(null,null);
assert(html.includes('sign in or join Bebo'),'Guests must see login prompt');
assert(!html.includes('data-form="suggestion"'),'Guests cannot submit');
activeUser=author;
html=await app.page({id:author},{id:author});
assert(html.includes('data-form="suggestion"'),'Signed-in member should see form');
assert(html.includes('name="category"')&&html.includes('name="details"'),'Category and details inputs missing');
assert.equal(await app.submit(valid,{id:author},{id:author}),'Thanks! Your suggestion was sent privately to the Bebo admin panel ♥');
assert.equal(db.length,1,'Suggestion stored once');
db[0].title=malicious;db[0].details=malicious;db[0].admin_note=malicious;
html=await app.page({id:author},{id:author});
assert(html.includes('&lt;img'),'Member detail escaped');
assert(!html.includes(malicious),'Member detail must not inject HTML');
activeUser=owner;
const ownerPanel=await app.ownerPage();
assert(ownerPanel.includes('1 new'),'Admin new count must appear');
assert(ownerPanel.includes('data-form="admin-suggestion-review"'),'Owner review form missing');
assert(ownerPanel.includes('Member'),'Member author lookup missing');
assert(!ownerPanel.includes(malicious),'Malicious suggestion must be escaped in owner inbox');
const review=new FormData();
review.set('id',sample);review.set('status','planned');review.set('priority','high');
review.set('admin_note','Great idea! We are considering this.');
const result=await app.ownerReview(review);
assert(result.message.includes('Planned'),'Owner must be able to mark planned');
assert.equal(db[0].status,'planned');assert.equal(db[0].priority,'high');
assert.throws(()=>app.setFilter('invalid'),/Unknown suggestion filter/);
app.setFilter('planned');html=await app.ownerPage();
assert(html.includes('Make profiles better')===false,'Previous overwritten title should not appear');
assert(html.includes('Great idea!'),'Owner note must be visible on owner panel');
activeUser=author;
html=await app.page({id:author},{id:author});
assert(html.includes('Great idea!'),'Author can read owner response');
assert(html.includes('Planned'),'Author sees updated status');
const main=readFileSync(new URL('../social.js',import.meta.url),'utf8');
const admin=readFileSync(new URL('../admin-advanced.js',import.meta.url),'utf8');
const landing=readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert(main.includes("if(page==='suggestions')"),'Suggestions route must be wired');
assert(main.includes("type==='suggestion'"),'Submission handler must be wired');
assert(admin.includes("['suggestions','💡 Suggestions']"),'Admin panel suggestion tab missing');
assert(admin.includes("type==='admin-suggestion-review'"),'Admin review handler missing');
assert(landing.includes('data-nav="suggestions"'),'Public navigation link missing');
console.log('PASS Bebo Suggestions: private login form, validation, ownership, admin inbox, statuses, response, XSS escaping');
