// No live account writes: check archived link parsing, public snapshot lookup and restore form.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../old-bebo-memories.js',import.meta.url),'utf8');
const memory=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source));
const {parseOldBeboInput,oldBeboTargets,oldBeboCalendar,searchOldBebo,createBeboMemories}=memory;
assert.deepEqual(parseOldBeboInput('@Old_Mate'),{type:'username',value:'Old_Mate'});
assert.deepEqual(parseOldBeboInput('bebo.com/Old_Mate'),{type:'username',value:'Old_Mate'});
assert.deepEqual(parseOldBeboInput('1584189657'),{type:'memberid',value:'1584189657'});
assert.deepEqual(parseOldBeboInput('http://www.bebo.com/Profile.jsp?MemberId=1584189657'),{type:'memberid',value:'1584189657'});
assert.deepEqual(parseOldBeboInput('https://web.archive.org/web/20070101000000/http://www.bebo.com/Profile.jsp?MemberId=1584189657'),{type:'memberid',value:'1584189657'});
for(const dangerous of ['https://evil.example/user','http://www.bebo.com/Profile.jsp?MemberId=bad','<script>bad</script>','https://web.archive.org/web/2007/http://evil.example/','ftp://bebo.com/member']){
 assert.throws(()=>parseOldBeboInput(dangerous),'Unsafe/invalid URL was accepted: '+dangerous);
}
assert.equal(oldBeboTargets({type:'memberid',value:'12'}).length,3);
assert(oldBeboCalendar('http://www.bebo.com/Old_Mate').startsWith('https://web.archive.org/web/*/'));
const referenceUrl='http://web.archive.org/web/20071018010101/http://www.bebo.com/Profile.jsp?MemberId=1584189657';
const ok=async(url,config)=>{
 assert(url.startsWith('https://archive.org/wayback/available?url='));
 assert.equal(config.credentials,'omit');
 return {ok:true,json:async()=>({archived_snapshots:{closest:{available:true,url:referenceUrl,timestamp:'20071018010101',status:'200'}}})};
};
const found=await searchOldBebo('1584189657',ok);
assert.equal(found.found.length,3);
assert(found.found.every(x=>x.snapshot.url.startsWith('https://web.archive.org/web/')));
assert.equal(found.failed,0);
const no=await searchOldBebo('Old_Mate',async()=>({ok:true,json:async()=>({archived_snapshots:{}})}));
assert.equal(no.found.length,0);
assert.equal(no.failed,0);
const offline=await searchOldBebo('Old_Mate',async()=>{throw Error('Network unavailable')});
assert.equal(offline.failed,3);
const injected=await searchOldBebo('Old_Mate',async()=>({ok:true,json:async()=>({archived_snapshots:{closest:{available:true,url:'https://evil.example/phishing'}}})}));
assert.equal(injected.found.length,0,'Non-Wayback results should never be linked');
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const panel=(heading,inner)=>'<section><h2>'+heading+'</h2>'+inner+'</section>';
const html=createBeboMemories({safe,panel}).page();
assert(html.includes('id="bebo-memory-search"'));
assert(html.includes('Find My Old Bebo Memories'));
assert(!html.includes('data-form="old-bebo-restore"'),'Guest should not see authenticated update form');
const member=createBeboMemories({safe,panel}).page({me:{id:'owner'},profile:{id:'owner'}});
assert(member.includes('data-form="old-bebo-restore"'));
assert(member.includes('name="own_content"'));
assert(!member.includes('name="password"'));
console.log('PASS: legacy Bebo usernames, numeric MemberId links, public snapshot results, empty/failed searches, URL safety and profile restore privacy');
// Best-effort live public Internet Archive connectivity: network may be rate-limited, non-gating.
try{
 const actual=await fetch('https://archive.org/wayback/available?url='+encodeURIComponent('http://www.bebo.com/Profile.jsp?MemberId=1584189657'),{
  signal:AbortSignal.timeout(8000),headers:{Accept:'application/json'}
 });
 const result=await actual.json();
 const available=Boolean(result?.archived_snapshots?.closest?.available);
 console.log('LIVE ARCHIVE API: HTTP '+actual.status+'; known historic public Bebo example snapshot '+(available?'available':'not confirmed'));
}catch(err){console.log('LIVE ARCHIVE API: temporarily unavailable ('+String(err.message).slice(0,80)+'); independent simulated checks passed');}
