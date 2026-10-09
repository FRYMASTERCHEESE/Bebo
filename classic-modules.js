// Original-era Bebo modules built as a secure, browser-based social experience.
// HTML is generated only from escaped member content; no arbitrary member scripts execute.
export function createClassic(sb,{safe,panel,btn,query}) {
  const db=(t,fn)=>query(t,fn);
  const clean=(v,n)=>String(v??'').trim().slice(0,n);
  const when=v=>new Date(v).toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'});
  const nickname=p=>safe(p?.display_name||'Bebo member');
  const link=p=>'<a href="#/u/'+encodeURIComponent(p.username)+'">'+nickname(p)+'</a>';
  const needMe=me=>{if(!me)throw Error('Log in to Bebo first.');};
  const allowedFile=f=>f instanceof File && f.size>0 && f.size<=5*1024*1024 && ['image/jpeg','image/png','image/webp'].includes(f.type);
  const fileExt=f=>({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[f.type]);
  const imgUrl=path=>sb.storage.from('bebo-photos').getPublicUrl(path).data.publicUrl;
  const postForm=(name,content,submit)=>'<form class="fields" data-form="'+name+'">'+content+'<button class="button">'+submit+'</button></form>';
  const teaser=(text,n)=>safe(String(text||'').slice(0,n))+(String(text||'').length>n?'…':'');
  function photoTile(p){return '<div class="classic-photo"><a href="'+safe(imgUrl(p.object_path))+'" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="'+safe(imgUrl(p.object_path))+'" alt="'+safe(p.caption||'Photo')+'"></a><div>'+teaser(p.caption,52)+'</div></div>';}
  async function publicModules(who,me){
    const [albums,blogs,other]=await Promise.all([
      db('bebo_albums',q=>q.select('id,title,created_at').eq('owner_id',who.id).order('created_at',{ascending:false}).limit(3)),
      db('bebo_blogs',q=>q.select('id,title,body,created_at').eq('owner_id',who.id).order('created_at',{ascending:false}).limit(3)),
      db('bebo_other_halves',q=>q.select('person_id,status').eq('owner_id',who.id).maybeSingle())
    ]);
    const accepted=other?.status==='accepted';
    const person=accepted?await db('bebo_profiles',q=>q.select('id,username,display_name').eq('id',other.person_id).maybeSingle()):null;
    const top=panel('♥ My Other Half',person?'<div class="other-half">♥ '+link(person)+'</div>':
      '<p class="muted">Not chosen yet…</p>');
    const albumList=albums.map(a=>'<div class="item"><a href="#/album/'+encodeURIComponent(a.id)+'">📸 '+safe(a.title)+'</a><span class="muted"> · '+when(a.created_at)+'</span></div>').join('');
    const blogList=blogs.map(b=>'<div class="item"><a href="#/blog/'+encodeURIComponent(b.id)+'"><strong>'+safe(b.title)+'</strong></a><p class="muted">'+when(b.created_at)+'</p><p>'+teaser(b.body,115)+'</p></div>').join('');
    const shortcuts='<p><a href="#/photos/'+encodeURIComponent(who.username)+'">View all photos »</a></p>';
    const blogShort='<p><a href="#/blogs/'+encodeURIComponent(who.username)+'">Read all blogs »</a></p>';
    const photos=panel('📸 My Photos',albumList||'<p class="muted">No photo albums yet.</p>'+shortcuts)+shortcuts;
    const blog=panel('✎ My Blog',blogList||'<p class="muted">No blog entries yet.</p>'+blogShort)+blogShort;
    const mail=me&&me.id!==who.id?'<p>'+btn('Send a private message ✉','classic-message-to',who.username,'secondary')+'</p>':'';
    return '<div class="classic-modules"><div>'+top+photos+'</div><div>'+blog+mail+'</div></div>';
  }
  async function albumsPage(me,username){
    const owner=username?await db('bebo_profiles',q=>q.select('id,username,display_name').eq('username',username).maybeSingle()):me?await db('bebo_profiles',q=>q.select('id,username,display_name').eq('id',me.id).maybeSingle()):null;
    if(!owner){
      const albums=await db('bebo_albums',q=>q.select('*').order('created_at',{ascending:false}).limit(30));
      return panel('📸 Bebo Photo Albums','<p>Remember looking through your mates’ albums? Explore what members are sharing.</p>'+
      (albums.map(a=>'<div class="item"><a href="#/album/'+a.id+'">📸 '+safe(a.title)+'</a><p class="muted">'+when(a.created_at)+'</p></div>').join('')||
      '<p class="muted">There are no public albums yet. Join Bebo to make the first one!</p>'));
    }
    const albums=await db('bebo_albums',q=>q.select('*').eq('owner_id',owner.id).order('created_at',{ascending:false}).limit(60));
    const mine=me?.id===owner.id;
    const make=mine?postForm('classic-album',
      '<label>Album name<input name="title" required maxlength="80" placeholder="Summer 2007 ♡"></label>'+
      '<label>Description<textarea name="description" maxlength="500"></textarea></label>',
      'Create photo album'):'';
    return panel('📸 '+nickname(owner)+' — Photo Albums',
      '<p><a href="#/u/'+encodeURIComponent(owner.username)+'">« Back to profile</a></p>'+
      (mine?make:'')+
      (albums.map(a=>'<div class="item"><strong><a href="#/album/'+a.id+'">'+safe(a.title)+'</a></strong>'+
        '<p>'+safe(a.description)+'</p><span class="muted">'+when(a.created_at)+'</span>'+
        (mine?btn('Delete album','classic-delete-album',a.id,'secondary'):'')+'</div>').join('')||
       '<p class="muted">No albums yet. Bebo photo albums are ready to create!</p>'));
  }
  async function albumPage(me,id){
    if(!/^[a-f0-9-]{36}$/i.test(id))return panel('Photo album','Album not found.');
    const album=await db('bebo_albums',q=>q.select('*').eq('id',id).maybeSingle());
    if(!album)return panel('Photo album','Album not found.');
    const owner=await db('bebo_profiles',q=>q.select('id,username,display_name').eq('id',album.owner_id).maybeSingle());
    const photos=await db('bebo_photos',q=>q.select('*').eq('album_id',id).order('created_at',{ascending:false}).limit(96));
    const mine=me?.id===album.owner_id;
    const form=mine && photos.length<96?postForm('classic-photo',
      '<input type="hidden" name="album_id" value="'+id+'">'+
      '<label>Upload a picture (JPG / PNG / WebP, up to 5MB)<input type="file" name="file" required accept="image/jpeg,image/png,image/webp"></label>'+
      '<label>Caption<input name="caption" maxlength="250"></label>', 'Add photo ♥'):'';
    return panel('📸 '+safe(album.title),
      '<p><a href="#/photos/'+encodeURIComponent(owner?.username||'')+'">« All albums</a> | By '+(owner?link(owner):'Member')+'</p>'+
      '<p>'+safe(album.description)+'</p>'+form+
      '<div class="classic-gallery">'+photos.map(p=>'<div>'+photoTile(p)+(mine?btn('Remove photo','classic-delete-photo',p.id,'secondary'):'')+'</div>').join('')+'</div>'+
      (!photos.length?'<p class="muted">Nothing in this album yet.</p>':'')+
      '<p class="muted">'+photos.length+' of 96 photos.</p>');
  }
  async function blogsPage(me,username){
    const who=username?await db('bebo_profiles',q=>q.select('id,username,display_name').eq('username',username).maybeSingle()):me?await db('bebo_profiles',q=>q.select('id,username,display_name').eq('id',me.id).maybeSingle()):null;
    if(!who){
      const entries=await db('bebo_blogs',q=>q.select('*').order('created_at',{ascending:false}).limit(30));
      return panel('✎ Bebo Blogs','<p>Blog Early, Blog Often — just like 2007.</p>'+
        (entries.map(b=>'<div class="item"><strong><a href="#/blog/'+b.id+'">'+safe(b.title)+'</a></strong><p>'+teaser(b.body,150)+'</p></div>').join('')||
        '<p class="muted">No blog entries yet. Sign up and write the first one.</p>'));
    }
    const blogs=await db('bebo_blogs',q=>q.select('*').eq('owner_id',who.id).order('created_at',{ascending:false}).limit(40));
    const mine=me?.id===who.id;
    const form=mine?postForm('classic-blog',
      '<label>Title<input name="title" maxlength="130" minlength="3" required placeholder="Dear Bebo..."></label>'+
      '<label>Blog entry<textarea name="body" maxlength="12000" minlength="10" required rows="6" placeholder="Today was absolutely mental..."></textarea></label>',
      'Publish my blog ♥'):'';
    return panel('✎ '+nickname(who)+' — Blog',
      '<p><a href="#/u/'+encodeURIComponent(who.username)+'">« Profile</a></p>'+form+
      (blogs.map(b=>'<div class="item"><h3 class="classic-entry"><a href="#/blog/'+b.id+'">'+safe(b.title)+'</a></h3>'+
      '<p class="muted">'+when(b.created_at)+'</p><p>'+teaser(b.body,240)+'</p>'+
      (mine?btn('Delete entry','classic-delete-blog',b.id,'secondary'):'')+'</div>').join('')||
      '<p class="muted">No blog entries yet.</p>'));
  }
  async function blogPage(me,id){
    if(!/^[a-f0-9-]{36}$/i.test(id))return panel('Blog','Entry not found.');
    const b=await db('bebo_blogs',q=>q.select('*').eq('id',id).maybeSingle());
    if(!b)return panel('Blog','Entry not found.');
    const [owner,comments]=await Promise.all([
      db('bebo_profiles',q=>q.select('id,username,display_name').eq('id',b.owner_id).maybeSingle()),
      db('bebo_blog_comments',q=>q.select('*').eq('blog_id',id).order('created_at',{ascending:true}).limit(80))
    ]);
    const authors=[...new Set(comments.map(x=>x.author_id))];
    const people=authors.length?await db('bebo_profiles',q=>q.select('id,username,display_name').in('id',authors)):[];
    const byId=new Map(people.map(p=>[p.id,p]));
    const form=me?postForm('classic-blog-comment','<input type="hidden" name="blog_id" value="'+id+'">'+
      '<label>Leave a comment<textarea name="body" maxlength="800" required></textarea></label>',
      'Post comment ♥'):'<p><a href="#/account">Log in</a> to comment.</p>';
    return panel(safe(b.title),'<p class="muted">By '+(owner?link(owner):'Member')+' · '+when(b.created_at)+'</p>'+
      '<p class="longtext">'+safe(b.body)+'</p><hr><h3>Comments ('+comments.length+')</h3>'+form+
      comments.map(c=>'<div class="item"><strong>'+(byId.has(c.author_id)?link(byId.get(c.author_id)):'Member')+'</strong> <small>'+when(c.created_at)+'</small><p>'+safe(c.body)+'</p>'+
      (me&&(me.id===c.author_id||me.id===b.owner_id)?btn('Delete','classic-delete-blog-comment',c.id,'secondary'):'')+'</div>').join(''));
  }
  async function otherHalfPage(me) {
    needMe(me);
    const [mine,incoming,friends]=await Promise.all([
      db('bebo_other_halves',q=>q.select('*').eq('owner_id',me.id).maybeSingle()),
      db('bebo_other_halves',q=>q.select('*').eq('person_id',me.id).eq('status','pending').limit(20)),
      db('bebo_friendships',q=>q.select('requester_id,addressee_id').eq('status','accepted').or('requester_id.eq.'+me.id+',addressee_id.eq.'+me.id))
    ]);
    const friendIDs=[...new Set(friends.map(f=>f.requester_id===me.id?f.addressee_id:f.requester_id))];
    const allIDs=[...new Set([...friendIDs,...incoming.map(x=>x.owner_id),...(mine?[mine.person_id]:[])])];
    const people=allIDs.length?await db('bebo_profiles',q=>q.select('id,username,display_name').in('id',allIDs)):[];
    const byID=new Map(people.map(x=>[x.id,x]));
    let info=mine?'<p>Your Other Half: '+(byID.has(mine.person_id)?link(byID.get(mine.person_id)):'Member')+' <strong>('+safe(mine.status)+')</strong></p>'+
      btn('Remove / cancel my Other Half','classic-remove-half',me.id,'secondary'):'<p>Choose someone important — your Other Half has a special spot on your profile!</p>';
    if(!mine&&friendIDs.length){
      info+=postForm('classic-request-half','<label>Choose an accepted friend<select name="person_id">'+friendIDs.map(id=>'<option value="'+id+'">'+nickname(byID.get(id))+'</option>').join('')+'</select></label>','Ask to be my Other Half ♥');
    }
    info+=incoming.map(x=>'<div class="item"><strong>'+(byID.has(x.owner_id)?link(byID.get(x.owner_id)):'Someone')+
      '</strong> wants you to be their Other Half ♥ '+btn('Accept ♥','classic-accept-half',x.owner_id)+btn('Decline','classic-reject-half',x.owner_id,'secondary')+'</div>').join('');
    return panel('♥ Other Half',info);
  }
  async function messagesPage(me,personUsername) {
    needMe(me);
    const [inbox,sent]=await Promise.all([
      db('bebo_mail',q=>q.select('*').eq('recipient_id',me.id).order('created_at',{ascending:false}).limit(50)),
      db('bebo_mail',q=>q.select('*').eq('sender_id',me.id).order('created_at',{ascending:false}).limit(25))
    ]);
    const allIDs=[...new Set([...inbox.map(x=>x.sender_id),...sent.map(x=>x.recipient_id)])];
    const people=allIDs.length?await db('bebo_profiles',q=>q.select('id,username,display_name').in('id',allIDs)):[];
    const byID=new Map(people.map(x=>[x.id,x]));
    const composer=postForm('classic-mail',
      '<label>To (Bebo username)<input name="recipient" maxlength="25" pattern="[a-z0-9_]{3,25}" required value="'+safe(personUsername||'')+'" placeholder="your_mate"></label>'+
      '<label>Subject<input name="subject" required maxlength="120" placeholder="heyyy ♥"></label>'+
      '<label>Message<textarea name="body" required maxlength="4000" rows="4" placeholder="Write something..."></textarea></label>',
      'Send private message ✉');
    const entries=(xs,personID)=>xs.map(m=>'<div class="item"><strong>'+safe(m.subject)+'</strong>'+
      '<p class="muted">'+(byID.has(m[personID])?link(byID.get(m[personID])):'Member')+' · '+when(m.created_at)+'</p>'+
      '<p class="longtext">'+safe(m.body)+'</p></div>').join('');
    return panel('✉ My Bebo Mail',composer+
      '<div class="classic-mail-grid"><div><h3>Inbox ('+inbox.length+')</h3>'+(entries(inbox,'sender_id')||'<p class="muted">No new mail.</p>')+
      '</div><div><h3>Sent Mail</h3>'+(entries(sent,'recipient_id')||'<p class="muted">You have not sent any messages.</p>')+'</div></div>');
  }
  async function groupsPage(me) {
    const groups=await db('bebo_groups',q=>q.select('*').order('created_at',{ascending:false}).limit(45));
    const mine=me?await db('bebo_group_members',q=>q.select('group_id').eq('member_id',me.id)):[];
    const membership=new Set(mine.map(x=>x.group_id));
    const form=me?postForm('classic-group',
      '<label>Group name<input name="name" required minlength="3" maxlength="75" placeholder="The Bebo Crew ♥"></label>'+
      '<label>About the group<textarea name="description" maxlength="900"></textarea></label>','Create a group'):'';
    const listing=groups.map(g=>'<div class="item"><strong>★ '+safe(g.name)+'</strong>'+
      '<p>'+safe(g.description)+'</p>'+
      (me?(membership.has(g.id)?btn('Leave group','classic-leave-group',g.id,'secondary'):btn('Join group ♥','classic-join-group',g.id)):'<p class="muted">Sign in to join</p>')+
      (me?.id===g.owner_id?btn('Delete group','classic-delete-group',g.id,'danger'):'')+'</div>').join('');
    return panel('★ Bebo Groups', '<p>Find your people. Create a group for your mates, music or shared interests.</p>'+form+(listing||'<p class="muted">No groups yet — start the first!</p>'));
  }
  async function route(page,me) {
    if(page.startsWith('photos/'))return albumsPage(me,decodeURIComponent(page.slice(7)));
    if(page==='photos')return albumsPage(me,null);
    if(page.startsWith('album/'))return albumPage(me,page.slice(6));
    if(page.startsWith('blogs/'))return blogsPage(me,decodeURIComponent(page.slice(6)));
    if(page==='blogs')return blogsPage(me,null);
    if(page.startsWith('blog/'))return blogPage(me,page.slice(5));
    if(page==='other-half')return otherHalfPage(me);
    if(page.startsWith('messages'))return messagesPage(me,page.startsWith('messages/')?decodeURIComponent(page.slice(9)):'');
    if(page==='groups')return groupsPage(me);
    return panel('Bebo Classic','Page not found.');
  }
  async function form(type,d,ctx) {
    const me=ctx.me;needMe(me);
    if(type==='classic-album'){
      await db('bebo_albums',q=>q.insert({owner_id:me.id,title:clean(d.get('title'),80),description:clean(d.get('description'),500)}));
      return 'Your new photo album is ready ♥';
    }
    if(type==='classic-photo'){
      const file=d.get('file'),albumID=clean(d.get('album_id'),36);
      if(!allowedFile(file))throw Error('Choose a JPG, PNG or WebP picture under 5MB.');
      const album=await db('bebo_albums',q=>q.select('id,owner_id').eq('id',albumID).maybeSingle());
      if(!album||album.owner_id!==me.id)throw Error('Album not owned by this member.');
      const old=await sb.from('bebo_photos').select('id',{count:'exact',head:true}).eq('album_id',albumID);
      if(old.error)throw old.error;if((old.count||0)>=96)throw Error('Albums can have 96 photos maximum.');
      const path=me.id+'/'+crypto.randomUUID()+'.'+fileExt(file);
      const upload=await sb.storage.from('bebo-photos').upload(path,file,{contentType:file.type,upsert:false});
      if(upload.error)throw upload.error;
      try {
        await db('bebo_photos',q=>q.insert({album_id:albumID,owner_id:me.id,object_path:path,caption:clean(d.get('caption'),250)}));
      }catch(e){await sb.storage.from('bebo-photos').remove([path]);throw e;}
      return 'Your photo was uploaded ♥';
    }
    if(type==='classic-blog'){
      await db('bebo_blogs',q=>q.insert({owner_id:me.id,title:clean(d.get('title'),130),body:clean(d.get('body'),12000)}));
      return 'Blog entry published ♥';
    }
    if(type==='classic-blog-comment'){
      await db('bebo_blog_comments',q=>q.insert({blog_id:clean(d.get('blog_id'),36),author_id:me.id,body:clean(d.get('body'),800)}));
      return 'Blog comment posted ♥';
    }
    if(type==='classic-request-half'){
      const other=clean(d.get('person_id'),36);
      await db('bebo_other_halves',q=>q.insert({owner_id:me.id,person_id:other,status:'pending'}));
      return 'Other Half request sent ♥';
    }
    if(type==='classic-mail'){
      const recipient=clean(d.get('recipient'),25).toLowerCase();
      const p=await db('bebo_profiles',q=>q.select('id').eq('username',recipient).maybeSingle());
      if(!p)throw Error('That Bebo username does not exist.');
      await db('bebo_mail',q=>q.insert({sender_id:me.id,recipient_id:p.id,subject:clean(d.get('subject'),120),body:clean(d.get('body'),4000)}));
      return 'Private message sent ✉';
    }
    if(type==='classic-group'){
      await db('bebo_groups',q=>q.insert({owner_id:me.id,name:clean(d.get('name'),75),description:clean(d.get('description'),900)}));
      return 'Group created ♥';
    }
    throw Error('Unrecognized form.');
  }
  async function action(name,id,ctx){
    const me=ctx.me;needMe(me);
    if(name==='classic-message-to'){location.hash='#/messages/'+encodeURIComponent(id);return 'Write a message to your mate ♥';}
    if(name==='classic-delete-album'){
      if(!confirm('Delete this album? Delete its individual photos first.'))return 'Cancelled.';
      const pics=await db('bebo_photos',q=>q.select('id').eq('album_id',id).limit(1));
      if(pics.length)throw Error('Remove pictures before deleting this album.');
      await db('bebo_albums',q=>q.delete().eq('id',id).eq('owner_id',me.id));
      return 'Album removed.';
    }
    if(name==='classic-delete-photo'){
      const p=await db('bebo_photos',q=>q.select('owner_id,object_path').eq('id',id).maybeSingle());
      if(!p||p.owner_id!==me.id)throw Error('Cannot delete this picture.');
      if(!confirm('Remove this photo from Bebo?'))return 'Cancelled.';
      const {error}=await sb.storage.from('bebo-photos').remove([p.object_path]);
      if(error)throw error;
      await db('bebo_photos',q=>q.delete().eq('id',id).eq('owner_id',me.id));
      return 'Photo removed.';
    }
    if(name==='classic-delete-blog'){
      if(!confirm('Delete this blog entry and its comments?'))return 'Cancelled.';
      await db('bebo_blogs',q=>q.delete().eq('id',id).eq('owner_id',me.id));
      return 'Blog entry removed.';
    }
    if(name==='classic-delete-blog-comment'){
      await db('bebo_blog_comments',q=>q.delete().eq('id',id));
      return 'Comment removed.';
    }
    if(name==='classic-remove-half'||name==='classic-reject-half'){
      const owner=name==='classic-remove-half'?me.id:id;
      await db('bebo_other_halves',q=>q.delete().eq('owner_id',owner));
      return 'Other Half cleared.';
    }
    if(name==='classic-accept-half'){
      await db('bebo_other_halves',q=>q.update({status:'accepted'}).eq('owner_id',id).eq('person_id',me.id));
      return 'Other Half request accepted ♥';
    }
    if(name==='classic-join-group'){
      await db('bebo_group_members',q=>q.insert({group_id:id,member_id:me.id}));
      return 'You joined the group ♥';
    }
    if(name==='classic-leave-group'){
      await db('bebo_group_members',q=>q.delete().eq('group_id',id).eq('member_id',me.id));
      return 'You left the group.';
    }
    if(name==='classic-delete-group'){
      if(!confirm('Delete this group and its memberships?'))return 'Cancelled.';
      await db('bebo_groups',q=>q.delete().eq('id',id).eq('owner_id',me.id));
      return 'Group deleted.';
    }
    throw Error('Unknown classic action.');
  }
  return {publicModules,route,form,action};
}
