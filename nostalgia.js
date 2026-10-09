// Shared 2000s profile features for the independently operated Bebo website.
// Every database write is protected by server-side RLS or a user-scoped RPC.
// Raw member HTML, custom script skins, legacy Flash and unsafe embeds are never executed.
export function createRetro(sb, helpers) {
  const { safe, panel, btn, query } = helpers;
  let canvasStrokes = [];
  let drawing = null;
  let drawTarget = null;
  const hex = s => /^#[0-9a-fA-F]{6}$/.test(s || '');
  const clamp = (s,n) => String(s == null ? '' : s).trim().slice(0,n);
  const db = (table, fn) => query(table, fn);
  const nowUTC = () => new Date().toISOString().slice(0,10);
  const errorText = e => String(e && e.message || 'Unable to save this yet').slice(0,230);
  const isImage = f => f instanceof File && f.size > 0 && f.size <= 5*1024*1024 &&
    ['image/jpeg','image/png','image/webp'].includes(f.type);
  const imgExt = f => ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[f.type];
  function audioUrl(url) {
    try {
      const u = new URL(url);
      if(u.protocol !== 'https:' || u.username || u.password || !u.hostname.includes('.')) return '';
      if (!/\.(mp3|ogg|wav|m4a|aac|webm)$/i.test(u.pathname)) return '';
      return u.href;
    } catch { return ''; }
  }
  function otherLink(url) {
    try {
      const u = new URL(url);
      return u.protocol === 'https:' && u.hostname.includes('.') && !u.username && !u.password ? u.href : '';
    } catch { return ''; }
  }
  function youtubeId(text) {
    const input = clamp(text,500);
    if (!input) return '';
    try {
      const u = new URL(input);
      const host=u.hostname.toLowerCase();
      let id='';
      if (host==='youtu.be' || host==='www.youtu.be') id=u.pathname.split('/')[1];
      else if (['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)) {
        if(u.pathname==='/watch') id=u.searchParams.get('v') || '';
        else if (/^\/(embed|shorts)\/[A-Za-z0-9_-]{11}$/.test(u.pathname)) id=u.pathname.split('/')[2];
      }
      return /^[a-zA-Z0-9_-]{11}$/.test(id || '') ? id : '';
    } catch { return ''; }
  }
  function imageStyle(who, fallback) {
    const path=who && who.skin_banner_path || '';
    if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(path)) return fallback;
    const url=sb.storage.from('bebo-skin-banners').getPublicUrl(path).data.publicUrl;
    return 'linear-gradient(0deg,rgba(42,0,31,.45),rgba(42,0,31,.12)),url("' + url + '") center / cover';
  }
  async function uploadBanner(file,uid) {
    if(!file || !file.size) return '';
    if(!isImage(file)) throw Error('Skin banner must be PNG, JPG or WebP under 5 MB.');
    const path=uid+'/'+crypto.randomUUID()+'.'+imgExt(file);
    const {error}=await sb.storage.from('bebo-skin-banners').upload(path,file,{contentType:file.type,upsert:false});
    if(error) throw error;
    return path;
  }
  async function sharedPanel(who,me) {
    const [top,luv,boards]=await Promise.all([
      db('bebo_top_friends',q=>q.select('friend_id,position').eq('owner_id',who.id).order('position').limit(16)),
      sb.from('bebo_luv').select('id',{count:'exact',head:true}).eq('recipient_id',who.id),
      db('bebo_whiteboards',q=>q.select('id,author_id,strokes,created_at').eq('profile_id',who.id).order('created_at',{ascending:false}).limit(7))
    ]);
    if(luv.error) throw luv.error;
    const own=me && me.id===who.id;
    const ids=top.map(t=>t.friend_id);
    const names=ids.length?await db('bebo_profiles',q=>q.select('id,username,display_name').in('id',ids)):[];
    const byId=new Map(names.map(x=>[x.id,x]));
    let topHTML='<div class="top16">';
    top.forEach((f,i)=>{
      const p=byId.get(f.friend_id);
      if(p) topHTML+='<div class="top-slot"><a href="#/u/'+encodeURIComponent(p.username)+'"><span class="top-initial">'+safe(p.display_name.slice(0,1))+'</span>'+safe(p.display_name)+'</a>'+
      (own?'<div class="actions small">'+btn('↑','retro-top-up',String(i),'secondary')+btn('↓','retro-top-down',String(i),'secondary')+btn('×','retro-top-remove',f.friend_id,'secondary')+'</div>':'')+'</div>';
    });
    topHTML+='</div>';
    if(!top.length) topHTML='<p class="muted">No Top Friends yet. Add a friend to start your Top 16 ♥</p>';
    if(own){
      const friendship=await db('bebo_friendships',q=>q.select('requester_id,addressee_id').eq('status','accepted').or('requester_id.eq.'+me.id+',addressee_id.eq.'+me.id));
      const availableIDs=[...new Set(friendship.map(x=>x.requester_id===me.id?x.addressee_id:x.requester_id))].filter(id=>!ids.includes(id));
      const available=availableIDs.length?await db('bebo_profiles',q=>q.select('id,display_name').in('id',availableIDs)):[];
      if(top.length<16 && available.length) topHTML+='<div class="inlineform"><select id="top-choice" class="field"><option value="">Choose a friend…</option>'+available.map(p=>'<option value="'+safe(p.id)+'">'+safe(p.display_name)+'</option>').join('')+'</select>'+btn('Add to Top 16','retro-top-add')+'</div>';
      if(!available.length) topHTML+='<p class="muted">Accept friend requests to add people here.</p>';
    }
    const given=me?await sb.from('bebo_luv').select('id',{count:'exact',head:true}).eq('sender_id',me.id).eq('gifted_date',nowUTC()):{count:0,error:null};
    if(given.error) throw given.error;
    const luvHTML='<p class="big-luv">♥ '+String(luv.count||0)+' Luv received</p>'+
      (me&&!own?'<p class="muted">You have '+Math.max(0,3-(given.count||0))+' of your 3 daily Luv left (resets 00:00 UTC).</p>'+btn('Send Luv ♥','retro-luv',who.id):'<p class="muted">Give your mates three Luv a day, just like the old days.</p>');
    const music=audioUrl(who.music_url);
    const flash=/^[a-zA-Z0-9_-]{11}$/.test(who.flashbox_video_id||'')?who.flashbox_video_id:'';
    const media=panel('Profile Music ♫',music?'<p>'+safe(who.music||'My song')+'</p><audio controls preload="none" src="'+safe(music)+'"></audio><p class="muted">Press play to listen. Browsers often block automatic sound.</p>':
      '<p class="muted">'+safe(who.music||'No song chosen yet.')+'</p>')+
      panel('My Flashbox ▶',flash?'<div class="video-frame"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/'+flash+'" title="Profile YouTube video" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>':
      '<p class="muted">No video added. Members can share a YouTube video here.</p>');
    const ownerNames=[...new Set(boards.map(b=>b.author_id))];
    const authors=ownerNames.length?await db('bebo_profiles',q=>q.select('id,display_name,username').in('id',ownerNames)):[];
    const authorsMap=new Map(authors.map(a=>[a.id,a]));
    const previews=boards.map(b=>{
      const a=authorsMap.get(b.author_id);
      return '<div class="item"><strong>'+safe(a?.display_name||'Bebo member')+'</strong> <span class="muted">'+safe(new Date(b.created_at).toLocaleDateString())+'</span>'+
      '<canvas class="drawing-preview" width="450" height="180" data-strokes="'+safe(JSON.stringify(b.strokes))+'" aria-label="Whiteboard drawing"></canvas>'+
      (me&&(own||me.id===b.author_id)?btn('Remove drawing','retro-delete-board',b.id,'secondary'):'')+
      '</div>';
    }).join('');
    const boardForm=me?'<form class="fields" data-form="retro-whiteboard"><div class="drawing-tools"><label>Pen <input id="draw-colour" type="color" value="#c52d61" aria-label="Pen colour"></label>'+
      '<button type="button" class="button secondary" data-action="retro-clear">Clear</button></div>'+
      '<canvas id="bebo-draw" width="450" height="180" aria-label="Draw a whiteboard message using touch or mouse"></canvas>'+
      '<button class="button">Post my drawing ♥</button></form>':'<p><a href="#/account">Log in</a> to draw on this Whiteboard.</p>';
    return '<section class="retro-grid"><div>'+
      panel('My Top 16 Friends ♥',topHTML)+panel('Daily Luv ♥',luvHTML)+media+
      '</div><div>'+panel('My Whiteboard ✎',boardForm+'<hr>'+ (previews||'<p class="muted">Be the first to leave a doodle!</p>'))+'</div></section>';
  }
  async function replaceTop(me,transform) {
    const current=await db('bebo_top_friends',q=>q.select('friend_id,position').eq('owner_id',me.id).order('position'));
    const ids=current.map(x=>x.friend_id);
    const next=transform(ids);
    const {error}=await sb.rpc('bebo_set_top_friends',{p_friends:next});
    if(error) throw error;
    return 'Your Top 16 has been updated ♥';
  }
  function parseOptions(str) {
    const arr=String(str||'').split('\n').map(x=>x.trim()).filter(Boolean);
    if(arr.length<2 || arr.length>4 || arr.some(x=>x.length>100))throw Error('Add 2 to 4 choices, each under 100 characters.');
    return arr;
  }
  /* Retro poll/quiz pages. Keep database formats and existing public links unchanged. */
  const pollQuizExamples=Object.freeze({
    poll:{question:'Which classic Bebo feature do you miss most?',options:['Profile skins','Top 16 friends','Daily Luv','Whiteboards']},
    quiz:{question:'What year did Bebo first launch?',options:['2003','2005','2007','2010'],correct:2}
  });
  function updatePollPreview(form){
    const target=form.querySelector('.retro-composer-preview');
    if(!target)return;
    const question=String(form.querySelector('[name="question"]')?.value||'').trim();
    const options=String(form.querySelector('[name="options"]')?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,4);
    const quiz=form.dataset.form==='retro-quiz-create';
    const correct=Number(form.querySelector('[name="correct"]')?.value||1);
    target.innerHTML='<p class="retro-preview-heading">★ Live preview — this is what friends will see</p>'+
      '<h4>'+safe(question||'Your question will appear here ♥')+'</h4>'+
      '<div class="retro-preview-choices">'+(options.length?
        options.map((opt,i)=>'<div class="retro-preview-choice">'+
          '<span class="retro-preview-circle">'+(i+1)+'</span><span>'+safe(opt)+'</span>'+
          (quiz&&correct===i+1?'<span class="retro-preview-correct">✓ Correct</span>':'')+'</div>').join(''):
        '<p class="muted">Add 2–4 choices, one on each line.</p>')+
      '</div>';
  }
  function initPollPreviews(){
    document.querySelectorAll('.retro-play-form').forEach(form=>{
      if(form.dataset.previewReady)return;
      form.dataset.previewReady='1';
      for(const event of ['input','change'])form.addEventListener(event,()=>updatePollPreview(form));
      updatePollPreview(form);
    });
  }
  function fillPollExample(quiz){
    const form=document.querySelector('.retro-play-form');
    if(!form)return false;
    const preset=pollQuizExamples[quiz?'quiz':'poll'];
    form.elements.namedItem('question').value=preset.question;
    form.elements.namedItem('options').value=preset.options.join('\n');
    if(quiz&&form.elements.namedItem('correct'))form.elements.namedItem('correct').value=preset.correct;
    updatePollPreview(form);
    return true;
  }
  async function listPolls(me,quiz=false) {
    const table=quiz?'bebo_quizzes':'bebo_polls';
    const votesTable=quiz?'bebo_quiz_answers':'bebo_poll_votes';
    const list=await db(table,q=>q.select('*').order('created_at',{ascending:false}).limit(20));
    const ids=list.map(p=>p.id);
    const answers=ids.length?await db(votesTable,q=>q.select('*').in(quiz?'quiz_id':'poll_id',ids)):[];
    const authorsIDs=[...new Set(list.map(p=>p.owner_id).filter(Boolean))];
    const authors=authorsIDs.length?await db('bebo_profiles',q=>q.select('id,username,display_name').in('id',authorsIDs)):[];
    const authorMap=new Map(authors.map(p=>[p.id,p]));
    const word=quiz?'quiz':'poll';
    const headline=quiz?'How Well Do You Know Me?':'Bebo Polls';
    const subline=quiz?'Think you know your mates? Create a quiz, choose the right answer and challenge everyone!':
      'Vote for your favourites, settle a debate and see what everyone thinks!';
    const image=quiz?'❓':'♥';
    const navigation='<nav class="retro-play-tabs" aria-label="Bebo games">'+
      '<a href="#/polls"'+(!quiz?' aria-current="page"':'')+'>♥ Bebo Polls</a>'+
      '<a href="#/quizzes"'+(quiz?' aria-current="page"':'')+'>❓ My Quizzes</a>'+
      '<a href="#/skins">🎨 Profile Skins</a>'+
      '</nav>';
    const header='<header class="retro-play-header">'+
      '<div class="retro-play-sparkle" aria-hidden="true">★</div>'+
      '<div class="retro-play-heading"><span>★ Old School Bebo ★</span>'+
      '<h1>'+image+' '+headline+' '+image+'</h1><p>'+subline+'</p></div>'+
      '<span class="retro-play-hearts" aria-hidden="true">♥ ✦ ♥</span></header>';
    const form='<form class="fields retro-play-form" data-form="'+(quiz?'retro-quiz-create':'retro-poll-create')+'">'+
      '<label class="retro-play-label" for="retro-play-question">Your question ♥'+
      '<input id="retro-play-question" name="question" required maxlength="180" minlength="5" placeholder="'+
      (quiz?'How well do your friends know you?':'What is your favourite Bebo memory?')+'" autocomplete="off"></label>'+
      '<label class="retro-play-label" for="retro-play-options">Answer choices <span class="muted">(2–4, one per line)</span>'+
      '<textarea id="retro-play-options" name="options" required maxlength="405" rows="5" placeholder="First choice&#10;Second choice&#10;Third choice&#10;Fourth choice"></textarea></label>'+
      (quiz?'<label class="retro-play-label" for="retro-play-correct">Which one is correct?'+
      '<select id="retro-play-correct" name="correct" required>'+
      [1,2,3,4].map(n=>'<option value="'+n+'">Answer '+n+'</option>').join('')+
      '</select></label>':'')+
      '<div class="retro-composer-preview" aria-live="polite"></div>'+
      '<div class="retro-play-compose-actions">'+
        '<button class="button" type="submit">♥ Publish My '+(quiz?'Quiz':'Poll')+'</button>'+
        '<button type="button" class="button secondary" data-action="retro-play-example" data-id="'+(quiz?'quiz':'poll')+'">★ Try an example</button>'+
      '</div><p class="retro-play-hint">Your '+word+' will be shared with Bebo members. The example button only fills the form — it does not publish anything.</p></form>';
    const compose=panel('✎ Create Your Own '+(quiz?'Quiz':'Poll')+' ♥',
      me?form:'<div class="retro-play-signup"><p>Sign in or make a free Bebo profile to create a '+word+' and join in!</p>'+
      '<a href="#/account" class="button">♥ Join Bebo / Log In</a></div>');
    const cards=list.map(p=>{
      const votes=answers.filter(v=>v[quiz?'quiz_id':'poll_id']===p.id);
      const mine=me?votes.find(v=>v.voter_id===me.id):null;
      const options=Array.isArray(p.options)?p.options.slice(0,4):[];
      const count=votes.length;
      const by=authorMap.get(p.owner_id);
      const byline=by?'<a href="#/u/'+encodeURIComponent(by.username)+'">'+safe(by.display_name)+'</a>':'Bebo member';
      const bydate=p.created_at?new Date(p.created_at).toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'}):'';
      const reveal=!quiz||Boolean(mine); // Do not reveal the right quiz answer before the visitor votes.
      const choices=options.map((option,i)=>{
        const total=votes.filter(v=>v.choice===i).length;
        const percent=count?Math.round(total/count*100):0;
        const chosen=mine?.choice===i;
        const isCorrect=quiz&&reveal&&p.correct_choice===i;
        const marker='<span class="retro-choice-number">'+(i+1)+'</span>';
        const label='<span class="retro-choice-text">'+safe(option)+'</span>';
        const answer=!mine&&me?
          '<button type="button" class="retro-choice-vote" data-action="retro-'+(quiz?'quiz-answer':'poll-vote')+'" data-id="'+safe(p.id)+':'+i+'" aria-label="Vote '+safe(option)+'">'+marker+label+'<span aria-hidden="true">♥</span></button>':
          '<div class="retro-choice-label">'+marker+label+
            (chosen?'<span class="retro-choice-you">Your choice ♥</span>':'')+
            (isCorrect?'<span class="retro-choice-correct">✓ Correct</span>':'')+'</div>';
        const score=reveal?'<div class="retro-result-track" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+percent+'" aria-label="'+safe(option)+' '+percent+' percent">'+
          '<span class="retro-result-fill" style="width:'+percent+'%"></span></div>'+
          '<span class="retro-result-number">'+percent+'% · '+total+' vote'+(total===1?'':'s')+'</span>':'';
        return '<div class="retro-ballot-choice'+(chosen?' retro-ballot-picked':'')+'">'+answer+score+'</div>';
      }).join('');
      const outcome=mine&&quiz?
        '<p class="retro-ballot-feedback '+(mine.choice===p.correct_choice?'retro-ballot-right':'retro-ballot-wrong')+'">'+
          (mine.choice===p.correct_choice?'♥ You got it right!':'Not quite this time — try another quiz!')+'</p>':
        mine?'<p class="retro-ballot-feedback retro-ballot-right">♥ Your vote was saved!</p>':
        !me?'<p class="retro-ballot-guest"><a href="#/account">Log in to '+(quiz?'answer this quiz':'vote in this poll')+' ♥</a></p>':'';
      return '<article class="retro-ballot-card"><div class="retro-ballot-title"><span class="retro-ballot-stamp">'+(quiz?'❓ QUIZ':'♥ POLL')+'</span>'+
         '<h3>'+safe(p.question)+'</h3></div>'+
         '<div class="retro-ballot-meta">By '+byline+(bydate?' · '+safe(bydate):'')+
         ' · '+count+' '+(quiz?'answer':'vote')+(count===1?'':'s')+'</div>'+
         '<div class="retro-ballot-choices">'+choices+'</div>'+outcome+
         (me?.id===p.owner_id?
            '<div class="retro-ballot-owner">'+btn('Delete '+word,'retro-'+(quiz?'quiz-delete':'poll-delete'),p.id,'secondary')+'</div>':'')+
         '</article>';
    }).join('');
    const feed=list.length?cards:
      '<div class="retro-play-empty"><span aria-hidden="true">'+(quiz?'❓ ★ ♥':'♥ ★ ♥')+'</span>'+
      '<h3>No '+(quiz?'quizzes':'polls')+' yet!</h3>'+
      '<p>Be the first to start something fun. Your question could become the next Bebo favourite.</p>'+
      (me?'<a href="#retro-create" class="retro-play-start">✎ Create the first '+word+' ♥</a>':
       '<a href="#/account" class="retro-play-start">♥ Join Bebo to get started</a>')+'</div>';
    return '<div class="retro-play-page">'+header+navigation+
      '<div class="retro-play-columns"><div class="retro-play-feed">'+
        panel((quiz?'❓ Latest Bebo Quizzes':'♥ Latest Bebo Polls')+' <span class="retro-play-counter">'+list.length+'</span>',feed)+
      '</div><aside id="retro-create" class="retro-play-compose">'+compose+
        panel('★ How It Works', '<ol class="retro-play-how">'+
          '<li>Write a fun question about yourself or your mates.</li>'+
          '<li>Add 2–4 different answers.'+(quiz?' Pick the correct one.':'')+'</li>'+
          '<li>Publish it and share it with your Bebo friends ♥</li>'+
        '</ol><p class="muted">A Bebo member can answer each question once.</p>')+
      '</aside></div></div>';
  }
  async function creatorPage(me) {
    const posts=await db('bebo_creations',q=>q.select('*').order('created_at',{ascending:false}).limit(30));
    const ids=[...new Set(posts.map(p=>p.author_id))];
    const authors=ids.length?await db('bebo_profiles',q=>q.select('id,username,display_name').in('id',ids)):[];
    const map=new Map(authors.map(x=>[x.id,x]));
    let html=panel('Bebo Bands & Authors ★','<p>Discover original songs, artists, stories and writing from Bebo members.</p>'+
      (me?'<form class="fields" data-form="retro-creation"><label>Share as<select name="kind"><option value="band">Band / musician</option><option value="author">Author / blogger</option></select></label>'+
      '<label>Title<input name="title" required minlength="3" maxlength="120"></label>'+
      '<label>Write your post<textarea name="body" required minlength="3" maxlength="3000"></textarea></label>'+
      '<label>Optional HTTPS link to your work<input name="url" type="url" maxlength="500" placeholder="https://..."></label>'+
      '<button class="button">Publish to Bebo ♥</button></form>':'<p>Sign in to share your work.</p>'));
    for(const p of posts){
      const author=map.get(p.author_id);
      const link=otherLink(p.media_url);
      html+=panel((p.kind==='band'?'♫ Band: ':'✎ Author: ')+safe(p.title),
        '<p class="muted">By '+safe(author?.display_name||'Member')+'</p><p class="longtext">'+safe(p.body)+'</p>'+
        (link?'<p><a href="'+safe(link)+'" target="_blank" rel="noopener noreferrer">Open their work ↗</a></p>':'')+
        (me?.id===p.author_id?btn('Remove post','retro-creation-delete',p.id,'secondary'):''));
    }
    return html;
  }
  async function form(type,data,ctx){
    const me=ctx.me, who=ctx.userViewed;
    if(!me) throw Error('Log in first.');
    if(type==='retro-whiteboard'){
      if(!who)throw Error('Open a profile first.');
      if(!canvasStrokes.length)throw Error('Draw something on the whiteboard first.');
      const strokes=canvasStrokes.map(s=>({color:s.color,points:s.points}));
      const serialized=JSON.stringify(strokes);
      if(serialized.length>19000)throw Error('Drawing is too large. Clear and draw fewer strokes.');
      await db('bebo_whiteboards',q=>q.insert({profile_id:who.id,author_id:me.id,strokes}));
      canvasStrokes=[];
      return 'Your whiteboard drawing has been posted ♥';
    }
    if(type==='retro-poll-create'||type==='retro-quiz-create'){
      const quiz=type==='retro-quiz-create',options=parseOptions(data.get('options'));
      const body={owner_id:me.id,question:clamp(data.get('question'),180),options};
      if(quiz){const index=Number(data.get('correct'))-1;if(!Number.isInteger(index)||index<0||index>=options.length)throw Error('Choose an existing correct answer.');body.correct_choice=index;}
      await db(quiz?'bebo_quizzes':'bebo_polls',q=>q.insert(body));
      return (quiz?'Quiz':'Poll')+' published ♥';
    }
    if(type==='retro-creation'){
      const link=clamp(data.get('url'),500);
      if(link&&!otherLink(link))throw Error('Only HTTPS links are allowed.');
      const kind=data.get('kind');
      if(!['band','author'].includes(kind))throw Error('Choose band or author.');
      await db('bebo_creations',q=>q.insert({author_id:me.id,kind,title:clamp(data.get('title'),120),body:clamp(data.get('body'),3000),media_url:link}));
      return 'Your creation was published ♥';
    }
    throw Error('Unknown feature form.');
  }
  async function action(name,id,ctx){
    const me=ctx.me;
    if(!me)throw Error('Log in to use this feature.');
    if(name==='retro-luv'){
      const {error}=await sb.rpc('bebo_give_luv',{p_recipient:id});
      if(error)throw error;
      return 'You sent some Luv ♥';
    }
    if(name.startsWith('retro-top-')){
      return replaceTop(me,arr=>{
        if(name==='retro-top-add'){
          const opt=document.querySelector('#top-choice');
          if(!opt?.value)throw Error('Choose a friend first.');
          if(arr.length>=16||arr.includes(opt.value))throw Error('Your Top 16 is already full, or friend is already in it.');
          arr.push(opt.value);
        } else if(name==='retro-top-remove')arr=arr.filter(v=>v!==id);
        else {
          const i=Number(id),j=name==='retro-top-up'?i-1:i+1;
          if(!Number.isInteger(i)||i<0||i>=arr.length||j<0||j>=arr.length)throw Error('Already at the end of the Top 16.');
          [arr[i],arr[j]]=[arr[j],arr[i]];
        }
        return arr;
      });
    }
    if(name==='retro-delete-board'){
      await db('bebo_whiteboards',q=>q.delete().eq('id',id));
      return 'Drawing removed.';
    }
    if(name==='retro-poll-vote'||name==='retro-quiz-answer'){
      const [item,indexText]=id.split(':');
      const choice=Number(indexText);
      if(!/^[a-f0-9-]{36}$/i.test(item)||!Number.isInteger(choice)||choice<0||choice>3)throw Error('Invalid answer.');
      const quiz=name==='retro-quiz-answer';
      await db(quiz?'bebo_quiz_answers':'bebo_poll_votes',q=>q.insert({
        [quiz?'quiz_id':'poll_id']:item,voter_id:me.id,choice
      }));
      return 'Your answer is saved ♥';
    }
    if(name==='retro-quiz-delete'||name==='retro-poll-delete'||name==='retro-creation-delete'){
      const table=name==='retro-quiz-delete'?'bebo_quizzes':name==='retro-poll-delete'?'bebo_polls':'bebo_creations';
      await db(table,q=>q.delete().eq('id',id).eq(table==='bebo_creations'?'author_id':'owner_id',me.id));
      return 'Removed ♥';
    }
    throw Error('Unknown action.');
  }
  function redraw(ctx,strokes) {
    ctx.clearRect(0,0,450,180);
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,450,180);
    if(!Array.isArray(strokes))return;
    for(const s of strokes.slice(0,300)){
      if(!hex(s.color) || !Array.isArray(s.points) || !s.points.length)continue;
      const pts=s.points.slice(0,800).filter(p=>Array.isArray(p)&&p.length===2&&p.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=450));
      if(!pts.length)continue;
      ctx.strokeStyle=s.color;ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';
      ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(const p of pts)ctx.lineTo(p[0],p[1]);
      if(pts.length===1)ctx.lineTo(pts[0][0]+.1,pts[0][1]+.1);
      ctx.stroke();
    }
  }
  function afterRender(){
    initPollPreviews();
    document.querySelectorAll('canvas.drawing-preview').forEach(c=>{
      try{redraw(c.getContext('2d'),JSON.parse(c.dataset.strokes))}catch{redraw(c.getContext('2d'),[])}
    });
    const canvas=document.querySelector('#bebo-draw');
    if(!canvas || canvas===drawTarget)return;
    drawTarget=canvas;canvasStrokes=[];drawing=null;
    const ctx=canvas.getContext('2d');redraw(ctx,[]);
    const pos=e=>{
      const r=canvas.getBoundingClientRect();
      return [Math.max(0,Math.min(450,Math.round((e.clientX-r.left)*450/r.width))),
      Math.max(0,Math.min(180,Math.round((e.clientY-r.top)*180/r.height)))];
    };
    canvas.addEventListener('pointerdown',e=>{
      e.preventDefault();canvas.setPointerCapture(e.pointerId);
      drawing={color:document.querySelector('#draw-colour')?.value||'#c52d61',points:[pos(e)]};
      canvasStrokes.push(drawing);
      redraw(ctx,canvasStrokes);
    });
    canvas.addEventListener('pointermove',e=>{
      if(!drawing)return;
      if(drawing.points.length<600 && JSON.stringify(canvasStrokes).length<17500)drawing.points.push(pos(e));
      redraw(ctx,canvasStrokes);
    });
    ['pointerup','pointercancel','lostpointercapture'].forEach(event=>canvas.addEventListener(event,()=>{drawing=null;}));
  }
  function clear(){
    canvasStrokes=[];drawing=null;
    const c=document.querySelector('#bebo-draw');if(c)redraw(c.getContext('2d'),[]);
  }
  return { sharedPanel,imageStyle,uploadBanner,youtubeId,audioUrl,fillPollExample,route:async(page,me)=>{
    if(page==='polls')return listPolls(me,false);
    if(page==='quizzes')return listPolls(me,true);
    if(page==='creators')return creatorPage(me);
    return panel('Explore Bebo','Choose a page.');
  },form,action,afterRender,clear };
}
