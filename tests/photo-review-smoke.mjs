// Bebo photo moderation integration smoke with synthetic records only.
// No account signups, database modifications, uploads or real photo files.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createClassic} from '../classic-modules.js';

const owner='11111111-1111-4111-8111-111111111111';
const another='22222222-2222-4222-8222-222222222222';
const album='33333333-3333-4333-8333-333333333333';
const approved='44444444-4444-4444-8444-444444444444';
const pending='55555555-5555-4555-8555-555555555555';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const albums=[{id:album,owner_id:owner,title:'Our pictures',description:'Happy days',
 created_at:'2026-10-10T10:00:00Z'}];
const people=[{id:owner,username:'first',display_name:'First Person'}];
const photos=[
 {id:approved,album_id:album,owner_id:owner,object_path:owner+'/'+approved+'.png',
 caption:'Welcome <script>alert(1)</script>',moderation_status:'approved',created_at:'2026-10-10T12:00:00Z'},
 {id:pending,album_id:album,owner_id:owner,object_path:owner+'/'+pending+'.png',
 caption:'Unreviewed personal photo',moderation_status:'pending',created_at:'2026-10-10T12:05:00Z'}
];
let viewer=null;const reports=[];
const query=async(table,fn)=>{
 const tests=[];let single=false,orderKey='',desc=false,limit=1000,insert=null;
 const q={
  select(){return q},eq(k,v){tests.push(x=>x[k]===v);return q},
  order(k,opt){orderKey=k;desc=opt?.ascending===false;return q},
  limit(n){limit=n;return q},maybeSingle(){single=true;return q},
  insert(row){insert=row;return q}
 };
 const made=fn(q);
 assert.equal(made,q,'Unexpected query chain in '+table);
 if(insert){
  assert.equal(table,'bebo_photo_reports','Unexpected writing table');
  reports.push(insert);
  return null;
 }
 let dataset=table==='bebo_albums'?albums:table==='bebo_profiles'?people:
  table==='bebo_photos'?photos:[];
 if(table==='bebo_photos')
  dataset=dataset.filter(x=>x.moderation_status==='approved'||x.owner_id===viewer);
 let rows=dataset.filter(row=>tests.every(ok=>ok(row)));
 if(orderKey)rows=[...rows].sort((a,b)=>
  String(a[orderKey]).localeCompare(String(b[orderKey]))*(desc?-1:1));
 rows=rows.slice(0,limit);
 return single?rows[0]??null:rows;
};
const sb={storage:{from(bucket){
 assert.equal(bucket,'bebo-photos');
 return {getPublicUrl(path){return {data:{publicUrl:'https://example.invalid/objects/'+encodeURIComponent(path)}}}};
}}};
const classic=createClassic(sb,{safe:esc,panel:(title,body)=>'<section><h2>'+title+'</h2>'+body+'</section>',
 btn:(label,action,id)=>'<button data-action="'+esc(action)+'" data-id="'+esc(id)+'">'+label+'</button>',query});
viewer=null;
const guest=await classic.route('album/'+album,null);
assert(guest.includes('Welcome &lt;script&gt;alert(1)&lt;/script&gt;'),'Photo captions must be safely escaped');
assert(!guest.includes('Unreviewed personal photo'),'Guest must not discover pending photos');
assert(!guest.includes('classic-report-photo'),'Guests cannot file photo reports');
viewer=owner;
const mine=await classic.route('album/'+album,{id:owner});
assert(mine.includes('Unreviewed personal photo'),'Uploader should see own pending photo');
assert(mine.includes('Awaiting moderator approval'),'Uploader should understand the review state');
assert(!mine.includes('classic-report-photo'),'Owner must not report own pictures');
viewer=another;
const visitor=await classic.route('album/'+album,{id:another});
assert(!visitor.includes('Unreviewed personal photo'),'Other members must not see pending photos');
assert(visitor.includes('classic-report-photo'),'Member must be able to report an approved photo');
globalThis.prompt=()=> 'Photo appears to breach the community safety rules';
await classic.action('classic-report-photo',approved,{me:{id:another}});
assert.equal(reports.length,1);
assert.equal(reports[0].photo_id,approved);
assert.equal(reports[0].reporter_id,another);
const sql=readFileSync('supabase/bebo_photos_owner_review_reports_20261011.sql','utf8');
const admin=readFileSync('admin.js','utf8');
assert(sql.includes("moderation_status='approved'"),'Anonymous RLS must filter unapproved photos');
assert(sql.includes("moderation_status='pending'"),'Member insert RLS must enforce pending review');
assert(sql.includes('bebo_photo_reports'),'Private photo reporting schema required');
for(const name of ['admin-photo-approve','admin-photo-reject','admin-photo-hide','admin-photo-report-reviewed']){
 assert(admin.includes(name),'Missing authorised moderator photo action: '+name);
}
console.log('SUMMARY 4/4 Bebo synthetic photo review checks passed; no real accounts or media touched');
