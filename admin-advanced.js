/* Bebo owner tools: database-enforced administration; no privileged API keys in browsers. */
export function createAdminAdvanced(sb,{safe,panel},requireOwner) {
  const sections=[
    ['members','👥 Manage Members'],
    ['analytics','📊 Website Analytics'],
    ['announcements','📢 Announcements'],
    ['skins','🎨 Review Skins'],
    ['moderation','🛡️ Moderation Tools'],
    ['settings','⚙️ Website Settings']
  ];
  let section='members',search='';
  const day=iso=>new Date(iso).toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'});
  const uuid=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id));
  const clean=(t,n)=>String(t??'').trim().slice(0,n);
  const request=async promise=>{const {data,error}=await promise;if(error)throw error;return data||[]};
  const count=async(table,column='created_at',start=null)=>{
    let query=sb.from(table).select('*',{count:'exact',head:true});
    if(start)query=query.gte(column,start);
    const {count,error}=await query;if(error)throw error;return count||0;
  };
  const click=(caption,action,id,kind='secondary')=>
    '<button type="button" class="button '+kind+'" data-action="'+action+'" data-id="'+safe(id)+'">'+caption+'</button>';
  const link=p=>'<a href="#/u/'+encodeURIComponent(p.username)+'">'+safe(p.display_name)+' (@'+safe(p.username)+')</a>';
  async function members(){
    let q=sb.from('bebo_profiles').select('id,username,display_name,created_at').order('created_at',{ascending:false}).limit(40);
    if(search)q=q.ilike('username','%'+search+'%');
    const people=await request(q);
    const controlIDs=people.map(x=>x.id);
    const records=controlIDs.length?await request(sb.from('bebo_member_controls').select('member_id,status,reason,updated_at').in('member_id',controlIDs)):[];
    const byID=new Map(records.map(x=>[x.member_id,x]));
    const list=people.map(p=>{
      const restriction=byID.get(p.id);
      const status=restriction?.status||'active';
      const protectedMember=p.id===me.id;
      const tools=protectedMember?'<span class="admin-state admin-state-active">★ Your owner account is protected</span>':status==='suspended'?
       click('Restore member','admin-member-restore',p.id):
       click('Suspend','admin-member-suspend',p.id,'danger');
      return '<article class="admin-member-card"><div><b>'+link(p)+'</b>'+
       '<p class="muted">Joined '+day(p.created_at)+'</p>'+
       '<span class="admin-state admin-state-'+status+'">'+safe(status.toUpperCase())+'</span>'+
       (restriction?.reason?'<p class="admin-member-reason">'+safe(restriction.reason)+'</p>':'')+'</div>'+
       '<div class="admin-member-actions">'+(protectedMember?'':click('Warn','admin-member-warn',p.id))+tools+
       (!protectedMember&&status==='warned'?click('Clear warning','admin-member-restore',p.id):'')+'</div></article>';
    }).join('');
    return panel('👥 Manage Members',
      '<p>Search registered profiles and issue warnings or suspend posting. Your own administrator account is protected against suspension.</p>'+
      '<form class="fields admin-member-search" data-form="admin-search"><label>Search usernames'+
      '<input name="username" maxlength="25" value="'+safe(search)+'" placeholder="Search by Bebo username"></label>'+
      '<button class="button" type="submit">Find members</button></form>'+
      (list||'<p class="admin-empty">No matching Bebo members found.</p>')+
      '<p class="muted">Suspension blocks new posts, comments, uploads and other social writes. Members can still sign in, read public content and submit a safety report.</p>');
  }
  async function analytics(){
    const days=7,from=new Date(Date.now()-days*864e5).toISOString();
    const [profiles,wall,blogs,photos,skins,groups]=await Promise.all([
      count('bebo_profiles','created_at',from),
      count('bebo_wall_posts','created_at',from),
      count('bebo_blogs','created_at',from),
      count('bebo_photos','created_at',from),
      count('bebo_skins','created_at',from),
      count('bebo_groups')
    ]);
    const {count:connections,error:friendError}=await sb.from('bebo_friendships').select('id',{count:'exact',head:true}).eq('status','accepted');
    if(friendError)throw friendError;
    const items=[
      ['New members (7 days)',profiles],
      ['Wall comments (7 days)',wall],
      ['Blog entries (7 days)',blogs],
      ['Photos uploaded (7 days)',photos],
      ['Shared skins (7 days)',skins],
      ['Total groups',groups],
      ['Accepted friendships',connections||0]
    ];
    return panel('📊 Website Analytics',
     '<p>Live activity counts from your Bebo database. These are real records, <strong>not estimates of visitors, views or unique active users</strong>.</p>'+
     '<div class="admin-metric-grid">'+items.map(([label,value])=>
     '<div class="admin-metric"><strong>'+Number(value).toLocaleString('en-NZ')+'</strong><span>'+safe(label)+'</span></div>').join('')+'</div>'+
     '<p class="muted">For visitor analytics, a separate privacy-conscious analytics integration would be needed.</p>');
  }
  async function announcements(){
    const rows=await request(sb.from('bebo_announcements')
      .select('id,title,body,published,created_at,updated_at')
      .order('created_at',{ascending:false}).limit(30));
    const list=rows.map(a=>'<article class="admin-announcement-card"><h3>'+safe(a.title)+
      (a.published?' <small>● Published</small>':' <small>● Draft</small>')+'</h3>'+
      '<p class="muted">Created '+day(a.created_at)+'</p><div class="admin-long-text">'+safe(a.body)+'</div>'+
      '<div class="admin-inline-actions">'+click(a.published?'Unpublish':'Publish', 'admin-announcement-toggle',a.id)+
      click('Delete','admin-announcement-delete',a.id,'danger')+'</div></article>').join('');
    return panel('📢 Bebo Announcements',
      '<p>Publish an announcement to the site banner. Drafts stay private until you publish them.</p>'+
      '<form class="fields" data-form="admin-announcement">'+
      '<label>Headline<input name="title" required minlength="3" maxlength="110" placeholder="Bebo news ♥"></label>'+
      '<label>Announcement<textarea name="body" required minlength="5" maxlength="1600" rows="4" placeholder="Share an update with members..."></textarea></label>'+
      '<label class="admin-check"><input type="checkbox" name="published"> Publish immediately (otherwise save as draft)</label>'+
      '<button class="button" type="submit">Save announcement ♥</button></form>'+
      '<h3>Recent Announcements</h3>'+(list||'<p class="muted">No announcements created yet.</p>'));
  }
  async function skins(){
    const rows=await request(sb.from('bebo_skins')
      .select('id,name,creator_id,primary_color,secondary_color,is_hidden,created_at')
      .order('created_at',{ascending:false}).limit(50));
    const ids=[...new Set(rows.map(x=>x.creator_id))];
    const members=ids.length?await request(sb.from('bebo_profiles').select('id,username,display_name').in('id',ids)):[];
    const byID=new Map(members.map(x=>[x.id,x]));
    const list=rows.map(s=>{
      const creator=byID.get(s.creator_id);
      return '<article class="admin-skin-row"><span class="admin-skin-swatch" style="background:linear-gradient(140deg,'+
        safe(s.secondary_color)+','+safe(s.primary_color)+')"></span><div><b>'+safe(s.name)+'</b>'+
        '<p class="muted">'+(creator?link(creator):'Former member')+' · '+day(s.created_at)+'</p>'+
        '<span class="admin-state '+(s.is_hidden?'admin-state-suspended':'admin-state-active')+'">'+
        (s.is_hidden?'Hidden from gallery':'Public')+'</span></div>'+
        '<div>'+click(s.is_hidden?'Show skin':'Hide skin','admin-skin-toggle',s.id,s.is_hidden?'secondary':'danger')+'</div></article>';
    }).join('');
    return panel('🎨 Manage Community Skins',
      '<p>Hide inappropriate member-created skins from the shared gallery or restore them. Your built-in 56 classic skins stay available.</p>'+
      (list||'<p class="admin-empty">No community skins have been shared yet.</p>')+
      '<p class="muted">Hiding removes the skin from browsing; it does not remove already applied themes or delete uploaded banner files.</p>');
  }
  async function moderation(){
    const controls=await request(sb.from('bebo_member_controls')
      .select('member_id,status,reason,updated_at').neq('status','active')
      .order('updated_at',{ascending:false}).limit(30));
    const audit=await request(sb.from('bebo_admin_audit')
      .select('id,action,summary,created_at').order('created_at',{ascending:false}).limit(20));
    const names=controls.length?await request(sb.from('bebo_profiles').select('id,username,display_name').in('id',controls.map(x=>x.member_id))):[];
    const people=new Map(names.map(x=>[x.id,x]));
    return panel('🛡️ Moderation Tools',
      '<p>Warnings, suspensions and an audit history. Use the <strong>Member Reports</strong> section above to dismiss reports or remove reported wall comments.</p>'+
      '<h3>Restricted members</h3>'+
      (controls.map(x=>'<div class="item"><b>'+(people.get(x.member_id)?link(people.get(x.member_id)):'Deleted member')+'</b>'+
       ' — '+safe(x.status)+'<p class="muted">'+safe(x.reason||'No reason supplied')+
       ' · '+day(x.updated_at)+'</p></div>').join('')||'<p class="muted">No warnings or suspensions recorded.</p>')+
      '<h3>Recent moderation activity</h3>'+
      (audit.map(a=>'<div class="item"><b>'+safe(a.action)+'</b>'+
       ' <span class="muted">'+day(a.created_at)+'</span><p>'+safe(a.summary||'No note')+'</p></div>').join('')||
       '<p class="muted">No actions logged yet.</p>'));
  }
  async function settings(){
    const rows=await request(sb.from('bebo_site_settings').select('key,enabled,description').order('key'));
    const titles={
      wall_posts:'💬 Member wall comments',
      custom_skins:'🎨 New custom skin submissions',
      group_creation:'★ New group creation',
      announcements:'📢 Public announcement banner'
    };
    return panel('⚙️ Website Settings',
      '<p>These switches change the live site. Existing posts, photos, friendships and skins are not deleted.</p>'+
      rows.map(v=>'<article class="admin-setting-row"><div><b>'+safe(titles[v.key]||v.key)+'</b>'+
       '<p class="muted">'+safe(v.description)+'</p></div><div>'+
       '<span class="admin-state '+(v.enabled?'admin-state-active':'admin-state-suspended')+'">'+
       (v.enabled?'ON':'PAUSED')+'</span>'+
       click(v.enabled?'Pause':'Enable','admin-setting-toggle',v.key)+'</div></article>').join('')+
      '<p class="muted">These settings pause new wall comments, community skin submissions or group creation. They do not disable account sign-up or existing content.</p>');
  }
  async function panels(me,role) {
    if(role!=='owner')return panel('Owner tools','Only the Bebo owner can control members, announcements and site settings.');
    await requireOwner(me);
    const buttons=sections.map(([key,label])=>click(label,'admin-section',key,key===section?'':'secondary')).join('');
    const views={members,analytics,announcements,skins,moderation,settings};
    return panel('👑 Owner Control Centre',
      '<p>Choose an admin tool below. Only your verified Bebo owner account can make changes.</p>'+
      '<div class="admin-section-tabs">'+buttons+'</div>')+
      await views[section]();
  }
  async function action(name,id,me) {
    const role=await requireOwner(me);
    if(role!=='owner')throw Error('Owner permissions required.');
    if(name==='admin-section'){
      if(!sections.some(([key])=>key===id))throw Error('Unknown section.');
      section=id;return {message:'Opened '+sections.find(([key])=>key===id)[1]};
    }
    if(name==='admin-setting-toggle'){
      if(!['wall_posts','custom_skins','group_creation','announcements'].includes(id))throw Error('Unknown setting');
      const rows=await request(sb.from('bebo_site_settings').select('key,enabled').eq('key',id));
      if(rows.length!==1)throw Error('Setting not found.');
      const {data,error}=await sb.from('bebo_site_settings').update({enabled:!rows[0].enabled})
        .eq('key',id).eq('enabled',rows[0].enabled).select('key,enabled').maybeSingle();
      if(error)throw error;if(!data)throw Error('Setting changed elsewhere; refresh.');
      return {message:id+' is now '+(data.enabled?'enabled':'paused')+'.'};
    }
    if(name==='admin-member-warn'||name==='admin-member-suspend'||name==='admin-member-restore'){
      if(!uuid(id))throw Error('Invalid member ID.');
      const state=name==='admin-member-warn'?'warned':name==='admin-member-suspend'?'suspended':'active';
      let reason='Owner lifted the restriction.';
      if(state!=='active'){
        const answer=prompt(state==='warned'?'Reason for warning:':'Reason for suspending posting:');
        if(answer===null)return {cancelled:true};
        reason=clean(answer,500);
        if(reason.length<5)throw Error('Please describe the reason (5 characters minimum).');
      }
      if(!confirm('Change this member’s moderation status to '+state+'?'))return {cancelled:true};
      const existing=await request(sb.from('bebo_member_controls').select('member_id').eq('member_id',id));
      let result;
      if(existing.length){
        result=await sb.from('bebo_member_controls').update({status:state,reason}).eq('member_id',id).select('member_id').maybeSingle();
      }else{
        result=await sb.from('bebo_member_controls').insert({member_id:id,status:state,reason}).select('member_id').maybeSingle();
      }
      if(result.error)throw result.error;
      if(!result.data)throw Error('The member moderation update was not saved.');
      return {message:'Member status changed to '+state+'.'};
    }
    if(name==='admin-skin-toggle'){
      if(!uuid(id))throw Error('Invalid skin ID');
      const rows=await request(sb.from('bebo_skins').select('id,is_hidden').eq('id',id));
      if(rows.length!==1)throw Error('Skin not found.');
      if(!rows[0].is_hidden&&!confirm('Hide this skin from public browsing?'))return {cancelled:true};
      const {data,error}=await sb.from('bebo_skins').update({is_hidden:!rows[0].is_hidden})
        .eq('id',id).eq('is_hidden',rows[0].is_hidden).select('id,is_hidden').maybeSingle();
      if(error)throw error;if(!data)throw Error('Skin changed elsewhere; refresh.');
      return {message:data.is_hidden?'Skin hidden from public gallery.':'Skin is public again.'};
    }
    if(name==='admin-announcement-toggle'){
      if(!uuid(id))throw Error('Invalid announcement ID');
      const rows=await request(sb.from('bebo_announcements').select('id,published').eq('id',id));
      if(rows.length!==1)throw Error('Announcement not found.');
      const {data,error}=await sb.from('bebo_announcements').update({published:!rows[0].published})
        .eq('id',id).eq('published',rows[0].published).select('id,published').maybeSingle();
      if(error)throw error;if(!data)throw Error('Announcement changed elsewhere; refresh.');
      return {message:data.published?'Announcement published.':'Announcement unpublished.'};
    }
    if(name==='admin-announcement-delete'){
      if(!uuid(id))throw Error('Invalid announcement ID');
      if(!confirm('Permanently delete this announcement?'))return {cancelled:true};
      const {data,error}=await sb.from('bebo_announcements').delete().eq('id',id).select('id').maybeSingle();
      if(error)throw error;if(!data)throw Error('Announcement not found or not deleted.');
      return {message:'Announcement deleted.'};
    }
    throw Error('Unknown owner action.');
  }
  async function form(type,form,me){
    const role=await requireOwner(me);
    if(role!=='owner')throw Error('Owner permissions required.');
    if(type==='admin-search'){
      const value=clean(form.get('username'),25).toLowerCase();
      if(value && !/^[a-z0-9_]{1,25}$/.test(value))throw Error('Use only username letters, numbers and underscores.');
      search=value;section='members';
      return {message:value?'Members filtered by '+value+'.':'Showing recent members.'};
    }
    if(type==='admin-announcement'){
      const title=clean(form.get('title'),110),body=clean(form.get('body'),1600);
      if(title.length<3||body.length<5)throw Error('Enter a headline and message.');
      const published=form.get('published')==='on';
      const {error}=await sb.from('bebo_announcements').insert({title,body,published});
      if(error)throw error;
      section='announcements';
      return {message:published?'Announcement published.':'Announcement saved privately as draft.'};
    }
    throw Error('Unknown admin form.');
  }
  return {panels,action,form};
}
