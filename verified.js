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
      '<span class="bebo-verified-badge" title="Bebo Verified — reviewed by the Bebo community owner" aria-label="Bebo Verified" role="img">✓</span>':'';
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
  return {approved,badge,prioritizePeople,prioritizeActivity,requestPanel,submit};
}
