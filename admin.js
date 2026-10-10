/**
 * Bebo Owner Admin Panel — visible only for verified, server-assigned moderator accounts.
 * Security comes from Supabase Auth and the database RLS, NOT from this JavaScript.
 * This module contains no service-role credentials and never grants privileges.
 */
import { createAdminAdvanced } from './admin-advanced.js?v=20261010-bebo-verified-v1';
export function createAdmin(sb,{safe,panel}) {
  let filter='open';
  const date=v=>{
    try { return new Date(v).toLocaleString('en-NZ',{dateStyle:'medium',timeStyle:'short'}); }
    catch { return 'Unknown date'; }
  };
  async function check(me) {
    if(!me?.id) return null;
    const {data,error}=await sb.from('bebo_moderators')
      .select('role').eq('user_id',me.id).maybeSingle();
    if(error) throw error;
    return data && ['owner','moderator'].includes(data.role) ? data.role : null;
  }
  async function guard(me) {
    const role=await check(me);
    if(!role) throw Error('This page is for approved Bebo administrators only.');
    return role;
  }
  const advanced=createAdminAdvanced(sb,{safe,panel},guard);
  async function count(table,where) {
    let request=sb.from(table).select('id',{count:'exact',head:true});
    if(where)request=request.eq(where[0],where[1]);
    const {count,error}=await request;
    if(error)throw error;
    return count||0;
  }
  async function dashboard(me) {
    const role=await guard(me);
    const [members,allReports,openReports,wallPosts,reportedResult]=await Promise.all([
      count('bebo_profiles'),
      count('bebo_reports'),
      count('bebo_reports',['status','open']),
      count('bebo_wall_posts'),
      sb.from('bebo_reports').select('id,reporter_id,reported_profile_id,reported_post_id,reason,status,created_at,reviewed_at')
        .eq('status',filter).order('created_at',{ascending:false}).limit(60)
    ]);
    if(reportedResult.error)throw reportedResult.error;
    const reports=reportedResult.data||[];
    const profileIDs=[...new Set(reports.flatMap(r=>[r.reporter_id,r.reported_profile_id]).filter(Boolean))];
    const postIDs=[...new Set(reports.map(r=>r.reported_post_id).filter(Boolean))];
    const [profilesResult,postsResult]=await Promise.all([
      profileIDs.length?sb.from('bebo_profiles').select('id,username,display_name').in('id',profileIDs):Promise.resolve({data:[],error:null}),
      postIDs.length?sb.from('bebo_wall_posts').select('id,body,author_id,profile_id').in('id',postIDs):Promise.resolve({data:[],error:null})
    ]);
    if(profilesResult.error)throw profilesResult.error;
    if(postsResult.error)throw postsResult.error;
    const profiles=new Map((profilesResult.data||[]).map(p=>[p.id,p]));
    const posts=new Map((postsResult.data||[]).map(p=>[p.id,p]));
    const who=id=>{
      const p=profiles.get(id);
      return p?'<a href="#/u/'+encodeURIComponent(p.username)+'">'+safe(p.display_name)+' (@'+safe(p.username)+')</a>':'<span class="muted">Member unavailable</span>';
    };
    const cards=[
      ['👥 Members',members],['🚩 Open reports',openReports],
      ['📝 Wall comments',wallPosts],['📬 Total reports',allReports]
    ].map(([name,value])=>'<div class="admin-stat"><strong>'+value+'</strong><span>'+name+'</span></div>').join('');
    const tabs=['open','dismissed','actioned'].map(status=>{
      const title=status==='open'?'Open':status==='dismissed'?'Dismissed':'Actioned';
      return '<button type="button" class="button '+(status===filter?'':'secondary')+
        '" data-action="admin-filter" data-id="'+status+'" aria-pressed="'+String(status===filter)+'">'+title+'</button>';
    }).join('');
    const reportHTML=reports.map(r=>{
      const post=r.reported_post_id?posts.get(r.reported_post_id):null;
      const target=r.reported_profile_id?'<p><b>Reported profile:</b> '+who(r.reported_profile_id)+'</p>':
        r.reported_post_id?'<p><b>Reported wall comment:</b> '+(post?'The comment is still visible.':'Comment unavailable or already removed.')+'</p>':'';
      const actions=r.status==='open'?'<div class="admin-report-actions">'+
        '<button class="button secondary" data-action="admin-dismiss" data-id="'+safe(r.id)+'">Dismiss report</button>'+
        (post?'<button class="button danger" data-action="admin-delete-post" data-id="'+safe(r.id)+'">Remove reported comment</button>':'')+
        '</div>':'<p class="muted">Reviewed '+(r.reviewed_at?date(r.reviewed_at):'previously')+'</p>';
      return '<article class="admin-report">'+
        '<p><strong>🚩 '+safe(r.status.toUpperCase())+'</strong> <span class="muted">'+date(r.created_at)+'</span></p>'+
        '<p><b>Reported by:</b> '+who(r.reporter_id)+'</p>'+
        target+
        (post?'<blockquote class="admin-post-preview">'+safe(post.body.slice(0,600))+'</blockquote>':'')+
        '<p><b>Reason:</b> <span class="admin-report-reason">'+safe(r.reason)+'</span></p>'+
        actions+'</article>';
    }).join('');
    return '<div class="bebo-admin-page">'+
      panel('★ Bebo Admin Panel ♥',
        '<p><strong>Administrator:</strong> '+safe(me.email||'Logged-in owner')+
        ' <span class="admin-role">'+safe(role)+'</span></p>'+
        '<p>This private panel manages community reports and reported wall comments. Only approved accounts can access its data.</p>'+
        '<div class="admin-stats">'+cards+'</div>'+
        '<p><a href="#/u/bebo">← Main Bebo profile</a> · <a href="#/safety">Community rules</a></p>')+
      panel('🚩 Member Reports',
        '<p class="muted">Review reports carefully. Removing a reported comment is permanent and will remove reports attached to that comment.</p>'+
        '<div class="admin-filters">'+tabs+'</div>'+
        (reportHTML||'<p class="admin-empty">♥ No '+safe(filter)+' reports. All caught up!</p>'))+
      '</div>'+await photoModerationPanel(me)+await contentModerationPanel()+await advanced.panels(me,role);
  }
  async function photoModerationPanel(me) {
    // Review status and reports are protected by backend RLS; this only runs after guard().
    const [pendingReq,reportsReq]=await Promise.all([
      sb.from('bebo_photos').select('id,owner_id,caption,object_path,created_at,moderation_status')
        .eq('moderation_status','pending').order('created_at',{ascending:true}).limit(25),
      sb.from('bebo_photo_reports').select('id,photo_id,reason,status,created_at')
        .eq('status','open').order('created_at',{ascending:true}).limit(25)
    ]);
    if(pendingReq.error)throw pendingReq.error;
    if(reportsReq.error)throw reportsReq.error;
    const pending=pendingReq.data||[],reports=reportsReq.data||[];
    const ids=[...new Set(reports.map(r=>r.photo_id))];
    const reported=ids.length?await sb.from('bebo_photos')
      .select('id,caption,object_path,moderation_status').in('id',ids):{data:[],error:null};
    if(reported.error)throw reported.error;
    const byID=new Map((reported.data||[]).map(p=>[p.id,p]));
    const photoPreview=p=>p?.object_path?
      '<img loading="lazy" style="display:block;width:140px;max-width:100%;height:110px;object-fit:contain;margin:8px 0;border:1px solid #ddd" src="'+
       safe(sb.storage.from('bebo-photos').getPublicUrl(p.object_path).data.publicUrl)+'" alt="Submitted member photo for moderator review">':'';
    const buttons=p=>'<div class="admin-report-actions">'+
      '<button type="button" class="button" data-action="admin-photo-approve" data-id="'+safe(p.id)+'">Approve photo</button>'+
      '<button type="button" class="button danger" data-action="admin-photo-reject" data-id="'+safe(p.id)+'">Reject photo</button></div>';
    const pendingHTML=pending.map(p=>'<article class="admin-report"><strong>⏳ New photo for approval</strong>'+
      '<p class="muted">'+date(p.created_at)+'</p>'+photoPreview(p)+
      '<p>'+safe(p.caption||'No caption')+'</p>'+buttons(p)+'</article>').join('');
    const reportsHTML=reports.map(r=>{
      const p=byID.get(r.photo_id);
      return '<article class="admin-report"><strong>🚩 Reported photo</strong><p class="muted">'+date(r.created_at)+'</p>'+
        (p?photoPreview(p)+'<p>'+safe(p.caption||'No caption')+' · '+safe(p.moderation_status)+'</p>':
            '<p>Photo was deleted or is no longer accessible.</p>')+
        '<p>Report reason: '+safe(r.reason)+'</p><div class="admin-report-actions">'+
        (p&&p.moderation_status==='approved'?
         '<button class="button danger" data-action="admin-photo-hide" data-id="'+safe(p.id)+'">Hide reported photo</button>':'')+
        '<button class="button secondary" data-action="admin-photo-report-reviewed" data-id="'+safe(r.id)+'">Mark reviewed</button>'+
        '</div></article>';
    }).join('');
    return panel('📸 Photo Approvals & Abuse Reports',
      '<p><strong>Member photos require a decision before appearing in public galleries.</strong>'+
      ' Review the picture, any personal information and copyright concerns. The storage URL is technically shareable; an unapproved image is not truly private.</p>'+
      '<h3>Awaiting approval ('+pending.length+')</h3>'+
      (pendingHTML||'<p class="admin-empty">No photos awaiting review.</p>')+
      '<h3>Open photo reports ('+reports.length+')</h3>'+
      (reportsHTML||'<p class="admin-empty">No photo reports waiting.</p>'));
  }
  async function contentModerationPanel(){
    const {data:reports,error}=await sb.from('bebo_content_reports')
      .select('id,content_kind,content_id,reason,created_at,status')
      .eq('status','open').order('created_at',{ascending:true}).limit(30);
    if(error)throw error;
    const tables={blog:'bebo_blogs',blog_comment:'bebo_blog_comments',group:'bebo_groups'};
    const list=await Promise.all((reports||[]).map(async r=>{
      const table=tables[r.content_kind];if(!table)return '';
      const {data:content,error:lookup}=await sb.from(table).select('*').eq('id',r.content_id).maybeSingle();
      if(lookup)throw lookup;
      const summary=String(content?.title||content?.name||content?.body||content?.description||'Content removed').slice(0,350);
      return '<article class="admin-report"><strong>🚩 '+safe(r.content_kind.replace('_',' '))+'</strong>'+
        '<p class="muted">'+date(r.created_at)+(content?.is_hidden?' · Already hidden':' · Under review')+'</p>'+
        '<p class="admin-post-preview">'+safe(summary)+'</p>'+
        '<p><b>Report reason:</b> '+safe(r.reason)+'</p><div class="admin-report-actions">'+
        (content&&!content.is_hidden?'<button class="button danger" data-action="admin-content-hide" data-id="'+
         safe(r.content_kind+':'+r.content_id)+'">Hide content</button> ':'')+
        '<button class="button secondary" data-action="admin-content-reviewed" data-id="'+
         safe(r.id)+'">Mark reviewed</button></div></article>';
    }));
    return panel('🚩 Reported Blogs, Comments & Groups',
      '<p>Review member reports and hide content without deleting member data. Reports need regular human review.</p>'+
      (list.join('')||'<p class="admin-empty">No open text-content reports.</p>'));
  }
  function setFilter(value){
    if(!['open','dismissed','actioned'].includes(value))throw Error('Invalid filter');
    filter=value;
  }
  async function action(name,id,me) {
    await guard(me);
    if(name==='admin-filter'){setFilter(id);return {message:'Showing '+filter+' reports.'};}
    if(name==='admin-content-hide'){
      const match=/^(blog|blog_comment|group):([0-9a-f-]{36})$/i.exec(String(id||''));
      if(!match)throw Error('Invalid content reference.');
      if(!confirm('Hide this reported content from public Bebo pages without deleting it?'))return {cancelled:true};
      const table={blog:'bebo_blogs',blog_comment:'bebo_blog_comments',group:'bebo_groups'}[match[1]];
      const {data,error}=await sb.from(table).update({is_hidden:true}).eq('id',match[2]).eq('is_hidden',false)
        .select('id').maybeSingle();
      if(error)throw error;
      if(!data)throw Error('Content may already be hidden or deleted.');
      return {message:'Reported content is now hidden from public pages.'};
    }
    if(name==='admin-content-reviewed'){
      if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Invalid report ID.');
      if(!confirm('Mark this content report reviewed?'))return {cancelled:true};
      const {data,error}=await sb.from('bebo_content_reports')
        .update({status:'reviewed',reviewed_by:me.id,reviewed_at:new Date().toISOString()})
        .eq('id',id).eq('status','open').select('id').maybeSingle();
      if(error)throw error;
      if(!data)throw Error('Report may have been reviewed already.');
      return {message:'Content report reviewed.'};
    }
    if(['admin-photo-approve','admin-photo-reject','admin-photo-hide'].includes(name)){
      if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Invalid photo ID');
      const accepted=name==='admin-photo-approve';
      const expected=name==='admin-photo-hide'?'approved':'pending';
      if(!confirm(accepted?'Approve this photo for public display?':'Hide this photo from public galleries?'))return {cancelled:true};
      const {data,error}=await sb.from('bebo_photos')
        .update({moderation_status:accepted?'approved':'rejected',reviewed_by:me.id,
          reviewed_at:new Date().toISOString()})
        .eq('id',id).eq('moderation_status',expected).select('id').maybeSingle();
      if(error)throw error;
      if(!data)throw Error('Photo could not be updated. It may have already been reviewed.');
      return {message:accepted?'Photo approved for public galleries.':'Photo hidden from public galleries.'};
    }
    if(name==='admin-photo-report-reviewed'){
      if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Invalid report ID');
      if(!confirm('Mark this photo report as reviewed?'))return {cancelled:true};
      const {data,error}=await sb.from('bebo_photo_reports')
        .update({status:'reviewed',reviewed_at:new Date().toISOString(),reviewed_by:me.id})
        .eq('id',id).eq('status','open').select('id').maybeSingle();
      if(error)throw error;
      if(!data)throw Error('Photo report may already have been reviewed.');
      return {message:'Photo report marked reviewed.'};
    }
    if(!['admin-dismiss','admin-delete-post'].includes(name))return advanced.action(name,id,me);
    if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Invalid report identifier');
    if(name==='admin-dismiss'){
      if(!confirm('Dismiss this report without removing any content?'))return {cancelled:true};
      const {data,error}=await sb.from('bebo_reports').update({status:'dismissed'})
        .eq('id',id).eq('status','open').select('id,status').maybeSingle();
      if(error)throw error;
      if(!data)throw Error('Report was not updated. It may have been reviewed already.');
      return {message:'Report dismissed.'};
    }
    if(name==='admin-delete-post'){
      const {data:report,error:lookupError}=await sb.from('bebo_reports')
        .select('id,reported_post_id').eq('id',id).eq('status','open').maybeSingle();
      if(lookupError)throw lookupError;
      if(!report?.reported_post_id)throw Error('This report has no wall comment to remove.');
      if(!confirm('Permanently delete this reported wall comment? All reports about that comment will also be deleted.'))return {cancelled:true};
      const {data:deleted,error}=await sb.from('bebo_wall_posts').delete()
        .eq('id',report.reported_post_id).select('id').maybeSingle();
      if(error)throw error;
      if(!deleted)throw Error('Wall comment could not be removed. It might have been deleted already.');
      return {message:'Reported comment removed.'};
    }
    throw Error('Unknown admin operation.');
  }
  async function form(type,data,me){await guard(me);return advanced.form(type,data,me)}
  return {check,dashboard,action,form};
}
