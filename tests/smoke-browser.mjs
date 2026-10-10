// Bebo public launch smoke test: READ-ONLY. No registration, posts, votes or uploads.
import { chromium, devices } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const host='https://frymastercheese.github.io/Bebo/';
const tests=[
{path:'home', label:'Homepage',match:/welcome to bebo|people on bebo/i},
{path:'u/bebo',label:'Profile',match:/bebo.s profile|my profile picture|about me/i},
{path:'skins',label:'Skins',match:/bebo skin gallery/i,skins:true},
{path:'polls',label:'Polls',match:/bebo polls/i},
{path:'quizzes',label:'Quizzes',match:/bebo quizzes|how well do you know me/i},
{path:'photos',label:'Photos',match:/photos|albums/i},
{path:'blogs',label:'Blogs',match:/blog/i},
{path:'groups',label:'Groups',match:/groups/i},
{path:'creators',label:'Bands and Authors',match:/bands|authors|creators/i},
{path:'safety',label:'Privacy',match:/community rules.*privacy/i},
{path:'account',label:'Signup',match:/join bebo|create your account/i,signup:true},
{path:'admin',label:'Admin guest denial',match:/join bebo|create your account|admin only/i,guestAdmin:true}
];
const results=[],errors=[];const browser=await chromium.launch({headless:true});
try{
 await fs.mkdir('test-results',{recursive:true});
 for(const device of [{name:'desktop',options:{viewport:{width:1365,height:900}}},{name:'mobile',options:devices['Pixel 7']}]){
  const context=await browser.newContext(device.options),page=await context.newPage();
  page.on('pageerror',e=>errors.push(device.name+': '+String(e.message)));
  for(const check of tests){
   const item={layout:device.name,route:check.path,status:'UNKNOWN'};
   try{
    await page.goto(host+'?launch-audit=20261010&route='+encodeURIComponent(device.name+'-'+check.path)+'#/'+check.path,{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForFunction(()=>Boolean(document.querySelector('#app')?.innerText?.trim())&&!/Loading your profile|Loading Bebo/i.test(document.querySelector('#app')?.innerText||''),null,{timeout:35000});
    await page.waitForFunction(({source,flags})=>new RegExp(source,flags).test(document.querySelector('#app')?.innerText||''),{source:check.match.source,flags:check.match.flags},{timeout:30000});
    if(device.name==='mobile'){
      await page.waitForFunction(()=>[...document.querySelectorAll('style')].some(x=>x.textContent.includes('Touchscreen fix: Chrome/Android')),null,{timeout:20000});
    }
    const inner=await page.locator('#app').innerText();
    assert(!/Could not load this page|me is not defined|ReferenceError|TypeError/i.test(inner),'Fatal error shown: '+inner.slice(0,450));
    assert(check.match.test(inner),'Missing expected '+check.label+': '+inner.slice(0,300));
    if(check.skins){const n=await page.locator('.skin-card').count();assert(n>=50,'Expected at least 50 skins, found '+n);item.skins=n;}
    if(check.signup){
      const password=page.locator('form[data-form="signup"] input[name="password"]');
      assert.equal(await password.count(),1,'Missing signup password input');
      assert(Number(await password.getAttribute('minlength'))>=8,'Password rule below 8 characters');
      assert.equal(await page.locator('form[data-form="signup"] input[name="adult"]').count(),1);

      // Read-only inspect the authenticated profile form template without creating an account.
      const checkNames=await page.evaluate(async()=>{
        const response=await fetch('./social.js?name-smoke-20261010',{cache:'no-store'});
        if(!response.ok)throw Error('Could not load Bebo signup code');
        const source=await response.text();
        const start=source.indexOf('function createProfile(){');
        const end=source.indexOf('function editProfile(){',start);
        if(start<0||end<start)throw Error('Profile name form not found');
        const formHTML=Function('panel',source.slice(start,end)+';return createProfile();')((title,body)=>body);
        const root=document.createElement('div');root.innerHTML=formHTML;
        const username=root.querySelector('input[name="username"]');
        const display=root.querySelector('input[name="display_name"]');
        if(!username||!display)throw Error('Missing editable names');
        username.value='Rose_red'; const capitals=username.checkValidity();
        username.value='Rose Red'; const spaces=username.checkValidity();
        display.value='Opal ❤️'; const emoji=display.checkValidity();
        return {capitals,spaces,emoji,info:root.textContent};
      });
      assert(checkNames.capitals&&checkNames.spaces&&checkNames.emoji,'Profile form rejected capitals, spaces or emoji');
      assert(/spaces are automatically changed to underscores/i.test(checkNames.info),'Missing username normalization guidance');
    }
    if(check.guestAdmin){
      assert.equal(await page.locator('.bebo-admin-page').count(),0,'Private admin dashboard rendered for guest');
      assert(!/Member Reports|Owner Control Centre/.test(inner),'Admin data visible to guest');
    }
    if(device.name==='mobile'){
      const layout=await page.evaluate(()=>{
        const styleOf=selector=>{
          const node=document.querySelector(selector);
          return node?getComputedStyle(node).userSelect:null;
        };
        return {
          scroll:document.documentElement.scrollWidth,
          viewport:window.innerWidth,
          regularText:styleOf('#app .panel h2')||styleOf('#app h1'),
          announcement:styleOf('#bebo-announcement-bar .bebo-announcement-preview'),
          editable:styleOf('#app input')||styleOf('#app textarea')
        };
      });
      assert(layout.scroll<=layout.viewport+8,'Horizontal overflow '+layout.scroll+'px > '+layout.viewport+'px');
      assert.equal(layout.regularText,'none','Mobile text could still trigger selection search menu');
      assert.equal(layout.announcement,'none','Announcement text is still selectable on mobile');
      if(check.signup)assert.equal(layout.editable,'text','Signup field must remain selectable and editable');
    }
    if(check.path==='home')await page.screenshot({path:'test-results/'+device.name+'-home.png',fullPage:true});
    item.status='PASS';
   }catch(e){
    item.status='FAIL';item.error=String(e.message).slice(0,600);
    await page.screenshot({path:'test-results/'+device.name+'-'+check.path.replaceAll('/','-')+'.png',fullPage:true}).catch(()=>{});
   }
   results.push(item);
   console.log(item.layout.padEnd(8)+' '+item.route.padEnd(12)+' '+item.status+(item.error?' '+item.error:''));
  }
  await context.close();
 }
}finally{await browser.close()}
const summary={pass:results.filter(x=>x.status==='PASS').length,fail:results.filter(x=>x.status==='FAIL').length,details:results,pageErrors:errors};
await fs.writeFile('test-results/results.json',JSON.stringify(summary,null,2));
console.log('SUMMARY '+summary.pass+'/'+results.length+' passed; uncaught errors '+errors.length);
if(errors.length)console.error('Uncaught JS errors:',errors.slice(0,12));
process.exitCode=summary.fail||errors.length?1:0;
