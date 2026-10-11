// Private, opt-in Bebo notifications. Polls only while the site is open.
// Offline push notifications and email delivery require separately configured providers.
export function createBeboNotifications(sb,{safe,panel}) {
  let memberId=null,timer=null,loaded=false,latestSeen=0,rows=[],unread=0,busy=false;
  const nav=()=>document.querySelector('#bebo-notification-nav');
  const esc=s=>safe(String(s??''));
  const validTarget=path=>typeof path==='string'&&/^#\/[a-z0-9/_-]{1,160}$/i.test(path)?path:'#/notifications';
  const dateText=value=>{
    try{return new Date(value).toLocaleString('en-NZ',{dateStyle:'medium',timeStyle:'short'})}
    catch{return 'Recently'}
  };
  function badge(){
    const button=nav();
    if(button)button.hidden=!memberId;
    const count=document.querySelector('#bebo-notification-count');
    if(count){
      count.hidden=!memberId||unread===0;
      count.textContent=String(Math.min(99,unread))+(unread>99?'+':'');
    }
    if(button)button.setAttribute('aria-label','Notifications'+(unread?' ('+unread+' unread)':''));
  }
  async function refresh() {
    if(!sb||!memberId||busy||document.hidden)return;
    const forMember=memberId;busy=true;
    try {
      const {data,error}=await sb.from('bebo_notifications')
        .select('id,kind,title,body,target_path,created_at,read_at')
        .eq('recipient_id',forMember).order('created_at',{ascending:false}).limit(80);
      if(error)throw error;
      if(memberId!==forMember)return;
      const next=data||[];
      if(loaded&&next.length&&typeof Notification!=='undefined'&&Notification.permission==='granted'){
        const newNotices=next.filter(n=>Number(n.id)>latestSeen&&!n.read_at);
        if(newNotices.length){
          // Show one discreet browser notification per polling batch; no private mail text.
          const top=newNotices[0];
          try{const notice=new Notification('Bebo.nz — '+top.title,{body:top.body||'Open your Bebo notifications.',tag:'bebo-new-notice'});
            notice.onclick=()=>{window.focus();location.hash='#/notifications';notice.close()};
          }catch(err){console.warn('Bebo browser notification unavailable',err)}
        }
      }
      latestSeen=Math.max(latestSeen,...next.map(n=>Number(n.id)||0));
      loaded=true;rows=next;unread=next.filter(n=>!n.read_at).length;
      badge();
      if((location.hash||'')==='#/notifications'){
        const content=document.querySelector('#bebo-notifications-live');
        if(content)content.innerHTML=listMarkup();
      }
    }catch(error){console.warn('Bebo notifications could not be refreshed',error)}
    finally{busy=false}
  }
  function start(id){
    const next=id||null;
    if(next===memberId){badge();return}
    if(timer){clearInterval(timer);timer=null}
    memberId=next;rows=[];unread=0;latestSeen=0;loaded=false;busy=false;badge();
    if(memberId){
      refresh().catch(()=>{});
      timer=setInterval(()=>{if(!document.hidden)refresh().catch(()=>{})},20000);
    }
  }
  function listMarkup(){
    return rows.length?rows.map(item=>{
      const target=validTarget(item.target_path);
      return '<article class="bebo-notice-item'+(item.read_at?'':' bebo-notice-unread')+'">'+
        '<div><strong>'+esc(item.title)+'</strong>'+
        '<p>'+esc(item.body)+'</p><small>'+esc(dateText(item.created_at))+'</small></div>'+
        '<div class="bebo-notice-actions">'+
        '<a class="button secondary" href="'+esc(target)+'" data-notice-open="'+esc(item.id)+'">Open ♥</a>'+
        (item.read_at?'':'<button type="button" class="button secondary" data-action="notice-read" data-id="'+esc(item.id)+'">Mark read</button>')+
        '</div></article>';
    }).join(''):'<p class="muted">You have no notifications yet. New messages, comments and community news will appear here. ♥</p>';
  }
  function page(){
    if(!memberId)return panel('🔔 Notifications','<p><a href="#/signin">Sign in</a> to see your private Bebo notifications.</p>');
    const state=typeof Notification==='undefined'?'unavailable':Notification.permission;
    const optin=state==='default'
      ?'<button class="button secondary" type="button" data-action="notice-enable-browser">Enable browser alerts (optional)</button>'
      :state==='granted'?'<p class="muted">✓ Browser alerts enabled while Bebo is open.</p>'
      :'<p class="muted">Browser alerts are '+(state==='denied'?'blocked in your browser settings':'not supported here')+'. Your in-site notifications still work.</p>';
    return panel('🔔 My Bebo Notifications ♥',
      '<p>Private notifications for Bebo Mail, profile comments, friend requests, Luv, blog/video comments, and announcements including maintenance.</p>'+
      '<p class="muted">Alerts update while this Bebo tab is open. Offline phone push notifications and email are not currently enabled.</p>'+
      optin+' <button type="button" class="button secondary" data-action="notice-read-all">Mark all read</button>'+
      '<div id="bebo-notifications-live" aria-live="polite">'+listMarkup()+'</div>');
  }
  async function markRead(id){
    if(!memberId||!rows.some(row=>String(row.id)===String(id)))return;
    const {error}=await sb.from('bebo_notifications').update({read_at:new Date().toISOString()})
      .eq('recipient_id',memberId).eq('id',id).is('read_at',null);
    if(error)throw error;
    await refresh();
  }
  async function markAll(){
    if(!memberId)return;
    const {error}=await sb.from('bebo_notifications').update({read_at:new Date().toISOString()})
      .eq('recipient_id',memberId).is('read_at',null);
    if(error)throw error;
    await refresh();
  }
  async function enableBrowser(){
    if(typeof Notification==='undefined')return 'Your browser does not support these alerts.';
    const result=await Notification.requestPermission();
    return result==='granted'?'Browser alerts enabled while the Bebo site is open. ♥':
      'Browser alert permission not granted. In-site notifications remain available.';
  }
  // Only the click path can ask for browser permission.
  async function action(kind,id){
    if(kind==='notice-read'){await markRead(id);return 'Notification marked read.'}
    if(kind==='notice-read-all'){await markAll();return 'Notifications marked read.'}
    if(kind==='notice-enable-browser')return enableBrowser();
    return null;
  }
  async function open(id){await markRead(id)}
  if(typeof document!=='undefined'){
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh().catch(()=>{})});
    window.addEventListener('focus',()=>refresh().catch(()=>{}));
  }
  return {start,refresh,page,action,open,badge};
}
