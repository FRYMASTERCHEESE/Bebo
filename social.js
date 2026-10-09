import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { createRetro } from './nostalgia.js';
import { createSafety } from './safety.js';
import { createClassic } from './classic-modules.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
const app=document.querySelector('#app');
const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL||'')&&SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_');
const sb=configured?createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
let me=null, profile=null, page='home', userViewed=null, message='', success=false;
const skins=[
['classic','Pretty in Pink','#f9a4c1','#d12f6a','#682655'],
['glitter','Glitter Girl','#d7a1f4','#8a2ca1','#3a1859'],
['emo','Emo Hearts','#2c2934','#a32644','#14121b'],
['ocean','Summer Blue','#a2e5ed','#2396d1','#093e65'],
['sunset','Summer Love','#ffcd72','#ee734f','#9b2c74'],
['mint','Flower Power','#ceec9e','#68bca1','#365d66'],
['ruby','Red Roses','#f9879b','#bc3048','#56213a'],
['cloud','Blue Clouds','#d2e4ff','#91ace0','#456eab']
];
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const clamp=(s,n)=>String(s??'').trim().slice(0,n);
const time=s=>new Date(s).toLocaleString('en-NZ',{dateStyle:'medium',timeStyle:'short'});
const grad=p=>p?.skin==='custom'?`linear-gradient(120deg,${p.skin_secondary},${p.skin_primary},#522b5b)`:
  (()=>{const x=skins.find(s=>s[0]===(p?.skin||'classic'))||skins[0];return `linear-gradient(120deg,${x[2]},${x[3]},${x[4]})`;})();
const btn=(label,action,id='',extra='')=>`<button class="button ${extra}" data-action="${action}" data-id="${safe(id)}">${label}</button>`;
const panel=(title,html)=>`<section class="panel"><h2>${title}</h2><div class="body">${html}</div></section>`;
const report=(txt,ok=false)=>{message=txt;success=ok;render()};
const badge=p=>p?.avatar_path?'<img class="avatar" alt="Avatar" src="'+safe(sb.storage.from('bebo-avatars').getPublicUrl(p.avatar_path).data.publicUrl)+'">':
  '<div class="avatar" aria-label="Profile initials">'+safe((p?.display_name||'?').slice(0,1).toUpperCase())+'</div>';
const note=()=>message?`<div class="notice ${success?'good':'bad'}">${safe(message)}</div>`:'';
const escapeError=e=>(e?.message||'Something went wrong. Please try again.').slice(0,240);
async function query(table,fn){const q=fn(sb.from(table));const {data,error}=await q;if(error)throw error;return data}
const retro=createRetro(sb,{safe,panel,btn,query});
const safety=createSafety(sb,{safe,panel,btn,query});
const classic=createClassic(sb,{safe,panel,btn,query});
async function loadMine(){if(!me){profile=null;return}profile=await query('bebo_profiles',q=>q.select('*').eq('id',me.id).maybeSingle())}
async function init(){
 if(!sb){render();return}
 try{
  const {data,error}=await sb.auth.getUser();if(error&&error.name!=='AuthSessionMissingError')throw error;
  me=data.user||null;await loadMine();
 }catch(e){message='Could not connect to Bebo database: '+escapeError(e)}
 sb.auth.onAuthStateChange((_event,session)=>{const id=session?.user?.id||null;if(id!==me?.id){me=session?.user||null;profile=null;setTimeout(async()=>{try{await loadMine()}catch(e){message=escapeError(e)}render()},0)}});
 render();
}
function authPage(){
 if(!configured)return panel('Bebo is being prepared',`<p>The public Bebo website is online, but its new community database is not connected yet. No accounts are being collected while setup is incomplete.</p><p><a href="./classic.html">Try the interactive 2007-style demo and skin creator ♥</a></p>`);
 return panel('Join Bebo — it’s free! ♥',`<div class="cols"><div>${panel('Create your account',`<form class="fields" data-form="signup">
 <label>Email address<input type="email" name="email" required maxlength="254" autocomplete="email"></label>
 <label>Password (12 characters minimum)<input type="password" name="password" required minlength="12" maxlength="128" autocomplete="new-password"></label>
 <label><input type="checkbox" name="adult" required> I confirm I am 18 or older and agree to the <a href="#/safety">community rules and privacy information</a>.</label><button class="button">Join Bebo ♥</button></form><p class="muted">You may need to confirm your email first. Do not use your old Bebo password.</p>`)}</div>
 <div>${panel('Already a member?',`<form class="fields" data-form="login"><label>Email<input type="email" name="email" required autocomplete="email"></label><label>Password<input type="password" name="password" required autocomplete="current-password"></label><button class="button">Log in</button></form><p><a href="#" data-action="reset">Forgot password?</a></p>`)}</div></div>`);
}
function welcome(){return panel('Welcome back to Bebo ♥',`<p>Your favourite Bebo features are here: the Top 16, three Luv a day, colourful custom skins, Whiteboards, music, Flashboxes, quizzes, polls, Bands and Authors.</p>
 <p>Use the navigation to discover members, design a profile skin, or visit your own profile.</p>
 <p>${btn('Create your profile','go','profile')}${btn('Browse people','go','friends','secondary')}${btn('Create a skin','go','skins','secondary')}</p>`)}
function createProfile(){return panel('Choose your Bebo name ♥',`<p>Make your new profile. Usernames must be unique and contain 3–25 lowercase letters, numbers or underscores.</p>
 <form class="fields" data-form="create-profile"><label>Username<input name="username" pattern="[a-z0-9_]{3,25}" required placeholder="my_bebo_name" minlength="3" maxlength="25"></label>
 <label>Display name<input name="display_name" maxlength="60" required></label><button class="button">Create my profile</button></form>`)}
function editProfile(){return panel('Edit My Profile',`<form class="fields" data-form="edit-profile">
 <label>Display name<input name="display_name" required maxlength="60" value="${safe(profile.display_name)}"></label>
 <label>Status<input name="status" maxlength="180" value="${safe(profile.status)}"></label>
 <label>About me<textarea name="bio" maxlength="2000">${safe(profile.bio)}</textarea></label>
 <label>Location<input name="location" maxlength="80" value="${safe(profile.location)}"></label>
 <label>Favourite music<input name="music" maxlength="120" value="${safe(profile.music)}"></label>
 <label>Song file URL (HTTPS MP3, OGG, WAV, M4A or WebM)<input type="url" name="music_url" maxlength="500" value="${safe(profile.music_url||'')}" placeholder="https://example.com/music.mp3"></label>
 <label>My Flashbox — YouTube video URL<input type="url" name="flashbox" maxlength="500" value="${profile.flashbox_video_id?'https://www.youtube.com/watch?v='+safe(profile.flashbox_video_id):''}" placeholder="https://www.youtube.com/watch?v=..."></label>
 <button class="button">Save profile</button></form>
 <hr><form class="fields" data-form="avatar"><label>Upload your profile photo (PNG/JPG/WebP, maximum 5MB)<input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" required></label><button class="button secondary">Upload photo</button></form>`)}
async function showProfile(username){
 const who=username?await query('bebo_profiles',q=>q.select('*').eq('username',username).maybeSingle()):profile;
 if(!who){app.innerHTML=note()+panel('Profile not found','This member has not created a profile yet.');return}
 userViewed=who;
 const [posts,friendships,top]=await Promise.all([
 query('bebo_wall_posts',q=>q.select('*').eq('profile_id',who.id).order('created_at',{ascending:false}).limit(30)),
 me?query('bebo_friendships',q=>q.select('*').or(`requester_id.eq.${me.id},addressee_id.eq.${me.id}`)):Promise.resolve([]),
 query('bebo_profiles',q=>q.select('id,username,display_name,avatar_path').limit(16).neq('id',who.id))
 ]);
 const authors=[...new Set(posts.map(x=>x.author_id))];const names=authors.length?await query('bebo_profiles',q=>q.select('id,username,display_name').in('id',authors)):[];
 const byId=new Map(names.map(x=>[x.id,x]));
 const own=who.id===me?.id;
 const rel=friendships.find(f=>(f.requester_id===who.id||f.addressee_id===who.id));
 let friendAction='';
 if(!own&&me){
  if(!rel)friendAction=btn('Add friend ♥','friend-request',who.id);
  else if(rel.status==='accepted')friendAction=btn('Remove friend','friend-remove',rel.id,'secondary');
  else if(rel.status==='pending'&&rel.addressee_id===me.id)friendAction=btn('Accept friend ♥','friend-accept',rel.id);
  else friendAction='<span class="muted">Friend request pending</span>';
 }
 const blockedIds=await safety.myBlocks(me);
 const blocked=blockedIds.has(who.id);
 const tools=await safety.profileTools(who,me);
 if(blocked)friendAction='<span class="muted">Blocked member</span>';
 const visiblePosts=posts.filter(post=>!blockedIds.has(post.author_id));
 const extras=blocked?panel('Member blocked','<p>You have blocked this member. Use Unblock to interact again.</p>'):await retro.sharedPanel(who,me);
 const classicExtras=await classic.publicModules(who,me);
 const p1=panel('My Profile',`<div style="text-align:center">${badge(who)}<h3>${safe(who.display_name)}</h3><p>@${safe(who.username)}</p>${friendAction}${tools}<p class="muted">${safe(who.location)}</p></div><hr><strong>My Status:</strong><p>${safe(who.status)}</p><strong>About Me:</strong><p style="white-space:pre-wrap">${safe(who.bio)}</p><strong>Music:</strong><p>${safe(who.music)}</p>${own?btn('Edit profile','go','edit','secondary'):''}`);
 const form=me&&!blocked?`<form data-form="wall" class="fields"><textarea name="body" maxlength="1200" required placeholder="Leave ${safe(who.display_name)} a comment ♥"></textarea><button class="button">Post comment</button></form>`:'<p><a href="#/account">Log in</a> to leave a comment.</p>';
 const wall=panel('My Wall — Leave Me a Comment ♥',`${form}<hr>${visiblePosts.length?visiblePosts.map(post=>`<article class="item">
 <strong><a href="#/u/${encodeURIComponent(byId.get(post.author_id)?.username||'')}">${safe(byId.get(post.author_id)?.display_name||'Member')}</a></strong>
 <span class="muted">${time(post.created_at)}</span>
 <p style="white-space:pre-wrap">${safe(post.body)}</p>
 ${me&&(post.author_id===me.id||who.id===me.id)?btn('Delete','delete-post',post.id,'secondary'):''}
 ${me?btn('Report','report-post',post.id,'secondary'):''}</article>`).join(''):'<p class="muted">No comments yet. Be the first!</p>'}`);
 const skinPreset=skins.find(s=>s[0]===(who.skin||'classic'))||skins[0];
 const themePrimary=who.skin==='custom'&&/^#[0-9a-fA-F]{6}$/.test(who.skin_primary)?who.skin_primary:skinPreset[3];
 const themeSecondary=who.skin==='custom'&&/^#[0-9a-fA-F]{6}$/.test(who.skin_secondary)?who.skin_secondary:skinPreset[2];
 app.innerHTML=note()+`<div class="themed-profile" style="--retro-primary:${safe(themePrimary)};--retro-secondary:${safe(themeSecondary)}"><div class="profile-art" style="--banner:${safe(retro.imageStyle(who,grad(who)))}">${safe(who.display_name)} ★</div><div class="cols"><div>${p1}</div><div>${wall}</div></div>${classicExtras}${extras}</div>`;
}
async function showFriends(){
 const profiles=await query('bebo_profiles',q=>q.select('id,username,display_name,status,avatar_path').order('created_at',{ascending:false}).limit(80));
 const requests=me?await query('bebo_friendships',q=>q.select('*').eq('addressee_id',me.id).eq('status','pending')):[];
 const blocked=await safety.myBlocks(me);
 const displayProfiles=profiles.filter(p=>!blocked.has(p.id));
 const displayRequests=requests.filter(x=>!blocked.has(x.requester_id));
 app.innerHTML=note()+panel('Find Bebo Friends ♥',`<p>Meet members and visit their profiles.</p>
 ${displayRequests.length?'<h3>Friend requests</h3>'+displayRequests.map(x=>`<div class="item">Someone sent you a friend request ${btn('Accept','friend-accept',x.id)} ${btn('Decline','friend-decline',x.id,'secondary')}</div>`).join('')+'<hr>':''}
 ${displayProfiles.map(x=>`<div class="item"><a href="#/u/${encodeURIComponent(x.username)}"><strong>${safe(x.display_name)}</strong></a> <span class="muted">@${safe(x.username)}</span><p>${safe(x.status)}</p></div>`).join('')||'No profiles yet.'}`);
}
async function showSkins(){
 const saved=await query('bebo_skins',q=>q.select('id,name,primary_color,secondary_color,creator_id,banner_path').order('created_at',{ascending:false}).limit(30));
 const cards=skins.map(x=>`<button class="skin" data-action="use-skin" data-id="${x[0]}"><div class="swatch" style="background:linear-gradient(120deg,${x[2]},${x[3]},${x[4]})"></div><strong>${safe(x[1])}</strong></button>`).join('');
 const userSkins=saved.map(x=>`<button class="skin" data-action="use-shared-skin" data-id="${x.id}"><div class="swatch" style="background:${safe(retro.imageStyle({skin_banner_path:x.banner_path},`linear-gradient(120deg,${x.secondary_color},${x.primary_color})`))}"></div><strong>${safe(x.name)}</strong></button>`).join('');
 app.innerHTML=note()+panel('Skin Gallery ♥',`<p>Click any skin to apply it to your public profile.</p><div class="skin-grid">${cards}</div><h3>Community skins</h3><div class="skin-grid">${userSkins||'<p class="muted">Be the first to share a skin!</p>'}</div>`)
 +(me&&profile?panel('Create & Share Your Own Skin',`<form class="fields" data-form="skin">
 <label>Skin name<input name="name" maxlength="70" required placeholder="My amazing skin"></label>
 <label>Main colour<input name="primary" type="color" value="#c52d61"></label>
 <label>Second colour<input name="secondary" type="color" value="#f5b2ce"></label><label>Optional banner picture (PNG, JPG, WebP — maximum 5 MB)<input type="file" name="banner" accept="image/png,image/jpeg,image/webp"></label>
 <button class="button">Save & share skin ♥</button></form>`):'');
}
function safetyInfoPage(){
 return panel('Bebo Community Rules & Privacy',`<p><strong>Be respectful.</strong> No bullying, harassment, hate, threats, sexual exploitation, impersonation, scams, malware or sharing someone else's private information.</p>
 <p><strong>Safety tools:</strong> Use Block on a member profile to prevent friend requests, Luv, drawings and wall posts between you. Use Report on comments or profiles to flag issues. Blocking does not make public content private.</p>
 <p><strong>Privacy:</strong> Display names, usernames, status, profile photos, profile skins, Wall comments, public quizzes and creative posts may be visible to everyone. We use Supabase for authentication and database storage and GitHub Pages for website hosting. Do not post addresses, phone numbers or sensitive information publicly.</p>
 <p><strong>Your data:</strong> You can edit your public profile, delete your comments, and request permanent deletion of your Bebo account through Account settings. Account deletion also removes linked social content and uploaded profile images. Some operational logs/backups may be retained temporarily by service providers.</p>
 <p><strong>Age and launch:</strong> This is a developing community for adults 18 and older during early testing. An age-checkbox is a self-declaration, not a verified proof of age. More moderation, appeals, spam protection, legal policy and privacy processes are required before a broad public launch.</p>
 <p><strong>Independent service:</strong> This community is not affiliated with the former Bebo company. Do not use an old Bebo password.</p>`);
}
async function refresh(){
 const raw=decodeURIComponent(location.hash.replace(/^#\/?/,''));
 if(raw.startsWith('u/')){page='view';await showProfile(raw.slice(2));return}
 page=raw||'home';
 if(!configured){app.innerHTML=note()+authPage();return}
 if(page==='safety'){app.innerHTML=note()+safetyInfoPage();return}
 if(!me){
  if(['polls','quizzes','creators'].includes(page)){app.innerHTML=note()+await retro.route(page,null);return}
  if(page==='photos'||page.startsWith('photos/')||page.startsWith('album/')||
     page==='blogs'||page.startsWith('blogs/')||page.startsWith('blog/')||page==='groups'){
    app.innerHTML=note()+await classic.route(page,null);return
  }
  app.innerHTML=note()+authPage();return
 }
 if(!profile){app.innerHTML=note()+createProfile();return}
 switch(page){
 case 'profile':await showProfile();break;
 case 'friends':await showFriends();break;
 case 'polls':case 'quizzes':case 'creators':app.innerHTML=note()+await retro.route(page,me);break;
 case 'photos':case 'blogs':case 'groups':case 'other-half':case 'messages':
   app.innerHTML=note()+await classic.route(page,me);break;
 default:
   if(page.startsWith('photos/')||page.startsWith('album/')||page.startsWith('blogs/')||
      page.startsWith('blog/')||page.startsWith('messages/'))app.innerHTML=note()+await classic.route(page,me);
   else app.innerHTML=note()+await classic.home(me);
   break;
 case 'skins':await showSkins();break;
 case 'edit':app.innerHTML=note()+editProfile();break;
 case 'account':app.innerHTML=note()+panel('Your Bebo Account',`<p>Signed in as ${safe(me.email)}</p>${btn('Log out','logout')}`)+await safety.accountPanel(me);break;
 }
}
function render(){refresh().then(()=>retro.afterRender()).catch(e=>{app.innerHTML=note()+panel('Could not load this page',safe(escapeError(e))+'<p><a href="#/home">Return home</a></p>')})}
document.querySelector('#nav').addEventListener('click',e=>{const b=e.target.closest('[data-nav]');if(!b)return;location.href=b.dataset.nav==='classic'?'./classic.html':'#/'+b.dataset.nav;render()});
window.addEventListener('hashchange',()=>{message='';render()});
document.addEventListener('submit',async e=>{
 const f=e.target.closest('form[data-form]');if(!f)return;e.preventDefault();
 if(f.dataset.busy)return;f.dataset.busy='1';const b=f.querySelector('button');if(b)b.disabled=true;
 const d=new FormData(f),type=f.dataset.form;
 try{
 if(type==='signup'){
  if(d.get('adult')!=='on')throw Error('Confirm you are 18 or older first.');
  const {data,error}=await sb.auth.signUp({email:String(d.get('email')).trim(),password:String(d.get('password')),options:{emailRedirectTo:location.origin+location.pathname}});
  if(error)throw error;message='Check your email to confirm your new Bebo account, then log in.';success=true;
  if(data.session){me=data.user;await loadMine();}
 }else if(type==='login'){
  const {data,error}=await sb.auth.signInWithPassword({email:String(d.get('email')).trim(),password:String(d.get('password'))});
  if(error)throw error;me=data.user;await loadMine();message='Welcome back to Bebo ♥';success=true;location.hash='#/profile';
 }else if(type==='create-profile'){
  const username=clamp(d.get('username'),25).toLowerCase();
  if(!/^[a-z0-9_]{3,25}$/.test(username))throw Error('Choose a valid username.');
  await query('bebo_profiles',q=>q.insert({id:me.id,username,display_name:clamp(d.get('display_name'),60)}));
  await loadMine();message='Your Bebo profile is ready ♥';success=true;location.hash='#/profile';
 }else if(type==='edit-profile'){
  const musicUrl=String(d.get('music_url')||'').trim();
  const flashInput=String(d.get('flashbox')||'').trim();
  if(musicUrl&&!retro.audioUrl(musicUrl))throw Error('Enter a direct HTTPS audio file URL ending in MP3, OGG, WAV, M4A or WebM.');
  const videoId=flashInput?retro.youtubeId(flashInput):'';
  if(flashInput&&!videoId)throw Error('Enter a valid YouTube video URL for your Flashbox.');
  await query('bebo_profiles',q=>q.update({display_name:clamp(d.get('display_name'),60),status:clamp(d.get('status'),180),bio:clamp(d.get('bio'),2000),location:clamp(d.get('location'),80),music:clamp(d.get('music'),120),music_url:musicUrl,flashbox_video_id:videoId}).eq('id',me.id));
  await loadMine();message='Profile updated ♥';success=true;location.hash='#/profile';
 }else if(type==='wall'){
  if(!me||!userViewed)throw Error('Log in first.');const body=clamp(d.get('body'),1200);
  if(!body)throw Error('Write a message first.');
  await query('bebo_wall_posts',q=>q.insert({author_id:me.id,profile_id:userViewed.id,body}));
  message='Your comment was posted ♥';success=true;
 }else if(type==='skin'){
  const primary=String(d.get('primary')),secondary=String(d.get('secondary'));
  const bannerFile=d.get('banner');
  const bannerPath=await retro.uploadBanner(bannerFile,me.id);
  const rows=await query('bebo_skins',q=>q.insert({creator_id:me.id,name:clamp(d.get('name'),70),primary_color:primary,secondary_color:secondary,banner_path:bannerPath}).select().single());
  await query('bebo_profiles',q=>q.update({skin:'custom',skin_primary:rows.primary_color,skin_secondary:rows.secondary_color,skin_banner_path:bannerPath}).eq('id',me.id));
  await loadMine();message='Your skin is saved and shared ♥';success=true;
 }else if(type==='avatar'){
  const file=d.get('avatar');if(!(file instanceof File)||!file.size)throw Error('Choose a photo.');
  if(file.size>5*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Upload a PNG, JPG or WebP less than 5 MB.');
  const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type],path=`${me.id}/${crypto.randomUUID()}.${ext}`;
  const {error}=await sb.storage.from('bebo-avatars').upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;
  await query('bebo_profiles',q=>q.update({avatar_path:path}).eq('id',me.id));await loadMine();
  message='New profile photo uploaded ♥';success=true;location.hash='#/profile';
 }else if(type.startsWith('classic-')){
  message=await classic.form(type,d,{me,profile,userViewed});success=true;
 }else if(type==='safety-delete-account'){
  const result=await safety.form(type,d,{me,profile,userViewed});
  if(result.deleted){me=null;profile=null;location.hash='#/home';message='Your Bebo account was permanently deleted.';success=true;}
  else {message='Deletion cancelled. Your account is unchanged.';success=true;}
 }else if(type.startsWith('retro-')){
  message=await retro.form(type,d,{me,profile,userViewed});success=true;
 }
 }catch(err){message=escapeError(err);success=false}finally{f.dataset.busy='';if(b)b.disabled=false;render()}
});
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-action]');if(!b)return;e.preventDefault();
 const a=b.dataset.action,id=b.dataset.id;
 try{
 if(a==='go'){location.hash='#/'+id;return}
 if(a==='retro-clear'){retro.clear();return}
 if(a.startsWith('classic-')){message=await classic.action(a,id,{me,profile,userViewed});success=true}
 if(a.startsWith('safety-')){message=await safety.action(a,id,{me,profile,userViewed});success=true}
 else if(a.startsWith('retro-')){message=await retro.action(a,id,{me,profile,userViewed});success=true}
 else if(a==='logout'){await sb.auth.signOut();me=null;profile=null;message='You are signed out.';location.hash='#/home'}
 else if(a==='reset'){const email=prompt('Enter your account email');if(!email)return;const {error}=await sb.auth.resetPasswordForEmail(email.trim(),{redirectTo:location.origin+location.pathname});if(error)throw error;message='Check your email for the password reset link.';success=true}
 else if(a==='friend-request'){await query('bebo_friendships',q=>q.insert({requester_id:me.id,addressee_id:id}));message='Friend request sent ♥';success=true}
 else if(a==='friend-accept'||a==='friend-decline'){await query('bebo_friendships',q=>q.update({status:a==='friend-accept'?'accepted':'declined'}).eq('id',id));message=a==='friend-accept'?'Friend added ♥':'Request declined';success=true}
 else if(a==='friend-remove'){await query('bebo_friendships',q=>q.delete().eq('id',id));message='Friend removed';success=true}
 else if(a==='delete-post'){await query('bebo_wall_posts',q=>q.delete().eq('id',id));message='Comment deleted';success=true}
 else if(a==='report-post'){const reason=prompt('Why are you reporting this comment? (minimum 10 characters)');if(!reason)return;if(reason.trim().length<10)throw Error('Please give a little more information.');await query('bebo_reports',q=>q.insert({reporter_id:me.id,reported_post_id:id,reason:clamp(reason,1000)}));message='Your report was submitted for review.';success=true}
 else if(a==='use-skin'){if(!profile)throw Error('Create a profile first.');await query('bebo_profiles',q=>q.update({skin:id,skin_banner_path:''}).eq('id',me.id));await loadMine();message='Skin applied ♥';success=true}
 else if(a==='use-shared-skin'){if(!profile)throw Error('Create a profile first.');const row=await query('bebo_skins',q=>q.select('*').eq('id',id).single());await query('bebo_profiles',q=>q.update({skin:'custom',skin_primary:row.primary_color,skin_secondary:row.secondary_color,skin_banner_path:row.banner_path||''}).eq('id',me.id));await loadMine();message='Community skin applied ♥';success=true}
 }catch(err){message=escapeError(err);success=false}
 render();
});
init();
