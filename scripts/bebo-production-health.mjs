// Bebo public production checks. Read-only network requests; no login, secrets or member writes.
// Safe to run daily after announcing the site. Uses only the public browser publishable key.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const origin='https://bebo.nz';
const config=readFileSync('config.js','utf8');
const base=config.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/)?.[1];
const key=config.match(/SUPABASE_PUBLISHABLE_KEY\s*=\s*['"]([^'"]+)['"]/)?.[1];
assert(base?.startsWith('https://')&&key?.startsWith('sb_publishable_'),
  'Public Supabase configuration not found');
const result={passed:0,failed:0};
const report=(label,ok,reason='')=>{
 if(ok){result.passed++;console.log('PASS '+label);}
 else{result.failed++;console.error('FAIL '+label+(reason?': '+reason:''));}
};
async function get(url,opts={}){
 const res=await fetch(url,{...opts,signal:AbortSignal.timeout(18000),redirect:'follow',
  headers:{'accept':'application/json',...opts.headers}});
 // Never log response bodies: private API checks must not expose member data in Actions logs.
 return res;
}
async function safeCheck(label,fn){
 try{await fn()}catch(e){report(label,false,String(e?.message||e).slice(0,160));}
}
await safeCheck('HTTPS homepage',async()=>{
 const res=await get(origin+'/?health-check=1',{headers:{accept:'text/html'}});
 const html=await res.text();
 report('HTTPS homepage',res.ok&&new URL(res.url).protocol==='https:'&&
  html.includes('id="app"')&&html.includes('bebo.nz')&&html.includes('data-nav="start"'),
  'Unavailable, missing app or missing Start Here navigation');
});
await safeCheck('HTTPS About page and independent disclaimer',async()=>{
 const res=await get(origin+'/about.html',{headers:{accept:'text/html'}});
 const html=await res.text();
 report('HTTPS About page and independent disclaimer',res.ok&&
  /independent/i.test(html)&&/not affiliated/i.test(html));
});
await safeCheck('Sitemap on custom domain',async()=>{
 const res=await get(origin+'/sitemap.xml',{headers:{accept:'application/xml'}});
 const xml=await res.text();
 report('Sitemap on custom domain',res.ok&&xml.includes('https://bebo.nz/'));
});
await safeCheck('Core JavaScript available',async()=>{
 const res=await get(origin+'/social.js',{headers:{accept:'application/javascript'}});
 const code=await res.text();
 report('Core JavaScript available',res.ok&&code.includes("const BEBO_SITE_URL='https://bebo.nz/'"));
});
const publicHeaders={'apikey':key,accept:'application/json'};
await safeCheck('Public profiles readable',async()=>{
 const res=await get(base+'/rest/v1/bebo_profiles?select=id&limit=1',{headers:publicHeaders});
 report('Public profiles readable',res.ok&&Array.isArray(await res.json()),
   'Public member discovery is unavailable');
});
await safeCheck('Only approved videos readable to guests',async()=>{
 const res=await get(base+'/rest/v1/bebo_videos?select=status&limit=20',{headers:publicHeaders});
 if(!res.ok){report('Only approved videos readable to guests',false,'Public video endpoint unavailable');return}
 const videos=await res.json();
 report('Only approved videos readable to guests',Array.isArray(videos)&&videos.every(v=>v.status==='approved'),
  'Non-approved content visible or invalid response');
});
// Audit private table exposure as the anonymous visitor role. All SELECTs are read-only.
// A 200 [] is acceptable: some well-configured RLS tables return an empty array instead of 403.
// A 200 with any row is a launch-blocking privacy regression. Never print user records.
for(const table of ['bebo_mail','bebo_reports','bebo_suggestions','bebo_moderators',
 'bebo_admin_audit','bebo_member_controls','bebo_verification_requests','bebo_video_view_events']){
 await safeCheck('Private '+table+' inaccessible anonymously',async()=>{
  const res=await get(base+'/rest/v1/'+table+'?select=*&limit=1',{headers:publicHeaders});
  if(res.status===401||res.status===403){
   report('Private '+table+' inaccessible anonymously',true);return;
  }
  if(res.status===200){
   const rows=await res.json();
   report('Private '+table+' inaccessible anonymously',Array.isArray(rows)&&rows.length===0,
    'PRIVATE DATA EXPOSED TO ANONYMOUS ROLE — investigate RLS immediately');
   return;
  }
  report('Private '+table+' inaccessible anonymously',false,'Unexpected status '+res.status);
 });
}
console.log('\nBEBO PRODUCTION HEALTH: '+result.passed+' passed / '+result.failed+' failed');
if(result.failed)process.exitCode=1;
