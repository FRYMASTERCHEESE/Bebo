// Offline, read-only Bebo Videos V1 smoke tests with synthetic accounts.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../videos.js',import.meta.url),'utf8');
const {createVideos,validateBeboVideoFile,BEBO_VIDEO_MAX_BYTES}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source));
assert.equal(BEBO_VIDEO_MAX_BYTES,41943040,'Expected 40 MiB video limit');
const phoneRecording={name:'VID20261010013838.mp4',size:35507185,type:'video/mp4'};
assert.equal(validateBeboVideoFile(phoneRecording).valid,true,'Original 35.5 MB Android MP4 should fit');
assert.equal(validateBeboVideoFile({...phoneRecording,type:''}).mime,'video/mp4','Empty Android MIME must accept MP4 extension');
assert.equal(validateBeboVideoFile({...phoneRecording,type:'application/octet-stream'}).mime,'video/mp4','Generic Android MIME must accept MP4 extension');
assert.equal(validateBeboVideoFile({...phoneRecording,size:41943040}).valid,true,'40 MiB boundary must pass');
const overLimit=validateBeboVideoFile({...phoneRecording,size:41943041});
assert.equal(overLimit.valid,false,'Oversized videos must be rejected');
assert.match(overLimit.message,/41\.9 MB|40 MiB/,'Size error must explain actual upload limit');
assert.equal(validateBeboVideoFile({...phoneRecording,type:'text/plain'}).valid,false,'Wrong file MIME must not pass');
assert.equal(validateBeboVideoFile({...phoneRecording,name:'f.txt',type:''}).valid,false,'Nonvideo extension must fail');
const uid='11111111-1111-4111-8111-111111111111';
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const profiles=[{id:uid,username:'safe_member',display_name:'Bebo <3'}];
const videos=[
 {id:a,owner_id:uid,object_path:uid+'/'+a+'.mp4',title:'Hello <script>oops</script>',
  caption:'A short day out',status:'approved',content_type:'video/mp4',size_bytes:1024,
  duration_seconds:10,created_at:'2026-10-10T04:15:00Z'},
 {id:b,owner_id:uid,object_path:uid+'/'+b+'.mp4',title:'Private upload',caption:'',
  status:'pending',content_type:'video/mp4',size_bytes:2048,duration_seconds:4,
  created_at:'2026-10-10T04:16:00Z'}
];
const records={bebo_profiles:profiles,bebo_videos:videos,bebo_video_comments:[],bebo_video_reactions:[],bebo_video_reports:[]};
const db=async(table,fn)=>{
 const filters=[];let one=false;let descending=false;let orderKey='';
 let max=10000;
 const q={
  select(){return q},
  eq(k,v){filters.push(row=>row[k]===v);return q},
  neq(k,v){filters.push(row=>row[k]!==v);return q},
  in(k,ids){filters.push(row=>ids.includes(row[k]));return q},
  ilike(k,v){filters.push(row=>row[k]?.toLowerCase()===v?.toLowerCase());return q},
  maybeSingle(){one=true;return q},
  order(k,o){orderKey=k;descending=o?.ascending===false;return q},
  limit(v){max=v;return q}
 };
 const request=fn(q);
 assert.equal(request,q);
 let data=(records[table]||[]).filter(item=>filters.every(check=>check(item)));
 if(orderKey)data=[...data].sort((x,y)=>String(x[orderKey]).localeCompare(String(y[orderKey]))*(descending?-1:1));
 data=data.slice(0,max);
 return one?data[0]||null:data;
};
let signed=0;
const storage={from(name){
 assert.equal(name,'bebo-videos');
 return {async createSignedUrl(path,ttl){
  assert.equal(ttl,600);signed++;
  return {data:{signedUrl:'https://storage.example.test/private/'+encodeURIComponent(path)+'?token=fictional'},error:null};
 }};
}};
const videosApi=createVideos({storage},{safe:esc,panel:(title,body)=>'<section><h2>'+title+'</h2>'+body+'</section>',query:db});
const publicHTML=await videosApi.route('videos',{me:null,profile:null,adminAccess:null});
assert(publicHTML.includes('Hello &lt;script&gt;oops&lt;/script&gt;'),'Member video title must be HTML escaped');
assert(!publicHTML.includes('Private upload'),'Pending video should not appear in public feed');
assert(publicHTML.includes('bebo-video-player'),'Native mobile video player missing');
assert(publicHTML.includes('Sign in to react'),'Guests should not post hearts');
assert(!publicHTML.includes('data-form="video-upload"'),'Guest video upload form must be hidden');
const memberHTML=await videosApi.route('videos',{me:{id:uid},profile:profiles[0],adminAccess:null});
assert(memberHTML.includes('Private upload'),'Uploader should see their pending video');
assert(memberHTML.includes('Awaiting approval'),'Pending video status must be clear');
assert(memberHTML.includes('data-form="video-upload"'),'Signed-in profile must be able to upload');
const guestReview=await videosApi.route('videos-review',{me:null,adminAccess:null});
assert(guestReview.includes('Only an approved Bebo moderator'),'Guest moderation must be denied');
const modReview=await videosApi.route('videos-review',{me:{id:uid},adminAccess:'owner'});
assert(modReview.includes('Private upload')&&modReview.includes('video-approve'),'Owner moderation queue missing');
const profileHTML=await videosApi.profilePanel(profiles[0],{me:null});
assert(profileHTML.includes('videos/u/safe_member'),'Member profile needs video gallery link');
assert(signed>0,'Video signing was not attempted');
console.log('PASS: Bebo Videos 40 MiB Android MP4 validation, MIME fallback, guest feed, signed playback, owner drafts and moderation UI');
