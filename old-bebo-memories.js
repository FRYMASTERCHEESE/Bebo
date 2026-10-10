/* Search public Internet Archive snapshots; never requests old login credentials. */
const HOSTS=new Set(['bebo.com','www.bebo.com','archive.bebo.com','m.bebo.com']);
const HANDLE=/^[a-z0-9][a-z0-9_.-]{1,39}$/i;
const MEMBER=/^\d{1,20}$/;
export function parseOldBeboInput(input){
 let raw=String(input??'').trim();
 if(!raw||raw.length>500)throw Error('Enter your old username or Bebo profile link (maximum 500 characters).');
 if(raw.startsWith('@'))raw=raw.slice(1);
 if(MEMBER.test(raw))return {type:'memberid',value:raw};
 if(/^(?:www\.|archive\.|m\.)?bebo\.com\//i.test(raw))raw='https://'+raw;
 if(HANDLE.test(raw))return {type:'username',value:raw};
 if(!/^https?:\/\//i.test(raw))throw Error('Enter an old username or a bebo.com profile URL.');
 let url;
 try{url=new URL(raw)}catch{throw Error('Please enter a valid Bebo profile URL.')}
 if(url.hostname.toLowerCase()==='web.archive.org'){
  const archived=raw.match(/\/web\/(?:\d{1,14}\*?|\*)[a-z_]*\/(https?:\/\/.*)$/i);
  if(!archived)throw Error('Paste the full Bebo address shown inside the archive link.');
  try{url=new URL(archived[1])}catch{throw Error('The archived Bebo URL is incomplete.')}
 }
 if(!HOSTS.has(url.hostname.toLowerCase())||url.username||url.password)
  throw Error('Only original bebo.com profile URLs are supported.');
 const member=[...url.searchParams.entries()].find(([key])=>key.toLowerCase()==='memberid');
 if(member){
  if(!MEMBER.test(member[1]))throw Error('Old MemberId must contain numbers only.');
  return {type:'memberid',value:member[1]};
 }
 const parts=url.pathname.split('/').filter(Boolean);
 if(parts.length===1&&HANDLE.test(parts[0])&&!/^(profile\.jsp|index\.jsp|home)$/i.test(parts[0]))
  return {type:'username',value:parts[0]};
 throw Error('Use an old Bebo username or a Profile.jsp link containing MemberId.');
}
export function oldBeboTargets(reference){
 if(reference.type==='memberid'&&MEMBER.test(reference.value)){
  const suffix='/Profile.jsp?MemberId='+reference.value;
  return ['http://www.bebo.com'+suffix,'http://archive.bebo.com'+suffix,'https://www.bebo.com'+suffix];
 }
 if(reference.type==='username'&&HANDLE.test(reference.value)){
  const name=encodeURIComponent(reference.value);
  return ['http://www.bebo.com/'+name,'http://bebo.com/'+name,'https://www.bebo.com/'+name];
 }
 throw Error('Invalid Bebo profile reference.');
}
export function oldBeboCalendar(target){
 const parsed=new URL(target);
 if(!HOSTS.has(parsed.hostname.toLowerCase())||!['http:','https:'].includes(parsed.protocol))
  throw Error('Invalid archive target.');
 return 'https://web.archive.org/web/*/'+target;
}
export async function searchOldBebo(input,fetcher=fetch){
 const reference=parseOldBeboInput(input);
 const checks=await Promise.all(oldBeboTargets(reference).map(async target=>{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12500);
  try{
   const api='https://archive.org/wayback/available?url='+encodeURIComponent(target)+'&timestamp=20080101000000';
   const response=await fetcher(api,{method:'GET',signal:controller.signal,credentials:'omit'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json();
   const match=data?.archived_snapshots?.closest;
   let snapshot=null;
   if(match?.available===true&&typeof match.url==='string'){
    const found=new URL(match.url);
    if(found.hostname==='web.archive.org'&&['http:','https:'].includes(found.protocol)){
     found.protocol='https:';
     snapshot={url:found.href,timestamp:String(match.timestamp||'')};
    }
   }
   return {target,calendar:oldBeboCalendar(target),checked:true,snapshot};
  }catch(error){
   return {target,calendar:oldBeboCalendar(target),checked:false,snapshot:null};
  }finally{clearTimeout(timeout)}
 }));
 return {reference,checks,found:checks.filter(x=>x.snapshot),failed:checks.filter(x=>!x.checked).length};
}
const archiveDate=t=>{
 if(!/^\d{14}$/.test(t))return 'Date unavailable';
 const date=Date.parse(t.slice(0,4)+'-'+t.slice(4,6)+'-'+t.slice(6,8));
 return Number.isFinite(date)?new Intl.DateTimeFormat('en-NZ',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date)):'Date unavailable';
};
export function createBeboMemories({safe,panel}){
 function page({me,profile}={}){
  const member=Boolean(me?.id&&profile?.id);
  const restore=member?
   '<section class="bebo-memory-card"><h3>♥ Bring memories to my Bebo profile</h3>'+
   '<p>Copy your old About Me, status or favourite music from a snapshot you own. These fields change only when you press Save.</p>'+
   '<form class="fields" data-form="old-bebo-restore">'+
   '<label>Old About Me<textarea name="bio" maxlength="2000" placeholder="Paste your old About Me (optional)"></textarea></label>'+
   '<label>Old status<input name="status" maxlength="180" placeholder="Paste your old status (optional)"></label>'+
   '<label>Old favourite music<input name="music" maxlength="120" placeholder="Artist or song (optional)"></label>'+
   '<label class="bebo-memory-consent"><input type="checkbox" name="own_content" required> This is my content or I have permission to use it.</label>'+
   '<button class="button" type="submit">♥ Save my memories</button></form>'+
   '<p><a href="#/edit">Add an old profile photo in Edit My Profile »</a></p></section>':
   '<section class="bebo-memory-card"><h3>♥ Rebuild your profile</h3>'+
   '<p>Archive searching is free. <a href="#/account">Sign in or join Bebo</a> to add your old photos and About Me to your new profile.</p></section>';
  return panel('♥ Find My Old Bebo Memories',
   '<div class="bebo-memory-page"><div class="bebo-memory-hero"><h3>Remember your first Bebo? ♥</h3>'+
   '<p>Look for old <strong>public</strong> Bebo pages saved by the Internet Archive. You can then rebuild your own new Bebo profile.</p></div>'+
   '<form id="bebo-memory-search" class="bebo-memory-form" autocomplete="off">'+
   '<label for="bebo-old-lookup">Old Bebo username or profile URL</label>'+
   '<div class="bebo-memory-search-row">'+
   '<input id="bebo-old-lookup" name="old_bebo" type="text" maxlength="500" required autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Old username or Profile.jsp?MemberId=...">'+
   '<button class="button" type="submit">Search old memories ♥</button></div>'+
   '<p class="muted">An old numeric MemberId profile link may find more than a username.</p></form>'+
   '<div id="bebo-memory-results" aria-live="polite"></div>'+restore+
   '<section class="bebo-memory-card"><h3>Where else can I look?</h3>'+
   '<p>Try saved bookmarks, screenshots, personal backups and old messages for a profile URL.</p>'+
   '<p><a href="https://web.archive.org/web/*/http://www.bebo.com/" target="_blank" rel="noopener noreferrer">Explore archived Bebo pages ↗</a></p>'+
   '<p><strong>Please note:</strong> Public snapshots may be incomplete. This cannot sign into deleted accounts, restore private messages, or prove ownership of an old profile. Never enter an old Bebo password.</p></section></div>');
 }
 async function submit(form){
  const output=document.querySelector('#bebo-memory-results'),button=form.querySelector('button[type="submit"]');
  if(!output)return;
  if(button)button.disabled=true;
  output.innerHTML='<p class="bebo-memory-loading" role="status">Checking surviving public Bebo snapshots…</p>';
  try{
   const result=await searchOldBebo(form.elements.old_bebo.value);
   if(!output.isConnected)return;
   const matched=[...new Map(result.found.map(x=>[x.snapshot.url,x])).values()];
   const heading=result.reference.type==='username'?'@'+result.reference.value:'MemberId '+result.reference.value;
   const found=matched.length?matched.map(x=>
    '<div class="bebo-memory-hit"><strong>♥ Archived Bebo snapshot found!</strong>'+
    '<span>Archived around '+safe(archiveDate(x.snapshot.timestamp))+'</span>'+
    '<a target="_blank" rel="noopener noreferrer" href="'+safe(x.snapshot.url)+'">Open archived page ↗</a></div>').join(''):
    '<p><strong>No confirmed snapshot from this quick check.</strong> Other dates, links and versions may still exist.</p>';
   output.innerHTML='<section class="bebo-memory-result"><h3>Results for '+safe(heading)+'</h3>'+
    (result.failed?'<p class="bebo-memory-warning">The Archive did not answer '+result.failed+' of '+result.checks.length+' checks; results are incomplete.</p>':'')+
    found+'<p><strong>Explore the full archive calendar:</strong></p><ul>'+
    result.checks.map(x=>'<li><a href="'+safe(x.calendar)+'" target="_blank" rel="noopener noreferrer">'+safe(x.target)+' ↗</a></li>').join('')+
    '</ul><p class="muted">Archive pages open in a new tab. Close that tab or switch back to Bebo to return; the ← Back button works within Bebo. Nothing is recovered automatically or stored by this search.</p></section>';
  }catch(error){
   output.innerHTML='<p class="bebo-memory-error" role="alert">'+safe(error?.message||'Could not search the archive.')+'</p>';
  }finally{if(button)button.disabled=false}
 }
 return {page,submit};
}
