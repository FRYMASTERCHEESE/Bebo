// Safe Bebo member-created text moderation tests. All records and users are synthetic.
import assert from 'node:assert/strict';
import {createClassic} from '../classic-modules.js';
const uid='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const blog='33333333-3333-4333-8333-333333333333';
const comment='44444444-4444-4444-8444-444444444444';
const group='55555555-5555-4555-8555-555555555555';
const records={
 bebo_profiles:[{id:uid,username:'original_author',display_name:'Author'},{id:other,username:'reader',display_name:'Reader'}],
 bebo_blogs:[{id:blog,owner_id:uid,title:'My honest blog',body:'My original written memories.',
  is_hidden:false,created_at:'2026-10-10T05:00:00Z'}],
 bebo_blog_comments:[{id:comment,blog_id:blog,author_id:uid,body:'A good point',is_hidden:false,created_at:'2026-10-10T05:05:00Z'}],
 bebo_groups:[{id:group,owner_id:uid,name:'Classic mates',description:'Our social club',
  is_hidden:false,created_at:'2026-10-10T05:07:00Z'}],
 bebo_group_members:[]
};
let viewer=null;const reports=[];
const query=async(table,fn)=>{
 const filters=[];let single=false;let orderKey='';let descending=false;let max=100;
 const q={
 select(){return q},eq(k,v){filters.push(row=>row[k]===v);return q},
 in(k,a){filters.push(row=>a.includes(row[k]));return q},
 order(k,opts){orderKey=k;descending=opts?.ascending===false;return q},
 limit(n){max=n;return q},maybeSingle(){single=true;return q},
 insert(v){reports.push({table,payload:v});return q}
 };
 await fn(q);
 if(table==='bebo_content_reports')return null;
 let rows=(records[table]||[]).filter(x=>filters.every(f=>f(x)));
 if(['bebo_blogs','bebo_blog_comments','bebo_groups'].includes(table))
  rows=rows.filter(x=>!x.is_hidden||viewer===x.owner_id||viewer===uid && table==='bebo_blog_comments');
 if(orderKey)rows.sort((a,b)=>String(a[orderKey]).localeCompare(String(b[orderKey]))*(descending?-1:1));
 rows=rows.slice(0,max);return single?rows[0]??null:rows;
};
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const b=createClassic({storage:{}},{
 safe,panel:(name,html)=>'<section><h2>'+name+'</h2>'+html+'</section>',
 btn:(name,action,id)=>'<button data-action="'+safe(action)+'" data-id="'+safe(id)+'">'+name+'</button>',query
});
viewer=null;
let html=await b.route('blog/'+blog,null);
assert(html.includes('My honest blog'),'Public original blog should be readable');
assert(!html.includes('classic-report-content'),'Guests cannot submit reports');
viewer=other;
html=await b.route('blog/'+blog,{id:other});
assert(html.includes('classic-report-content'),'Signed-in visitor can report blog or comment');
html=await b.route('groups',{id:other});
assert(html.includes('classic-report-content'),'Signed-in visitor can report group');
globalThis.prompt=()=> 'This public post appears to violate the community rules';
for(const [kind,id] of [['blog',blog],['blog_comment',comment],['group',group]]){
 await b.action('classic-report-content',kind+':'+id,{me:{id:other}});
}
assert.deepEqual(reports.map(x=>x.payload.content_kind),['blog','blog_comment','group']);
assert(reports.every(x=>x.table==='bebo_content_reports'&&x.payload.reporter_id===other));
for(const [kind,id] of [['blog',blog],['group',group]])records[kind==='blog'?'bebo_blogs':'bebo_groups'][0].is_hidden=true;
records.bebo_blog_comments[0].is_hidden=true;
viewer=null;
assert(!(await b.route('blog/'+blog,null)).includes('My original written memories.'),'Hidden blogs must not render to guests');
assert(!(await b.route('groups',null)).includes('Classic mates'),'Hidden group must not render to guests');
viewer=uid;
assert((await b.route('blog/'+blog,{id:uid})).includes('hidden from the public'),
  'Owner should be informed of hidden blog');
console.log('SUMMARY 5/5 synthetic social-content reporting and hide tests passed; no real member data changed');
