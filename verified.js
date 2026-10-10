/* Bebo Verified: Bebo's own optional reviewed-profile badge and discovery ranking.
   Not affiliated with Meta and not a paid or government-ID verification scheme. */
export function createVerification(sb,{safe,panel,query}){
  const validId=v=>/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(String(v||''));
  async function approved(ids){
    const unique=[...new Set((ids||[]).filter(validId))];
    if(!unique.length)return new Set();
    const result=await query('bebo_verified_profiles',q=>q.select('user_id').in('user_id',unique));
    return new Set((result||[]).map(x=>x.user_id));
  }
  function badge(p,approvedIDs){
    return p&&approvedIDs?.has(p.id)?
      '<span class="bebo-verified-badge" tabindex="0" role="button" data-action="verified-info" data-id="'+safe(p.id)+
      '" aria-label="View Bebo Verified information for '+safe(p.display_name||p.username||'this profile')+
      '" aria-haspopup="dialog" title="View Bebo Verified details and profile transparency">✓</span>':'';
  }
  function prioritizePeople(rows,approvedIDs){
    return [...rows].map((p,index)=>({p,index})).sort((a,b)=>
      Number(approvedIDs.has(b.p.id))-Number(approvedIDs.has(a.p.id)) || a.index-b.index
    ).map(x=>x.p);
  }
  function prioritizeActivity(feed,approvedIDs){
    // Boost verified creators by two days; newer unverified posts still compete.
    const bonus=48*60*60*1000;
    return [...feed].sort((a,b)=>{
      const t=x=>(Number.isFinite(Date.parse(x.date))?Date.parse(x.date):0)+
        (approvedIDs.has(x.owner_id)?bonus:0);
      return t(b)-t(a);
    });
  }
  async function requestPanel(me){
    if(!me?.id)return panel('✓ Bebo Verified','<p>Sign in to request a reviewed Bebo badge.</p>');
    const [badges,request]=await Promise.all([
      approved([me.id]),
      query('bebo_verification_requests',q=>q.select('status,requested_at').eq('user_id',me.id).maybeSingle())
    ]);
    if(badges.has(me.id))return panel('✓ Bebo Verified','<p><span class="bebo-verified-badge" aria-label="Bebo Verified">✓</span> Your Bebo profile has been approved for a Verified badge and receives a discovery boost.</p><p class="muted">Bebo Verified is an independent Bebo community review, not a Meta verification or a government-ID check. It does not guarantee reach.</p>');
    let content='<p>Apply for a <strong>Bebo Verified ✓</strong> profile badge. The Bebo owner reviews requests. Approved profiles get a blue check and a boost in Bebo member discovery and recent activity. It does not guarantee followers or views.</p>';
    if(request){
      content+='<p class="bebo-verified-status"><strong>Request status:</strong> '+safe(request.status)+' · '+new Date(request.requested_at).toLocaleDateString('en-NZ')+'</p>'+
      (request.status==='declined'?'<p>Your request was not approved. You can contact the Bebo team if you would like it reconsidered.</p>':'<p>There is nothing else you need to submit at the moment.</p>');
    }else{
      content+='<form class="fields" data-form="verification-request">'+
        '<label>Why should your Bebo account be verified?'+
        '<textarea name="reason" minlength="10" maxlength="350" rows="3" required placeholder="Tell us who you are and why your Bebo profile should be reviewed."></textarea></label>'+
        '<p class="muted">Do not include passwords, passport numbers, identity documents or other sensitive information. Requests are private to you and the Bebo owner.</p>'+
        '<button type="submit" class="button">✓ Request Bebo Verification</button></form>';
    }
    content+='<p class="muted">A badge means the Bebo owner approved this profile for the community programme. It is not a guarantee of real-world identity.</p>';
    return panel('✓ Request Bebo Verified',content);
  }
  async function submit(me,data){
    if(!me?.id)throw Error('Sign in to Bebo to request verification.');
    const reason=String(data.get('reason')??'').trim();
    if(reason.length<10||reason.length>350)throw Error('Please write 10–350 characters about your profile.');
    await query('bebo_verification_requests',q=>q.insert({user_id:me.id,reason}));
    return 'Your Bebo Verified request has been sent privately to the owner.';
  }
  // Verified information is built only from the public profile and the server-owned badge row.
  // Do not manufacture profile updates, name histories or management locations.
  const date=value=>{
    if(!value||!Number.isFinite(Date.parse(value)))return 'Not available';
    return new Intl.DateTimeFormat('en-NZ',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value));
  };
  const icon=(symbol)=>'<span class="bebo-trust-icon" aria-hidden="true">'+symbol+'</span>';
  function policyPage(){
    return panel('✓ About Bebo Verified',
      '<div class="bebo-trust-info-page">'+
      '<p><strong>Bebo Verified</strong> is the verification programme for this Bebo community website. It is not Meta Verified and is not a certification from the original Bebo company.</p>'+
      '<h3>What the badge means</h3>'+
      '<p>A Bebo owner reviewed and approved the account for a community badge. That is not the same as checking a government ID, confirming someone’s legal identity or independently verifying a business.</p>'+
      '<h3>How members apply</h3>'+
      '<p>Members can request verification from their own profile. The Bebo owner can approve, decline or remove a badge using the private Admin Panel.</p>'+
      '<h3>Does verification improve reach?</h3>'+
      '<p>Verified members receive an extra placement boost in Bebo’s member discovery and homepage activity ranking. It does not guarantee views, engagement or followers. Everyone can continue to post without being verified.</p>'+
      '<h3>Safety, privacy and reporting</h3>'+
      '<p>Do not share passwords, identity documents or sensitive details in a verification application. If you see impersonation or harmful behaviour, use Bebo’s profile and comment reporting tools.</p>'+
      '<p><a href="#/safety">Community rules and privacy information »</a></p>'+
      '</div>');
  }
  async function publicDetails(id){
    if(!validId(id))throw Error('Invalid verified member.');
    const [profile,verification]=await Promise.all([
      query('bebo_profiles',q=>q.select('id,username,display_name,avatar_path,created_at,location').eq('id',id).maybeSingle()),
      query('bebo_verified_profiles',q=>q.select('user_id,verified_at').eq('user_id',id).maybeSingle())
    ]);
    if(!profile||!verification)throw Error('This profile does not currently have a Bebo Verified badge.');
    return {profile,verification};
  }
  function avatarHTML(profile){
    if(profile.avatar_path){
      const url=sb.storage.from('bebo-avatars').getPublicUrl(profile.avatar_path).data.publicUrl;
      return '<img class="bebo-trust-avatar" src="'+safe(url)+'" alt="" decoding="async" loading="lazy">';
    }
    return '<span class="bebo-trust-avatar bebo-trust-initial" aria-hidden="true">'+safe((profile.display_name||'?').slice(0,1).toUpperCase())+'</span>';
  }
  function trustContent({profile,verification}){
    const isSiteProfile=profile.username.toLowerCase()==='bebo';
    const username=encodeURIComponent(profile.username);
    const kind=isSiteProfile?'Bebo community site profile':'Bebo community member';
    return '<div class="bebo-trust-intro">'+avatarHTML(profile)+
      '<h2>'+safe(profile.display_name)+'</h2><p>@'+safe(profile.username)+'</p>'+
      '<p class="bebo-trust-intro-note">Information to help you understand this Bebo profile.</p></div>'+
      '<section class="bebo-trust-card">'+
        '<div class="bebo-trust-card-title">'+icon('✓')+'<div><h3>'+safe(profile.display_name)+' is Bebo Verified</h3>'+
        '<p>This account has received a Bebo community verification badge.</p></div></div>'+
        '<p>Approval is reviewed by the Bebo website owner. This badge does not certify someone’s real-world identity, affiliation, or legal status.</p>'+
        '<a class="bebo-trust-link" href="#/verification-policy">Learn about Bebo Verified »</a>'+
      '</section>'+
      '<section class="bebo-trust-card">'+
        '<h3 class="bebo-trust-section">Profile transparency</h3>'+
        '<p>These details come from Bebo’s own profile and verification records.</p>'+
        '<div class="bebo-trust-fact">'+icon('▦')+'<div><strong>Profile created</strong><span>'+safe(date(profile.created_at))+'</span></div></div>'+
        '<div class="bebo-trust-fact">'+icon('✓')+'<div><strong>Bebo Verified since</strong><span>'+safe(date(verification.verified_at))+'</span></div></div>'+
        '<div class="bebo-trust-fact">'+icon('★')+'<div><strong>Account category</strong><span>'+safe(kind)+'</span></div></div>'+
        (profile.location?'<div class="bebo-trust-fact">'+icon('⌖')+'<div><strong>Profile location</strong><span>'+safe(profile.location)+' <small>(entered by the member)</small></span></div></div>':'')+
        '<div class="bebo-trust-fact">'+icon('↺')+'<div><strong>Previous names and updates</strong><span>Public history is not available on Bebo yet.</span></div></div>'+
        '<p class="bebo-trust-fineprint">Management locations and private account information are not displayed. Only public details are shown.</p>'+
        '<a class="bebo-trust-link" href="#/transparency/'+username+'">See full profile transparency »</a>'+
      '</section>'+
      '<section class="bebo-trust-card bebo-trust-benefits"><h3>What Bebo Verified provides</h3>'+
        '<p>✓ A blue badge on approved Bebo profiles</p>'+
        '<p>✓ Extra placement in Bebo member discovery and homepage activity</p>'+
        '<p>✓ Public verification and profile transparency details</p>'+
        '<p>Verification does not guarantee reach or special support.</p>'+
        '<p><a class="bebo-trust-link" href="#/safety">Safety and community rules »</a></p></section>'+
      '<p class="bebo-trust-profile-link"><a href="#/u/'+username+'">♥ Back to '+safe(profile.display_name)+'’s profile</a></p>';
  }
  async function transparencyPage(username){
    const p=await query('bebo_profiles',q=>q.select('id,username').ilike('username',String(username||'').replace(/[%_\\]/g,'\\$&')).maybeSingle());
    if(!p)return panel('Profile not found','This Bebo profile does not exist.');
    try{
      const details=await publicDetails(p.id);
      return '<div class="bebo-trust-full">'+trustContent(details)+'</div>';
    }catch(error){
      return panel('Profile transparency','This profile does not currently have a Bebo Verified badge. <a href="#/u/'+encodeURIComponent(p.username)+'">View profile »</a>');
    }
  }
  let dialog=null;
  let previousFocus=null;
  function closeDialog(){
    if(!dialog)return;
    dialog.remove();dialog=null;
    document.body.classList.remove('bebo-trust-dialog-open');
    if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
    previousFocus=null;
  }
  async function openDialog(id){
    const details=await publicDetails(id);
    closeDialog();
    previousFocus=document.activeElement;
    dialog=document.createElement('div');
    dialog.id='bebo-verified-overlay';
    dialog.className='bebo-trust-overlay';
    dialog.innerHTML='<div class="bebo-trust-backdrop" data-action="verified-close" aria-hidden="true"></div>'+
      '<div class="bebo-trust-dialog" role="dialog" aria-modal="true" aria-labelledby="bebo-trust-dialog-heading">'+
      '<div class="bebo-trust-handle" aria-hidden="true"></div>'+
      '<header class="bebo-trust-dialog-top"><h2 id="bebo-trust-dialog-heading">Profile information</h2>'+
      '<button type="button" class="bebo-trust-close" data-action="verified-close" aria-label="Close profile information">×</button></header>'+
      '<div class="bebo-trust-scroller">'+trustContent(details)+'</div></div>';
    document.body.append(dialog);
    document.body.classList.add('bebo-trust-dialog-open');
    dialog.querySelector('.bebo-trust-close')?.focus({preventScroll:true});
  }
  return {approved,badge,prioritizePeople,prioritizeActivity,requestPanel,submit,publicDetails,policyPage,transparencyPage,openDialog,closeDialog};

}
