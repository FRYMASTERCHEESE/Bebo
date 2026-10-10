// Bebo member suggestion inbox. All privacy and owner-only writes are enforced by Supabase RLS.
export const suggestionCategories={
  feature:'💡 New feature',bug:'🐛 Report a bug',design:'🎨 Design & skins',
  accessibility:'♿ Accessibility',other:'❤️ Other idea'
};
export const suggestionStatuses={
  new:'New',planned:'Planned',in_progress:'In progress',done:'Completed',declined:'Not planned'
};
export const suggestionPriorities={low:'Low',normal:'Normal',high:'High'};
const allowed=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const trim=(v,max)=>String(v??'').trim().slice(0,max);
const validID=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id));
const readableDate=v=>{
  const t=Date.parse(v);
  return Number.isFinite(t)?new Date(t).toLocaleString('en-NZ',{dateStyle:'medium',timeStyle:'short'}):'Unknown date';
};
export function validateSuggestion(form){
  const category=String(form.get('category')||'');
  const title=trim(form.get('title'),110);
  const details=trim(form.get('details'),2000);
  if(!allowed(suggestionCategories,category))throw Error('Choose a suggestion category.');
  if(title.length<8)throw Error('Give your suggestion a title of at least 8 characters.');
  if(details.length<20)throw Error('Please describe your idea or problem in at least 20 characters.');
  return {category,title,details};
}
export function createSuggestions(sb,{safe,panel}){
  let currentFilter='new';
  const fetchRows=async promise=>{
    const {data,error}=await promise;
    if(error)throw error;
    return data||[];
  };
  const label=(obj,id)=>safe(obj[id]||String(id));
  const statusBadge=s=>'<span class="bebo-suggestion-status" data-status="'+safe(s)+'">'+label(suggestionStatuses,s)+'</span>';
  async function page(me,profile){
    if(!me?.id)return panel('💡 Suggest an Improvement ♥',
      '<p>Help make Bebo even better! Share new features, report bugs, and tell us what you would love to see.</p>'+
      '<p>To protect the community from spam, <a href="#/account">sign in or join Bebo</a> before sending a suggestion.</p>'+
      '<p class="muted">Your message goes directly to the Bebo owner\'s private admin inbox, not onto a public wall.</p>');
    if(!profile)return panel('💡 Suggest an Improvement ♥',
      '<p><a href="#/profile">Finish creating your Bebo profile</a> to send feedback.</p>');
    const mine=await fetchRows(sb.from('bebo_suggestions')
      .select('id,category,title,details,status,priority,admin_note,created_at')
      .eq('author_id',me.id).order('created_at',{ascending:false}).limit(30));
    const form=panel('💡 Suggest an Improvement ♥',
      '<p><strong>What should we improve next?</strong> Your ideas, feature requests, design suggestions and bug reports are sent privately to the Bebo owner\'s admin panel.</p>'+
      '<form class="fields bebo-suggestion-form" data-form="suggestion">'+
      '<label>What is this about?<select name="category" required>'+
      '<option value="">Choose one…</option>'+
      Object.entries(suggestionCategories).map(([k,v])=>'<option value="'+k+'">'+safe(v)+'</option>').join('')+
      '</select></label>'+
      '<label>Suggestion title <span class="muted">(8–110 characters)</span>'+
      '<input name="title" type="text" required minlength="8" maxlength="110" placeholder="Example: Add more animated profile skins"></label>'+
      '<label>Tell us about your idea <span class="muted">(20–2000 characters)</span>'+
      '<textarea name="details" required minlength="20" maxlength="2000" rows="7" placeholder="Describe what you would like to see, or what is not working. Include steps to reproduce a bug."></textarea></label>'+
      '<button class="button" type="submit">💌 Send to Bebo Admin</button>'+
      '<p class="muted">Only you and the Bebo owner can view your submission. Please do not include passwords, private contact details or sensitive information. Limit: 5 suggestions per 24 hours, at least 1 minute apart.</p></form>');
    const history=mine.map(x=>'<article class="bebo-suggestion-card">'+
      '<header><strong>'+safe(x.title)+'</strong> '+statusBadge(x.status)+'</header>'+
      '<p class="muted">'+label(suggestionCategories,x.category)+' · '+readableDate(x.created_at)+'</p>'+
      '<p class="bebo-suggestion-message">'+safe(x.details)+'</p>'+
      (x.admin_note?'<div class="bebo-suggestion-response"><strong>💌 Bebo owner response</strong><p>'+safe(x.admin_note)+'</p></div>':'')+
      '</article>').join('');
    return form+panel('♥ My Suggestions',
      '<p>Come back here to see the status of ideas you have submitted.</p>'+
      (history||'<p class="admin-empty">You have not sent any suggestions yet. Be the first! ♥</p>'));
  }
  async function submit(form,me,profile){
    if(!me?.id||!profile)throw Error('Sign in and create a Bebo profile before sending feedback.');
    const values=validateSuggestion(form);
    const {data,error}=await sb.from('bebo_suggestions')
      .insert({...values,author_id:me.id}).select('id').single();
    if(error)throw error;
    if(!validID(data?.id))throw Error('The suggestion could not be confirmed as saved.');
    return 'Thanks! Your suggestion was sent privately to the Bebo admin panel ♥';
  }
  function setFilter(value){
    if(value!=='all'&&!allowed(suggestionStatuses,value))throw Error('Unknown suggestion filter.');
    currentFilter=value;
    return {message:'Showing '+(value==='all'?'all':suggestionStatuses[value].toLowerCase())+' suggestions.'};
  }
  async function ownerPage(){
    const [all,newCount]=await Promise.all([
      fetchRows((()=>{let q=sb.from('bebo_suggestions')
        .select('id,author_id,category,title,details,status,priority,admin_note,created_at,updated_at')
        .order('created_at',{ascending:false}).limit(70);
        if(currentFilter!=='all')q=q.eq('status',currentFilter);
        return q;})()),
      sb.from('bebo_suggestions').select('id',{count:'exact',head:true}).eq('status','new')
    ]);
    if(newCount.error)throw newCount.error;
    const ids=[...new Set(all.map(x=>x.author_id))];
    const profiles=ids.length?await fetchRows(sb.from('bebo_profiles')
      .select('id,username,display_name').in('id',ids)):[];
    const byID=new Map(profiles.map(p=>[p.id,p]));
    const filters=[['new','New'],['planned','Planned'],['in_progress','In progress'],
      ['done','Completed'],['declined','Not planned'],['all','All']];
    const controls='<div class="bebo-suggestion-filters">'+filters.map(([key,name])=>
      '<button type="button" class="button '+(key===currentFilter?'':'secondary')+
      '" data-action="admin-suggestion-filter" data-id="'+key+'" aria-pressed="'+String(key===currentFilter)+'">'+name+'</button>').join('')+'</div>';
    const cards=all.map(x=>{
      const person=byID.get(x.author_id);
      const who=person?'<a href="#/u/'+encodeURIComponent(person.username)+'">'+safe(person.display_name)+
        ' (@'+safe(person.username)+')</a>':'<span class="muted">Member not found</span>';
      const options=(map,current)=>Object.entries(map).map(([key,label])=>'<option value="'+key+'"'+
        (key===current?' selected':'')+'>'+safe(label)+'</option>').join('');
      return '<article class="bebo-suggestion-card bebo-suggestion-admin-card">'+
        '<header><strong>'+safe(x.title)+'</strong> '+statusBadge(x.status)+'</header>'+
        '<p class="muted">From '+who+' · '+label(suggestionCategories,x.category)+
        ' · '+readableDate(x.created_at)+'</p>'+
        '<p class="bebo-suggestion-message">'+safe(x.details)+'</p>'+
        '<form class="fields" data-form="admin-suggestion-review">'+
        '<input type="hidden" name="id" value="'+safe(x.id)+'">'+
        '<div class="bebo-suggestion-fields"><label>Status<select name="status">'+options(suggestionStatuses,x.status)+'</select></label>'+
        '<label>Priority<select name="priority">'+options(suggestionPriorities,x.priority)+'</select></label></div>'+
        '<label>Private review note (shown to this member only)<textarea name="admin_note" maxlength="1200" rows="3" placeholder="Thanks for your idea! ♥">'+safe(x.admin_note||'')+'</textarea></label>'+
        '<button class="button" type="submit">Save review ♥</button></form></article>';
    }).join('');
    return panel('💡 Member Suggestions · '+Number(newCount.count||0)+' new',
      '<p>Suggestions arrive directly here from the website. Only your owner account can review, prioritise and respond. Members see only their own messages and your replies.</p>'+
      controls+(cards||'<p class="admin-empty">♥ No suggestions in this category yet.</p>')+
      '<p class="muted">Showing up to 70 recent submissions in this filter. Changing status updates the member\'s private tracking page. Nothing is published to the homepage.</p>');
  }
  async function ownerReview(form){
    const id=String(form.get('id')||''),status=String(form.get('status')||''),
      priority=String(form.get('priority')||''),
      note=trim(form.get('admin_note'),1200);
    if(!validID(id)||!allowed(suggestionStatuses,status)||!allowed(suggestionPriorities,priority)){
      throw Error('Invalid suggestion review details.');
    }
    const {data,error}=await sb.from('bebo_suggestions').update({
      status,priority,admin_note:note
    }).eq('id',id).select('id,status').maybeSingle();
    if(error)throw error;
    if(!data)throw Error('The suggestion was not updated. Please refresh and try again.');
    return {message:'Suggestion updated to '+suggestionStatuses[status]+' ♥'};
  }
  return {page,submit,ownerPage,ownerReview,setFilter};
}
