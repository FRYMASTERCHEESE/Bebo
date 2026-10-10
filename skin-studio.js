// Bebo Skin Studio. Only validated colours, preset layouts and uploaded images are applied.
// JSON exports intentionally exclude image bytes/paths and all user account information.
export const skinHex = value => /^#[0-9a-fA-F]{6}$/.test(String(value || ''));
export function skinDesign(input) {
  const value = input || {};
  const name=String(value.name || '').trim().slice(0,70);
  const primary=String(value.primary_color || value.primary || '');
  const secondary=String(value.secondary_color || value.secondary || '');
  const accent=String(value.accent_color || value.accent || '#ffffff');
  const layout=String(value.layout || 'left');
  const motion=String(value.motion || 'off');
  if(!name || !skinHex(primary) || !skinHex(secondary) || !skinHex(accent) ||
     !['left','right'].includes(layout) || !['off','soft'].includes(motion)){
    throw Error('Choose a name, valid colours and a supported layout and motion setting.');
  }
  return {name,primary_color:primary,secondary_color:secondary,accent_color:accent,layout,motion};
}
export function importSkinJSON(text) {
  let data;
  try {data=JSON.parse(text)} catch {throw Error('This is not a valid skin JSON file.')}
  if(!data || data.format!=='bebo-skin-studio' || data.version!==1){
    throw Error('Choose a Bebo Skin Studio export (version 1).');
  }
  return skinDesign(data);
}
export function exportSkinJSON(design) {
  return JSON.stringify({format:'bebo-skin-studio',version:1,...skinDesign(design),
    note:'Images are not included. Re-upload your own pictures after importing.'},null,2)+'\n';
}
export function downloadSkin(design) {
  const json=exportSkinJSON(design);
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download='bebo-skin-'+skinDesign(design).name.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,35)+'.json';
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
export function fillSkinStudio(form,design) {
  const d=skinDesign(design);
  for(const [key,value] of Object.entries({
    name:d.name,primary:d.primary_color,secondary:d.secondary_color,
    accent:d.accent_color,layout:d.layout,motion:d.motion
  })){
    const control=form.elements.namedItem(key);
    if(control)control.value=value;
  }
  const id=form.elements.namedItem('skin_id');
  if(id)id.value='';
  for(const name of ['clear_banner','clear_background']){
    const field=form.elements.namedItem(name);if(field)field.checked=false;
  }
  previewSkinStudio(form);
}
export function previewSkinStudio(form) {
  if(!form || !form.matches('form[data-form="skin"]'))return;
  const data=new FormData(form);
  const primary=skinHex(data.get('primary'))?data.get('primary'):'#c52d61';
  const secondary=skinHex(data.get('secondary'))?data.get('secondary'):'#f5b2ce';
  const accent=skinHex(data.get('accent'))?data.get('accent'):'#ffffff';
  const wrap=form.querySelector('.skin-studio-preview');
  if(!wrap)return;
  wrap.style.setProperty('--studio-primary',primary);
  wrap.style.setProperty('--studio-secondary',secondary);
  wrap.style.setProperty('--studio-accent',accent);
  wrap.dataset.layout=data.get('layout')==='right'?'right':'left';
  wrap.dataset.motion=data.get('motion')==='soft'?'soft':'off';
  const title=wrap.querySelector('[data-studio-name]');
  if(title)title.textContent=String(data.get('name')||'My Bebo Skin').slice(0,70);
}
export function studioPanels(mine,editingId,safe,panel,photoStyle) {
  const chosen=mine.find(x=>x.id===editingId)||null;
  const d=chosen||{name:'My Bebo Skin',primary_color:'#c52d61',secondary_color:'#f5b2ce',
    accent_color:'#ffffff',motion:'off',layout:'left',banner_path:'',background_path:'',is_draft:true};
  const checked=(a,b)=>a===b?' selected':'';
  const owned=mine.map(s=>{
    const state=s.is_hidden?'Hidden by moderation':s.is_draft?'Private draft':'Shared with community';
    return '<article class="skin-studio-owned"><div class="skin-studio-owned-swatch" style="background:linear-gradient(125deg,'+
      safe(s.secondary_color)+','+safe(s.primary_color)+')"></div><div><strong>'+safe(s.name)+'</strong><p class="muted">'+safe(state)+'</p></div>'+
      '<div class="skin-studio-owned-actions"><button class="button secondary" type="button" data-action="skin-edit" data-id="'+safe(s.id)+'">Edit</button>'+
      '<button class="button secondary" type="button" data-action="skin-export" data-id="'+safe(s.id)+'">Export</button>'+
      '<button class="button secondary" type="button" data-action="skin-delete" data-id="'+safe(s.id)+'">Delete</button></div></article>';
  }).join('');
  const manager=panel('♥ My Skin Collection','<p>Manage your private drafts and shared skins. Your skin stays on your profile if you delete its shared gallery entry.</p>'+
    (owned||'<p class="muted">You have no custom designs yet. Create one below! ♥</p>'));
  const editor=panel('✎ Bebo Skin Studio'+(chosen?' — Editing '+safe(chosen.name):''),
    '<p>Create, preview, save privately or publish an original profile skin. Drag the ♥ Profile block to either side, or use the layout selector on mobile.</p>'+
    '<form class="fields skin-studio-form" data-form="skin"><input type="hidden" name="skin_id" value="'+safe(chosen?.id||'')+'">'+
    '<label>Skin name<input type="text" name="name" required maxlength="70" value="'+safe(d.name)+'"></label>'+
    '<div class="skin-studio-colours"><label>Main colour<input type="color" name="primary" value="'+safe(d.primary_color)+'"></label>'+
    '<label>Second colour<input type="color" name="secondary" value="'+safe(d.secondary_color)+'"></label>'+
    '<label>Accent colour<input type="color" name="accent" value="'+safe(d.accent_color)+'"></label></div>'+
    '<div class="skin-studio-settings"><label>Profile panel layout<select name="layout"><option value="left"'+checked(d.layout,'left')+'>Photo on left</option><option value="right"'+checked(d.layout,'right')+'>Photo on right</option></select></label>'+
    '<label>Decoration animation<select name="motion"><option value="off"'+checked(d.motion,'off')+'>Still</option><option value="soft"'+checked(d.motion,'soft')+'>Gentle sparkle</option></select></label></div>'+
    '<div class="skin-studio-preview" aria-label="Live design preview" data-layout="'+safe(d.layout)+'" data-motion="'+safe(d.motion)+'" style="--studio-primary:'+safe(d.primary_color)+';--studio-secondary:'+safe(d.secondary_color)+';--studio-accent:'+safe(d.accent_color)+'">'+
    '<div class="skin-studio-preview-head"><strong data-studio-name>'+safe(d.name)+'</strong> ♥</div>'+
    '<div class="skin-studio-dropzones"><div data-studio-drop="left">Drop photo here</div><div data-studio-drop="right">Drop photo here</div></div>'+
    '<div class="skin-studio-preview-body"><div class="skin-studio-preview-photo" draggable="true" data-studio-drag="photo" tabindex="0" aria-label="Drag profile photo to rearrange">♥ Profile photo</div><div class="skin-studio-preview-posts">My profile ♥<p>Friends · Luv · Whiteboards</p></div></div></div>'+
    '<button type="button" class="button secondary" data-action="skin-swap">↔ Swap photo side</button>'+
    '<label>Header/banner picture (PNG, JPG, WebP, up to 5 MB)<input type="file" name="banner" accept="image/png,image/jpeg,image/webp"></label>'+
    (chosen?.banner_path?'<p class="muted">A banner is saved. Leave upload blank to keep it.</p><label><input type="checkbox" name="clear_banner"> Remove existing banner</label>':'')+
    '<label>Full-page background picture (PNG, JPG, WebP, up to 5 MB)<input type="file" name="background" accept="image/png,image/jpeg,image/webp"></label>'+
    (chosen?.background_path?'<p class="muted">A page background is saved. Leave upload blank to keep it.</p><label><input type="checkbox" name="clear_background"> Remove existing background</label>':'')+
    '<label>Who can see this design?<select name="visibility"><option value="draft"'+checked(d.is_draft?'draft':'public','draft')+'>Private draft (only me)</option>'+
    '<option value="public"'+checked(d.is_draft?'draft':'public','public')+'>Publish to Bebo community</option></select></label>'+
    '<div class="skin-studio-actions"><button class="button" type="submit">'+(chosen?'Save changes ♥':'Save my skin ♥')+'</button>'+
    (chosen?'<button type="button" class="button secondary" data-action="skin-cancel">Create new skin</button>':'')+'</div>'+
    '<p class="muted">For your safety, uploaded pictures are screened by file type/size. Custom scripts, Flash, untrusted CSS and HTML are not supported. Images are stored separately and are not included in exported design files.</p></form>');
  const imports=panel('📁 Import a Skin Design','<p>Import a JSON file exported by Bebo Skin Studio. Check the preview and save it as a new design. Images must be re-uploaded.</p>'+
    '<label class="skin-studio-import">Choose a Bebo design JSON file<input type="file" id="skin-studio-import" accept=".json,application/json"></label>');
  return manager+editor+imports;
}
