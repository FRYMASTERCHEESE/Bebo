/* Bebo Videos V1: private, reviewed clips with public approved playback.
 * No third-party player, tracking, or browser-side moderator privileges.
 */
export const BEBO_VIDEO_MAX_BYTES=40*1024*1024; // 40 MiB ≈ 41.9 decimal MB
export function validateBeboVideoFile(file) {
 const size=Number(file?.size||0),name=String(file?.name||'');
 const reported=String(file?.type||'').toLowerCase().trim();
 const mime=['video/mp4','video/webm'].includes(reported)?reported:
  (!reported||reported==='application/octet-stream')&&/\.mp4$/i.test(name)?'video/mp4':
  (!reported||reported==='application/octet-stream')&&/\.webm$/i.test(name)?'video/webm':'';
 const sizeMB=Number.isFinite(size)?(size/1000000).toFixed(1):'unknown';
 const limitMB=(BEBO_VIDEO_MAX_BYTES/1000000).toFixed(1);
 if(!file||!Number.isFinite(size)||size<=0)
  return {valid:false,message:'Choose an MP4 or WebM video to upload.'};
 if(!mime)
  return {valid:false,message:'Bebo accepts MP4 or WebM video files. Select an MP4 from your phone, or convert your video to MP4.'};
 if(size>BEBO_VIDEO_MAX_BYTES)
  return {valid:false,message:'Your video is '+sizeMB+' MB, over the '+limitMB+' MB (40 MiB) upload limit. Please compress it or choose a smaller clip.'};
 return {valid:true,mime,message:name+' — '+sizeMB+' MB. Ready to check and upload for review.'};
}
export function createVideos(sb,{safe,panel,query}) {
 const bucket=()=>sb.storage.from('bebo-videos');
 const trim=(value,n)=>String(value??'').trim().slice(0,n);
 const cleanID=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'')?id:'';
 const link=p=>'<a href="#/u/'+encodeURIComponent(p.username)+'">'+safe(p.display_name||p.username)+'</a>';
 const date=value=>new Date(value).toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'});
 const moderated=ctx=>ctx?.adminAccess==='owner'||ctx?.adminAccess==='moderator';
 async function rows(table,make){return query(table,make)}
 async function names(ids){
  if(!ids.length)return new Map();
  const people=await rows('bebo_profiles',q=>q.select('id,username,display_name').in('id',ids));
  return new Map(people.map(p=>[p.id,p]));
 }
 async function metrics(videos){
  const ids=videos.map(v=>v.id);
  if(!ids.length||typeof sb.rpc!=='function')return new Map();
  const {data,error}=await sb.rpc('bebo_video_stats',{p_video_ids:ids.slice(0,40)});
  if(error){console.warn('Video analytics temporarily unavailable',error.message);return new Map();}
  return new Map((data||[]).map(item=>[item.video_id,item]));
 }
 const countMetric=(v,k)=>Number(v?.[k]||0);
 const statsLine=(v,id)=>{
  const count=countMetric(v,'views'),unique=countMetric(v,'unique_members');
  const hearts=countMetric(v,'hearts'),comments=countMetric(v,'comments');
  return '<div class="bebo-video-metrics" aria-label="Video engagement statistics">'+
   '<span>👁 <strong data-video-views="'+safe(id)+'">'+count+'</strong> member views</span>'+
   '<span>👥 '+unique+' unique members</span>'+
   '<span>♥ '+hearts+' hearts</span><span>💬 '+comments+' comments</span>'+
   '<span>📊 '+(count?Number(v.engagement_rate).toFixed(1)+'%':'—')+' interactions per view</span>'+
   '</div>';
 };
 async function signed(videos){
  const result=new Map();
  await Promise.all(videos.map(async video=>{
   const {data,error}=await bucket().createSignedUrl(video.object_path,600);
   if(!error&&data?.signedUrl)result.set(video.id,data.signedUrl);
  }));
  return result;
 }
 async function videoCards(videos,ctx,{pending=false,review=false}={}){
  if(!videos.length)return '<p class="muted">'+(review?'Nothing awaiting review.':pending?'You have no videos awaiting approval.':'No videos published yet. Be the first!')+'</p>';
  const ids=videos.map(x=>x.id);
  const authors=await names([...new Set(videos.map(x=>x.owner_id))]);
  const [urls,stats]=await Promise.all([signed(videos),metrics(videos)]);
  const liveIds=videos.filter(x=>x.status==='approved').map(x=>x.id);
  const [comments,hearts]=await Promise.all([
   liveIds.length?rows('bebo_video_comments',q=>q.select('id,video_id,author_id,body,created_at').in('video_id',liveIds).order('created_at',{ascending:false}).limit(120)):[],
   liveIds.length?rows('bebo_video_reactions',q=>q.select('video_id,member_id').in('video_id',liveIds).limit(500)):[]
  ]);
  const commentAuthors=await names([...new Set(comments.map(c=>c.author_id))]);
  const commentByVideo=new Map(),heartsByVideo=new Map();
  for(const comment of comments){const list=commentByVideo.get(comment.video_id)||[];list.push(comment);commentByVideo.set(comment.video_id,list);}
  for(const heart of hearts){const list=heartsByVideo.get(heart.video_id)||[];list.push(heart);heartsByVideo.set(heart.video_id,list);}
  return videos.map(v=>{
   const owner=authors.get(v.owner_id),own=ctx?.me?.id===v.owner_id;
   const permitted=v.status==='approved';
   const allComments=(commentByVideo.get(v.id)||[]).slice(0,5);
   const likes=heartsByVideo.get(v.id)||[];
   const liked=likes.some(x=>x.member_id===ctx?.me?.id);
   const measured=stats.get(v.id);
   const url=urls.get(v.id);
   return '<article class="bebo-video-card">'+
    '<div class="bebo-video-top"><div><h3>'+safe(v.title)+'</h3>'+
    '<p class="muted">🎬 '+(owner?link(owner):'Bebo member')+' · '+date(v.created_at)+'</p></div>'+
    '<span class="bebo-video-status '+safe(v.status)+'">'+
    (v.status==='approved'?'Public':v.status==='pending'?'Awaiting approval':'Not approved')+'</span></div>'+
    (url?'<video class="bebo-video-player" controls playsinline preload="metadata" controlsList="nodownload" data-bebo-video-id="'+safe(v.id)+'" src="'+safe(url)+'" aria-label="'+safe(v.title)+'"></video>':
     '<div class="bebo-video-unavailable">Video preview unavailable. Try refreshing.</div>')+
    (v.caption?'<p class="bebo-video-caption">'+safe(v.caption)+'</p>':'')+
    '<p class="muted">Up to 60 seconds · '+Math.ceil(v.size_bytes/1048576)+' MiB uploaded</p>'+statsLine(measured,v.id)+
    (permitted?'<div class="bebo-video-actions"><strong>♥ '+countMetric(measured,'hearts')+' hearts</strong> '+
      (ctx?.me?'<button class="button secondary" data-action="'+(liked?'video-unheart':'video-heart')+'" data-id="'+safe(v.id)+'">'+(liked?'Unlike':'♥ Luv this video')+'</button> '+
       (!own?'<button class="button secondary" data-action="video-report" data-id="'+safe(v.id)+'">Report</button>':''):
       '<a href="#/account">Sign in to react</a>')+
      (own?'<button class="button secondary" data-action="video-delete" data-id="'+safe(v.id)+'">Delete</button>':'')+
      '</div>'+
      '<div class="bebo-video-comments"><h4>Comments</h4>'+
      allComments.map(c=>'<p><strong>'+ (commentAuthors.get(c.author_id)?link(commentAuthors.get(c.author_id)):'Member')+'</strong>: '+safe(c.body)+
       (ctx?.me&&(c.author_id===ctx.me.id||moderated(ctx))?' <button class="button secondary" data-action="video-delete-comment" data-id="'+safe(c.id)+'">Remove</button>':'')+'</p>').join('')+
      (ctx?.me?'<form class="fields bebo-video-comment-form" data-form="video-comment">'+
        '<input type="hidden" name="video_id" value="'+safe(v.id)+'"><label>Leave a comment ♥<input name="body" maxlength="500" required placeholder="Say something kind"></label>'+
        '<button class="button" type="submit">Post comment</button></form>':'')+'</div>':
      '<div class="bebo-video-actions">'+
       (own?'<button class="button secondary" data-action="video-delete" data-id="'+safe(v.id)+'">Delete my video</button>':'')+
       (review&&v.status==='pending'?'<button class="button" data-action="video-approve" data-id="'+safe(v.id)+'">Approve &amp; publish</button> '+
          '<button class="button secondary" data-action="video-reject" data-id="'+safe(v.id)+'">Reject</button>':'')+
      '</div>')+
    '</article>';
  }).join('');
 }
 function uploadForm(){
  return '<form class="fields bebo-video-upload" data-form="video-upload">'+
    '<p><strong>New Bebo video ♥</strong> Choose your own clip. Every upload is reviewed by the Bebo owner before it becomes public.</p>'+
    '<label>Video title<input name="title" maxlength="100" required placeholder="My Bebo moment ♥"></label>'+
    '<label>Short caption<textarea name="caption" maxlength="500" rows="2" placeholder="Tell your friends about this clip"></textarea></label>'+
    '<label>Video (MP4 or WebM, max 40 MiB / 41.9 MB and 60 seconds)<input type="file" name="file" accept="video/mp4,video/webm,.mp4,.webm" required></label>'+
    '<p class="muted">Early-access upload limit: 3 videos per member, up to 2 per hour, and 15 clips across the pilot. Public video needs approval first. Videos use Bebo storage and bandwidth.</p>'+
    '<p class="bebo-video-upload-status" role="status" aria-live="polite"></p>'+
    '<button class="button" type="submit">Upload for review ♥</button>'+
    '</form>';
 }
 async function insightsPage(ctx){
  if(!ctx?.me?.id||!ctx.profile)return panel('Video Insights','<p><a href="#/account">Sign in</a> and create a profile to view your video statistics.</p>');
  const mine=await rows('bebo_videos',q=>q.select('id,title,status,created_at').eq('owner_id',ctx.me.id).order('created_at',{ascending:false}).limit(20));
  const stats=await metrics(mine);
  const total=key=>mine.reduce((n,v)=>n+countMetric(stats.get(v.id),key),0);
  const views=total('views'),hearts=total('hearts'),comments=total('comments');
  const insightCards=mine.map(video=>{
   const m=stats.get(video.id);
   return '<article class="bebo-video-insight-card"><h3>'+safe(video.title)+'</h3>'+
    '<p class="muted">'+(video.status==='approved'?'Public':video.status==='pending'?'Awaiting approval':'Not approved')+' · '+date(video.created_at)+'</p>'+
    statsLine(m,video.id)+
    '<p>Last 7 days: <strong>'+countMetric(m,'views_7d')+' member views</strong></p>'+
    '<p><a href="#/videos/u/'+encodeURIComponent(ctx.profile.username)+'">See your video »</a></p></article>';
  }).join('')||'<p>No video uploads yet. <a href="#/videos">Upload your first video »</a></p>';
  return panel('📊 My Bebo Video Insights',
   '<p>Real activity since tracking was introduced on 10 October 2026. Only signed-in members who meaningfully watch approved videos contribute counted views.</p>'+
   '<div class="bebo-video-insight-summary">'+
   '<div><strong>'+mine.length+'</strong><span>Videos</span></div>'+
   '<div><strong>'+views+'</strong><span>Member views</span></div>'+
   '<div><strong>'+total('views_7d')+'</strong><span>Views in 7 days</span></div>'+
   '<div><strong>'+hearts+'</strong><span>Hearts</span></div>'+
   '<div><strong>'+comments+'</strong><span>Comments</span></div>'+
   '</div>'+
   '<p>Average interactions per counted view: <strong>'+(views?(100*(hearts+comments)/views).toFixed(1)+'%':'—')+'</strong>. More than one interaction can happen per view.</p>'+
   insightCards+
   '<p class="muted">Bebo counts a maximum of one qualified view per signed-in member per clip per UTC day. Guest plays, simple page visits and historical plays are not included. Counts are not watch-hours or ad revenue.</p>'+
   '<p><a href="#/videos">← Back to Videos</a></p>');
 }
 async function route(path,ctx){
  if(path==='videos-insights')return insightsPage(ctx);
  if(path==='videos-review'){
   if(!moderated(ctx))return panel('Private video moderation','Only an approved Bebo moderator can review member videos.');
   const [pending,reports]=await Promise.all([
    rows('bebo_videos',q=>q.select('*').eq('status','pending').order('created_at',{ascending:true}).limit(25)),
    rows('bebo_video_reports',q=>q.select('id,video_id,reason,status,created_at').eq('status','open').order('created_at',{ascending:false}).limit(30))
   ]);
   const reported=reports.length?await rows('bebo_videos',q=>q.select('id,title,status,object_path,owner_id').in('id',[...new Set(reports.map(r=>r.video_id))])):[];
   const lookup=new Map(reported.map(x=>[x.id,x]));
   const reportHTML=reports.map(r=>'<div class="item"><strong>'+safe(lookup.get(r.video_id)?.title||'Deleted video')+'</strong> <span class="muted">'+date(r.created_at)+'</span>'+
     '<p>'+safe(r.reason)+'</p>'+
     (lookup.get(r.video_id)?.status==='approved'?'<button class="button secondary" data-action="video-reject" data-id="'+safe(r.video_id)+'">Hide reported video</button> ':'')+
     '<button class="button secondary" data-action="video-resolve-report" data-id="'+safe(r.id)+'">Mark reviewed</button></div>').join('');
   return panel('★ Bebo Videos · Owner Review','<p>Private review queue. Only approved videos appear in the public feed.</p>'+
     '<p><a href="#/videos">← Back to Videos</a></p>'+
     '<h3>Awaiting approval ('+pending.length+')</h3>'+await videoCards(pending,ctx,{review:true})+
     '<h3>Reported videos ('+reports.length+')</h3>'+(reportHTML||'<p>No open video reports.</p>'));
  }
  let profileName=null;
  if(path.startsWith('videos/u/'))profileName=decodeURIComponent(path.slice(9));
  let who=null;
  if(profileName){
   who=await rows('bebo_profiles',q=>q.select('id,username,display_name').ilike('username',profileName.replace(/[\%_]/g,'\\$&')).maybeSingle());
   if(!who)return panel('Video profile not found','This member does not have a Bebo profile.');
  }
  const videoList=await rows('bebo_videos',q=>{
   let request=q.select('*').eq('status','approved');
   if(who)request=request.eq('owner_id',who.id);
   return request.order('created_at',{ascending:false}).limit(20);
  });
  const own=ctx?.me&&(!who||who.id===ctx.me.id);
  const mine=own?await rows('bebo_videos',q=>q.select('*').eq('owner_id',ctx.me.id).neq('status','approved').order('created_at',{ascending:false}).limit(6)):[];
  const title=who?safe(who.display_name)+'’s Bebo videos':'♥ Bebo Videos';
  return panel(title,
    '<p>Real member videos stored in Bebo’s private video bucket. Clips become public only after owner approval.</p>'+
    (who?'<p><a href="#/u/'+encodeURIComponent(who.username)+'">← Back to profile</a> · <a href="#/videos">All Bebo videos</a></p>':'')+
    (ctx?.me?'<p><a class="button" href="#/videos-insights">📊 My Video Insights</a></p>':'')+
    (moderated(ctx)?'<p><a class="button" href="#/videos-review">★ Review uploads &amp; reports</a></p>':'')+
    (own?uploadForm()+'<h3>My pending / rejected videos</h3>'+await videoCards(mine,ctx,{pending:true}):'')+
    '<h3>Public videos</h3>'+await videoCards(videoList,ctx));
 }
 async function homePanel(ctx){
  // Show only approved videos in the home feed. No autoplay or fake views.
  const clips=await rows('bebo_videos',q=>q.select('id,title,owner_id,object_path,created_at,status')
   .eq('status','approved').order('created_at',{ascending:false}).limit(24));
  if(!clips.length)return panel('🔥 Trending on Bebo','<p>The first approved Bebo videos will appear here. <a href="#/videos">Visit Bebo Videos »</a></p>');
  const stats=await metrics(clips);
  const ranked=[...clips].sort((a,b)=>countMetric(stats.get(b.id),'ranking_score')-countMetric(stats.get(a.id),'ranking_score')||
    String(b.created_at).localeCompare(String(a.created_at))).slice(0,2);
  const [users,urls]=await Promise.all([names([...new Set(ranked.map(x=>x.owner_id))]),signed(ranked)]);
  const items=ranked.map((clip,index)=>{
   const user=users.get(clip.owner_id),m=stats.get(clip.id),url=urls.get(clip.id);
   return '<article class="bebo-home-video-item"><h3>'+(index===0?'★ Featured · ':'')+safe(clip.title)+'</h3>'+
     '<p class="muted">By '+(user?link(user):'Bebo member')+'</p>'+
     (url?'<video class="bebo-video-player" controls playsinline preload="metadata" data-bebo-video-id="'+safe(clip.id)+
      '" src="'+safe(url)+'" aria-label="'+safe(clip.title)+'"></video>':'')+
     statsLine(m,clip.id)+
     '<p><a href="#/videos">Watch and join the discussion »</a></p></article>';
  }).join('');
  return panel('🔥 Trending Bebo Videos ♥',items+
   '<p class="muted">Ranking: 2 × recent member views + 4 × hearts + 6 × comments + a small freshness bonus. Plays count once per signed-in member per day after meaningful playback. Rewatching, refreshing and anonymous plays do not add views. No paid boosts.</p>'+
   '<p><a href="#/videos">See all Bebo videos 🎬 »</a></p>');
 }
 async function profilePanel(who,ctx){
  const count=await rows('bebo_videos',q=>q.select('id').eq('owner_id',who.id).eq('status','approved').limit(20));
  const stats=await metrics(count);
  const memberViews=count.reduce((n,v)=>n+countMetric(stats.get(v.id),'views'),0);
  const label=safe(who.display_name)+'’s videos';
  return panel('🎬 My Bebo Videos ♥','<p>'+count.length+' published clip'+(count.length===1?'':'s')+' · '+memberViews+' counted member views</p>'+
    '<p><a href="#/videos/u/'+encodeURIComponent(who.username)+'">▶ View '+label+' »</a></p>'+
    (who.id===ctx?.me?.id?'<p><a href="#/videos">+ Upload a video</a></p>':''));
 }
 async function duration(file){
  return new Promise((resolve,reject)=>{
   const address=URL.createObjectURL(file);
   const element=document.createElement('video');
   let completed=false;
   const timeout=setTimeout(()=>finish(Error('Could not read video duration. Try another MP4 file.')),12000);
   function finish(err,value){
    if(completed)return;completed=true;
    clearTimeout(timeout);element.removeAttribute('src');element.load();URL.revokeObjectURL(address);
    if(err)reject(err);else resolve(value);
   }
   element.preload='metadata';
   element.onloadedmetadata=()=>{
    const n=element.duration;
    if(!Number.isFinite(n)||n<=0||n>60)finish(Error('Choose a video no longer than 60 seconds.'));
    else finish(null,Math.round(n*100)/100);
   };
   element.onerror=()=>finish(Error('This video could not be read. Try MP4 H.264 or WebM.'));
   element.src=address;
  });
 }
 async function form(type,d,ctx,formElement){
  if(!ctx?.me?.id)throw Error('Sign in to use Bebo Videos.');
  if(type==='video-comment'){
   const id=cleanID(trim(d.get('video_id'),36)),body=trim(d.get('body'),500);
   if(!id||!body)throw Error('Write a comment first.');
   await rows('bebo_video_comments',q=>q.insert({video_id:id,author_id:ctx.me.id,body}));
   return 'Your comment was posted ♥';
  }
  if(type!=='video-upload')throw Error('Unknown video form');
  if(!ctx?.profile)throw Error('Create a Bebo profile before uploading.');
  const file=d.get('file');
  if(!(file instanceof File))throw Error('Choose a video file first.');
  const checked=validateBeboVideoFile(file);
  if(!checked.valid)throw Error(checked.message);
  const title=trim(d.get('title'),100),caption=trim(d.get('caption'),500);
  if(!title)throw Error('Your video needs a title.');
  const status=formElement?.querySelector('.bebo-video-upload-status');
  if(status)status.textContent='Checking video length…';
  const seconds=await duration(file);
  const id=crypto.randomUUID();
  const path=ctx.me.id+'/'+id+(checked.mime==='video/mp4'?'.mp4':'.webm');
  if(status)status.textContent='Creating your private video entry…';
  await rows('bebo_videos',q=>q.insert({id,owner_id:ctx.me.id,object_path:path,
   title,caption,content_type:checked.mime,size_bytes:file.size,duration_seconds:seconds}));
  try{
   if(status)status.textContent='Uploading your video securely…';
   const {error}=await bucket().upload(path,file,{contentType:checked.mime,upsert:false,cacheControl:'600'});
   if(error)throw error;
  }catch(error){
   await bucket().remove([path]).catch(()=>{});
   await sb.from('bebo_videos').delete().eq('id',id).eq('owner_id',ctx.me.id);
   throw Error('Video upload failed: '+(error.message||'Please try again.'));
  }
  return 'Your video was uploaded! It is private until the Bebo owner approves it. ♥';
 }
 async function action(name,id,ctx){
  if(!ctx?.me?.id)throw Error('Sign in to interact with videos.');
  id=cleanID(id);if(!id)throw Error('Invalid Bebo video or comment.');
  if(name==='video-heart'){
   await rows('bebo_video_reactions',q=>q.insert({video_id:id,member_id:ctx.me.id}));
   return 'You sent Luv ♥';
  }
  if(name==='video-unheart'){
   await rows('bebo_video_reactions',q=>q.delete().eq('video_id',id).eq('member_id',ctx.me.id));
   return 'Your heart was removed.';
  }
  if(name==='video-delete-comment'){
   await rows('bebo_video_comments',q=>q.delete().eq('id',id));
   return 'Comment removed.';
  }
  if(name==='video-report'){
   const reason=prompt('Why should the Bebo owner review this video? (10–500 characters)');
   if(reason===null)return 'Report cancelled.';
   if(reason.trim().length<10||reason.trim().length>500)throw Error('Please enter 10 to 500 characters.');
   await rows('bebo_video_reports',q=>q.insert({video_id:id,reporter_id:ctx.me.id,reason:reason.trim()}));
   return 'Thanks, your report was sent to the Bebo moderation team.';
  }
  if(name==='video-delete'){
   const v=await rows('bebo_videos',q=>q.select('owner_id,object_path').eq('id',id).maybeSingle());
   if(!v||v.owner_id!==ctx.me.id)throw Error('Only the uploader can delete this video.');
   if(!confirm('Permanently delete this Bebo video and its comments?'))return 'Deletion cancelled.';
   const {error}=await bucket().remove([v.object_path]);
   if(error)throw error;
   await rows('bebo_videos',q=>q.delete().eq('id',id).eq('owner_id',ctx.me.id));
   return 'Your video was permanently removed.';
  }
  if(!moderated(ctx))throw Error('Approved moderators only.');
  if(name==='video-approve'||name==='video-reject'){
   const approve=name==='video-approve';
   if(!confirm(approve?'Approve this Bebo video for public viewing?':'Hide this Bebo video from public viewing?'))return 'Review cancelled.';
   const {data,error}=await sb.from('bebo_videos').update({status:approve?'approved':'rejected'}).eq('id',id)
    .select('id,status').maybeSingle();
   if(error)throw error;
   if(!data)throw Error('Video not found for moderation.');
   return approve?'Video approved and published ♥':'Video hidden from the public feed.';
  }
  if(name==='video-resolve-report'){
   const {data,error}=await sb.from('bebo_video_reports').update({status:'resolved'}).eq('id',id)
    .select('id').maybeSingle();
   if(error)throw error;
   if(!data)throw Error('Report could not be closed.');
   return 'Video report marked reviewed.';
  }
  throw Error('Unknown video action.');
 }
 return {route,homePanel,profilePanel,form,action,insightsPage,selectionHint:validateBeboVideoFile};
}
