import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { createRetro } from './nostalgia.js';
import { createSafety } from './safety.js';
import { createClassic } from './classic-modules.js';
import { skins, skinCategories, getSkin, skinArtwork } from './skin-library.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
const app=document.querySelector('#app');
const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL||'')&&SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_');
const sb=configured?createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
const BEBO_SITE_URL='https://frymastercheese.github.io/Bebo/'; // Must also be added under Supabase Auth > URL Configuration.
let me=null, profile=null, page='home', userViewed=null, message='', success=false;

const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const clamp=(s,n)=>String(s??'').trim().slice(0,n);
const time=s=>new Date(s).toLocaleString('en-NZ',{dateStyle:'medium',timeStyle:'short'});
const grad=p=>p?.skin==='custom'?`linear-gradient(125deg,${p.skin_secondary},${p.skin_primary},#522b5b)`:skinArtwork(getSkin(p?.skin));
let activeSkinCategory='All';
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
 <label>Password (8 characters minimum)<input type="password" name="password" required minlength="8" maxlength="128" autocomplete="new-password" placeholder="At least 8 characters"></label>
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
 <hr><div class="profile-photo-editor"><strong>Your profile picture ♥</strong><div class="photo-current">${badge(profile)}</div>
 <label>Change picture (optional, PNG/JPG/WebP up to 5MB)<input type="file" name="avatar" accept="image/jpeg,image/png,image/webp"></label>
 <p class="muted">You can change the picture or leave it as it is. The button below saves your status, About Me, location, music and photo together.</p></div>
 <button class="button" type="submit">Save Profile &amp; Photo ♥</button></form>`)}
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
 const skinPreset=getSkin(who.skin);
 const themePrimary=who.skin==='custom'&&/^#[0-9a-fA-F]{6}$/.test(who.skin_primary)?who.skin_primary:skinPreset[3];
 const themeSecondary=who.skin==='custom'&&/^#[0-9a-fA-F]{6}$/.test(who.skin_secondary)?who.skin_secondary:skinPreset[2];
 app.innerHTML=note()+`<div class="themed-profile" style="--retro-primary:${safe(themePrimary)};--retro-secondary:${safe(themeSecondary)};--retro-dark:${safe(skinPreset[4])}"><div class="profile-art" data-decor="${safe(skinPreset[7])}" style="--banner:${safe(retro.imageStyle(who,grad(who)))}">${safe(who.display_name)} ★</div><div class="cols"><div>${p1}</div><div>${wall}</div></div>${classicExtras}${extras}</div>`;
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
function miniSkin(s){
 return `<div class="skin-mini"><div class="skin-mini-banner" style="background:${safe(skinArtwork(s))}" data-motif="${safe(s[7])}"><span>my bebo ★</span></div><div class="skin-mini-layout"><div class="skin-mini-avatar">♥</div><div class="skin-mini-lines"><span></span><span></span></div><div class="skin-mini-blocks"><span style="background:${safe(s[3])}"></span><span style="background:${safe(s[2])}"></span></div></div></div>`;
}
function bigSkinPreview(x){
 return `<div class="skin-tryout"><div class="skin-tryout-banner" data-motif="${safe(x[7])}" style="background:${safe(skinArtwork(x))}"><strong>your bebo ★</strong></div><div class="skin-tryout-flex"><div class="skin-tryout-left"><div class="skin-tryout-avatar">♥</div><span>your photo</span></div><div class="skin-tryout-main"><div class="skin-tryout-bar" style="background:${safe(x[3])}">my profile ♥</div><p>your status goes here...</p><div class="skin-tryout-bar" style="background:${safe(x[4])}">my top 16</div><p>friends • luv • whiteboard</p></div></div><p class="skin-tryout-caption"><strong>${safe(x[1])}</strong> <span>${safe(x[5])}</span></p></div>`;
}
async function showSkins(){
 const saved=await query('bebo_skins',q=>q.select('id,name,primary_color,secondary_color,creator_id,banner_path').order('created_at',{ascending:false}).limit(50));
 const categories=skinCategories.map(c=>`<button type="button" class="skin-filter ${c===activeSkinCategory?'active':''}" data-action="skin-filter" data-id="${safe(c)}" aria-pressed="${c===activeSkinCategory}">${safe(c)}</button>`).join('');
 const cards=skins.map(x=>`<div class="skin skin-card" data-category="${safe(x[5])}" data-name="${safe(x[1].toLowerCase())}"><button type="button" class="skin-preview-button" data-action="skin-preview" data-id="${safe(x[0])}" aria-label="Preview ${safe(x[1])}">${miniSkin(x)}<strong>${safe(x[1])}</strong><span class="skin-category-name">${safe(x[5])}</span></button><button type="button" class="button skin-use-button" data-action="use-skin" data-id="${safe(x[0])}">Use skin ♥</button></div>`).join('');
 const userSkins=saved.map(x=>`<button type="button" class="skin" data-action="use-shared-skin" data-id="${safe(x.id)}"><div class="swatch" style="background:${safe(retro.imageStyle({skin_banner_path:x.banner_path},`linear-gradient(120deg,${x.secondary_color},${x.primary_color})`))}"></div><strong>${safe(x.name)}</strong></button>`).join('');
 const memberPrompt=!me?'<p class="muted">You can browse and preview every skin for free. Log in to apply one to your own profile.</p>':'<p class="muted">Preview any skin below, then press Use skin to save it to your Bebo profile.</p>';
 app.innerHTML=note()+panel('Bebo Skin Gallery ★',`<div class="skins-intro"><div><strong>★ ${skins.length} old-school inspired profile skins</strong><p>Emo hearts, glitter, scene queen, pink princess, butterflies, summer love and more. Choose your look, just like the 2000s.</p></div><span>pick your mood ♥</span></div>${memberPrompt}<div class="skin-controls"><label class="skin-search-label" for="skin-search">Find your perfect skin <input id="skin-search" type="search" placeholder="Try emo, pink, glitter or rock..." autocomplete="off"></label><span id="skin-count" class="muted">${skins.length} skins</span></div><div class="skin-filters">${categories}</div><div id="skin-tryout">${bigSkinPreview(skins[0])}</div><div id="skin-gallery" class="skin-grid">${cards}</div>`)
 +panel('Community Skin Designs ♥',`<p>Real members can upload their own banner image and share coloured skins with the community.</p><div class="skin-grid">${userSkins||'<p class="muted">Be the first to share a skin!</p>'}</div>`)
 +(me&&profile?panel('Create & Share Your Own Skin',`<form class="fields" data-form="skin">
 <label>Skin name<input name="name" maxlength="70" required placeholder="My amazing skin"></label>
 <label>Main colour<input name="primary" type="color" value="#c52d61"></label>
 <label>Second colour<input name="secondary" type="color" value="#f5b2ce"></label><label>Optional banner picture (PNG, JPG, WebP — maximum 5 MB)<input type="file" name="banner" accept="image/png,image/jpeg,image/webp"></label>
 <button class="button">Save & share skin ♥</button></form>`):'');
 filterSkins();
}
function filterSkins(category){
 if(category&&skinCategories.includes(category))activeSkinCategory=category;
 const text=(document.querySelector('#skin-search')?.value||'').toLowerCase().trim();
 let showing=0;
 document.querySelectorAll('#skin-gallery .skin-card').forEach(el=>{
   const visible=(activeSkinCategory==='All'||el.dataset.category===activeSkinCategory)&&(!text||el.dataset.name.includes(text)||el.dataset.category.toLowerCase().includes(text));
   el.hidden=!visible;if(visible)showing++;
 });
 document.querySelectorAll('.skin-filter').forEach(b=>{
   const on=b.dataset.id===activeSkinCategory;
   b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));
 });
 const count=document.querySelector('#skin-count');if(count)count.textContent=`${showing} of ${skins.length} skins`;
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
  if(page==='skins'){await showSkins();return}
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
window.addEventListener('hashchange',()=>{message='';activeSkinCategory='All';render()});
document.addEventListener('input',e=>{if(e.target?.id==='skin-search')filterSkins()});
document.addEventListener('submit',async e=>{
 const f=e.target.closest('form[data-form]');if(!f)return;e.preventDefault();
 if(f.dataset.busy)return;f.dataset.busy='1';const b=f.querySelector('button');if(b)b.disabled=true;
 const d=new FormData(f),type=f.dataset.form;
 try{
 if(type==='signup'){
  if(d.get('adult')!=='on')throw Error('Confirm you are 18 or older first.');
  if(String(d.get('password')||'').length<8)throw Error('Choose a password with at least 8 characters.');
  const {data,error}=await sb.auth.signUp({email:String(d.get('email')).trim(),password:String(d.get('password')),options:{emailRedirectTo:BEBO_SITE_URL}});
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
  if(!me||!profile)throw Error('Sign in and create a profile first.');
  const changes={display_name:clamp(d.get('display_name'),60),status:clamp(d.get('status'),180),bio:clamp(d.get('bio'),2000),location:clamp(d.get('location'),80),music:clamp(d.get('music'),120),music_url:musicUrl,flashbox_video_id:videoId};
  if(!changes.display_name)throw Error('Please enter a display name.');
  const file=d.get('avatar');
  let uploadedPath='';
  if(file instanceof File && file.size){
    if(file.size>5*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Your picture must be a PNG, JPG or WebP under 5MB.');
    const extension={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type];
    uploadedPath=`${me.id}/${crypto.randomUUID()}.${extension}`;
    const {error:uploadError}=await sb.storage.from('bebo-avatars').upload(uploadedPath,file,{contentType:file.type,upsert:false});
    if(uploadError)throw uploadError;
    changes.avatar_path=uploadedPath;
  }
  try {
    await query('bebo_profiles',q=>q.update(changes).eq('id',me.id));
  }catch(error){
    if(uploadedPath)await sb.storage.from('bebo-avatars').remove([uploadedPath]).catch(()=>{});
    throw error;
  }
  // The photo and every profile field were saved in the same database update.
  await loadMine();
  message='Your profile details and photo are saved together ♥';
  success=true;location.hash='#/profile';
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
 }else if(type.startsWith('classic-')){
  message=await classic.form(type,d,{me,profile,userViewed});success=true;
 }else if(type==='safety-delete-account'){
  const result=await safety.form(type,d,{me,profile,userViewed});
  if(result.deleted){me=null;profile=null;location.hash='#/home';message='Your Bebo account was permanently deleted.';success=true;}
  else {message='Deletion cancelled. Your account is unchanged.';success=true;}
 }else if(type.startsWith('retro-')){
  message=await retro.form(type,d,{me,profile,userViewed});success=true;
 }
 }catch(err){message=escapeError(err);success=false}finally{
  f.dataset.busy='';if(b)b.disabled=false;
  if(type==='edit-profile'&&!success){
    let notice=f.querySelector('.edit-profile-error');
    if(!notice){notice=document.createElement('p');notice.className='notice bad edit-profile-error';notice.setAttribute('role','alert');f.prepend(notice);}
    notice.textContent=message;
  }else render();
}
});
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-action]');if(!b)return;e.preventDefault();
 const a=b.dataset.action,id=b.dataset.id;
 try{
 if(a==='go'){location.hash='#/'+id;return}
 if(a==='skin-filter'){filterSkins(id);return}
 if(a==='skin-preview'){const preset=skins.find(s=>s[0]===id);if(preset){const target=document.querySelector('#skin-tryout');if(target)target.innerHTML=bigSkinPreview(preset)}return}
 if(a==='retro-clear'){retro.clear();return}
 if(a.startsWith('classic-')){message=await classic.action(a,id,{me,profile,userViewed});success=true}
 if(a.startsWith('safety-')){message=await safety.action(a,id,{me,profile,userViewed});success=true}
 else if(a.startsWith('retro-')){message=await retro.action(a,id,{me,profile,userViewed});success=true}
 else if(a==='logout'){await sb.auth.signOut();me=null;profile=null;message='You are signed out.';location.hash='#/home'}
 else if(a==='reset'){const email=prompt('Enter your account email');if(!email)return;const {error}=await sb.auth.resetPasswordForEmail(email.trim(),{redirectTo:BEBO_SITE_URL});if(error)throw error;message='Check your email for the password reset link.';success=true}
 else if(a==='friend-request'){await query('bebo_friendships',q=>q.insert({requester_id:me.id,addressee_id:id}));message='Friend request sent ♥';success=true}
 else if(a==='friend-accept'||a==='friend-decline'){await query('bebo_friendships',q=>q.update({status:a==='friend-accept'?'accepted':'declined'}).eq('id',id));message=a==='friend-accept'?'Friend added ♥':'Request declined';success=true}
 else if(a==='friend-remove'){await query('bebo_friendships',q=>q.delete().eq('id',id));message='Friend removed';success=true}
 else if(a==='delete-post'){await query('bebo_wall_posts',q=>q.delete().eq('id',id));message='Comment deleted';success=true}
 else if(a==='report-post'){const reason=prompt('Why are you reporting this comment? (minimum 10 characters)');if(!reason)return;if(reason.trim().length<10)throw Error('Please give a little more information.');await query('bebo_reports',q=>q.insert({reporter_id:me.id,reported_post_id:id,reason:clamp(reason,1000)}));message='Your report was submitted for review.';success=true}
 else if(a==='use-skin'){if(!me||!profile)throw Error('Sign in and create a profile to use this skin.');if(!skins.some(x=>x[0]===id))throw Error('Unknown skin.');await query('bebo_profiles',q=>q.update({skin:id,skin_banner_path:''}).eq('id',me.id));await loadMine();message='Skin applied to your public Bebo profile ♥';success=true}
 else if(a==='use-shared-skin'){if(!profile)throw Error('Create a profile first.');const row=await query('bebo_skins',q=>q.select('*').eq('id',id).single());await query('bebo_profiles',q=>q.update({skin:'custom',skin_primary:row.primary_color,skin_secondary:row.secondary_color,skin_banner_path:row.banner_path||''}).eq('id',me.id));await loadMine();message='Community skin applied ♥';success=true}
 }catch(err){message=escapeError(err);success=false}
 render();
});
init();
