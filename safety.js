// Bebo member controls; server-side RLS and database triggers enforce restrictions.
export function createSafety(sb,{safe,panel,btn,query}) {
  const db=(table,fn)=>query(table,fn);
  const clean=s=>String(s??'').trim();
  async function myBlocks(me) {
    if(!me)return new Set();
    const rows=await db('bebo_blocks',q=>q.select('blocked_id').eq('blocker_id',me.id).limit(1000));
    return new Set(rows.map(x=>x.blocked_id));
  }
  async function profileTools(who,me) {
    if(!me || !who || me.id===who.id)return '';
    const own=await db('bebo_blocks',q=>q.select('blocked_id').eq('blocker_id',me.id).eq('blocked_id',who.id).maybeSingle());
    return '<div class="safety-profile">'+
      (own?'<p class="muted">You blocked this member. They cannot send you friend requests, Luv, drawings or wall comments. Public profiles may still be visible.</p>':'')+
      (own?btn('Unblock member','safety-unblock',who.id,'secondary'):btn('Block member','safety-block',who.id,'danger'))+
      btn('Report this profile','safety-report-profile',who.id,'secondary')+
      '</div>';
  }
  async function accountPanel(me) {
    const blocked=await db('bebo_blocks',q=>q.select('blocked_id').eq('blocker_id',me.id).limit(200));
    const ids=blocked.map(x=>x.blocked_id);
    const names=ids.length?await db('bebo_profiles',q=>q.select('id,username,display_name').in('id',ids)):[];
    const byId=new Map(names.map(x=>[x.id,x]));
    const blockedList=blocked.length?blocked.map(x=>{
      const p=byId.get(x.blocked_id);
      return '<div class="item">'+safe(p?.display_name||'Member')+
      (p? ' <span class="muted">@'+safe(p.username)+'</span>':'')+
      btn('Unblock','safety-unblock',x.blocked_id,'secondary')+'</div>';
    }).join(''):'<p class="muted">You have not blocked anyone.</p>';
    return panel('Blocked members',blockedList)+
      panel('Report a safety issue','<p>On a member profile or comment, choose Report. Reports are private and can only be reviewed by authorised site administrators. For emergencies contact local authorities.</p>')+
      panel('Delete my Bebo account','<p>This permanently removes your Bebo login, profile, friendships, comments, drawings and other linked content. Uploaded images will also be removed. This cannot be undone.</p>'+
      '<form class="fields" data-form="safety-delete-account">'+
      '<label>Type DELETE MY BEBO ACCOUNT<input name="confirmation" autocomplete="off" required placeholder="DELETE MY BEBO ACCOUNT"></label>'+
      '<div class="bebo-password-field"><label>Current password (required to confirm)<input name="password" type="password" autocomplete="current-password" required></label><button type="button" class="bebo-password-toggle" data-toggle-password aria-pressed="false" aria-label="Show password">👁 Show password</button></div>'+
      '<button class="button danger">Permanently delete my account</button></form>');
  }
  async function action(name,id,ctx) {
    const me=ctx.me;
    if(!me)throw Error('Sign in first.');
    if(name==='safety-block'){
      if(!confirm('Block this member? Existing friendship and Top 16 connections will be removed.'))return 'Block cancelled.';
      await db('bebo_blocks',q=>q.insert({blocker_id:me.id,blocked_id:id}));
      return 'Member blocked. Existing friendship was removed.';
    }
    if(name==='safety-unblock'){
      await db('bebo_blocks',q=>q.delete().eq('blocker_id',me.id).eq('blocked_id',id));
      return 'Member unblocked. Your previous friendship is not restored.';
    }
    if(name==='safety-report-profile'){
      if(id===me.id)throw Error('You cannot report your own profile.');
      const reason=prompt('Why are you reporting this profile? Please include at least 10 characters.');
      if(reason==null)return 'Report cancelled.';
      if(clean(reason).length<10)throw Error('Describe the issue in at least 10 characters.');
      await db('bebo_reports',q=>q.insert({reporter_id:me.id,reported_profile_id:id,reason:clean(reason).slice(0,1000)}));
      return 'Your profile report was sent for administrator review.';
    }
    throw Error('Unknown safety action.');
  }
  async function form(type,data,ctx) {
    if(type!=='safety-delete-account')throw Error('Unknown safety form.');
    if(clean(data.get('confirmation'))!=='DELETE MY BEBO ACCOUNT')throw Error('Type the complete confirmation phrase to continue.');
    if(!ctx.me?.email)throw Error('Log in to your account first.');
    const password=String(data.get('password')||'');
    if(!password)throw Error('Enter your current password.');
    if(!confirm('Permanently delete your Bebo account and content? This cannot be reversed.'))return {cancelled:true};
    const {data:login,error:loginErr}=await sb.auth.signInWithPassword({email:ctx.me.email,password});
    if(loginErr || login?.user?.id!==ctx.me.id)throw Error('Password confirmation failed. Account was NOT deleted.');
    const {data:deleted,error:deleteErr}=await sb.functions.invoke('bebo-delete-account',{
      body:{confirmation:'DELETE MY BEBO ACCOUNT'}
    });
    if(deleteErr || deleted?.deleted!==true)throw Error('Deletion was not confirmed. Your account may still exist; contact the site administrator if the problem persists.');
    await sb.auth.signOut();
    return {deleted:true};
  }
  return {myBlocks,profileTools,accountPanel,action,form};
}
