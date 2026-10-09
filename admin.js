/**
 * Bebo Owner Admin Panel — visible only for verified, server-assigned moderator accounts.
 * Security comes from Supabase Auth and the database RLS, NOT from this JavaScript.
 * This module contains no service-role credentials and never grants privileges.
 */
import { createAdminAdvanced } from './admin-advanced.js?v=20261010-owner-me-fix';
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
      '</div>'+await advanced.panels(me,role);
  }
  function setFilter(value){
    if(!['open','dismissed','actioned'].includes(value))throw Error('Invalid filter');
    filter=value;
  }
  async function action(name,id,me) {
    await guard(me);
    if(name==='admin-filter'){setFilter(id);return {message:'Showing '+filter+' reports.'};}
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
