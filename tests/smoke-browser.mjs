// Bebo public launch smoke test: READ-ONLY. No registration, posts, votes or uploads.
import { chromium, devices } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const host='https://frymastercheese.github.io/Bebo/';
const tests=[
{path:'home', label:'Homepage',match:/sign up\. build your profile\. find friends\.|welcome back to bebo/i,eraTest:true},
{path:'u/bebo',label:'Profile',match:/bebo.s profile|my profile picture|about me/i,verifiedBadge:true},
{path:'transparency/bebo',label:'Verified profile transparency',match:/Bebo Verified since|Profile transparency/i},
{path:'verification-policy',label:'Bebo Verified rules',match:/not Meta Verified|What the badge means/i},
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
// Wait until GitHub Pages publishes the matching revision; Actions can run before Pages.
const expectedCSS='Always-available Bebo navigation: reachable while scrolling every route.';
let releaseReady=false;
for(let n=0;n<40;n++){
  try{
    const html=await (await fetch(host+'?wait-for-css='+Date.now(),{cache:'no-store'})).text();
    const aboutIsPublished=html.includes('<a class="bebo-about-link" href="./about.html">About Bebo</a>');
    if(html.includes(expectedCSS)&&aboutIsPublished){releaseReady=true;break;}
  }catch(error){console.warn('Waiting for Bebo Pages:',String(error));}
  await new Promise(resolve=>setTimeout(resolve,3000));
}
assert(releaseReady,'GitHub Pages has not published the global navigation and About Bebo link yet.');
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
      await page.waitForFunction(()=>[...document.querySelectorAll('style')].some(x=>x.textContent.includes('Mobile copy restoration: users can long-press and highlight Bebo posts, profiles,')),null,{timeout:20000});
    }
    const inner=await page.locator('#app').innerText();
    assert(!/Could not load this page|me is not defined|ReferenceError|TypeError/i.test(inner),'Fatal error shown: '+inner.slice(0,450));
    assert(check.match.test(inner),'Missing expected '+check.label+': '+inner.slice(0,300));
    const globalBack=page.locator('#bebo-back-button');
    assert.equal(await globalBack.count(),1,'Missing global Bebo Back button');
    assert.equal(await page.locator('.bebo-quick-nav a[href="#/home"]').count(),1,'Missing global Home link');
    const backPosition=await globalBack.evaluate(button=>{
      const rect=button.getBoundingClientRect();
      return {width:rect.width,height:rect.height,left:rect.left,top:rect.top,bottom:rect.bottom,viewport:window.innerHeight,
        fixed:getComputedStyle(button.closest('.bebo-quick-nav')).position};
    });
    assert.equal(backPosition.fixed,'fixed','Bebo Back button does not remain visible while scrolling');
    assert(backPosition.height>=42,'Bebo Back button target too small for phone tapping');
    assert(backPosition.bottom<=backPosition.viewport+2&&backPosition.top>=0,'Bebo Back button out of the viewport');
    if(check.eraTest){
      await page.locator('.classic-home-2005').waitFor({state:'visible',timeout:15000});
      const fresh=await page.evaluate(()=>({
        era:document.documentElement.dataset.beboEra,
        preference:localStorage.getItem('bebo-classic-look-v1'),
        selected:document.querySelector('[data-era="2005"]')?.getAttribute('aria-pressed'),
        top:getComputedStyle(document.querySelector('.top')).backgroundColor
      }));
      assert.equal(fresh.era,'2005','New visitors must default to Bebo 2005');
      assert.equal(fresh.preference,null,'A new visitor should not inherit a saved choice');
      assert.equal(fresh.selected,'true','2005 option must be active');
      assert.equal(fresh.top,'rgb(255, 255, 255)','2005 masthead should be white');
      const links=await page.locator('.bebo05-steps a').count();
      assert.equal(links,3,'2005 signup/build/friends steps missing');
      await page.locator('[data-era="2007"]').click();
      await page.locator('.classic-home-2007').waitFor({state:'visible',timeout:15000});
      assert.equal(await page.evaluate(()=>localStorage.getItem('bebo-classic-look-v1')),'2007','Classic selection not saved');
      await page.reload({waitUntil:'domcontentloaded'});
      await page.locator('.classic-home-2007').waitFor({state:'visible',timeout:15000});
      assert.equal(await page.locator('[data-era="2007"]').getAttribute('aria-pressed'),'true','Saved 2007 preference not restored');
      await page.locator('[data-era="2005"]').click();
      await page.locator('.classic-home-2005').waitFor({state:'visible',timeout:15000});
      assert.equal(await page.locator('[data-era="2005"]').getAttribute('aria-pressed'),'true','2005 button did not restore early Bebo');
      item.switchCheck='PASS';
    }
    if(check.verifiedBadge){
      const badge=page.locator('#app .bebo-nameplate [data-action="verified-info"]');
      await badge.waitFor({state:'visible',timeout:10000});
      assert.equal(await badge.getAttribute('role'),'button','Verified badge is not accessible');
      await badge.click();
      const dialog=page.locator('#bebo-verified-overlay [role="dialog"]');
      await dialog.waitFor({state:'visible',timeout:12000});
      const trustText=await dialog.innerText();
      for(const required of ['Bebo is Bebo Verified','Profile transparency','Profile created','Bebo Verified since','Learn about Bebo Verified']){
        assert(trustText.includes(required),'Verified sheet missing: '+required);
      }
      assert(!trustText.includes('Dhar Mann'),'Example person name was copied into Bebo');
      assert(!trustText.includes('Official Meta'),'Bebo is being misrepresented as Meta');
      if(device.name==='mobile'){
        const trustSelection=await page.evaluate(()=>{
          const node=document.querySelector('.bebo-trust-overlay .bebo-trust-card p');
          return node?getComputedStyle(node).userSelect:null;
        });
        assert.equal(trustSelection,'text','Verified details cannot be highlighted and copied');
      }
      await page.screenshot({path:'test-results/'+device.name+'-verified-sheet.png'});
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#bebo-verified-overlay').count(),0,'Escape did not close the sheet');
      item.verifiedSheet='PASS';
    }
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
    if(check.path==='safety'){
      assert(inner.includes('Welcome to Bebo'),'New member welcome is missing from Safety page');
      assert(inner.includes('strong, unique password'),'Safe new-account password guidance is missing');
      assert(!inner.includes('Independent service:')&&!inner.includes('Do not use an old Bebo password.'),'Old discouraging wording is still on the Safety page');
    }
    if(device.name==='mobile'&&check.path==='safety'){
      const selection=await page.evaluate(()=>{
        const text=document.querySelector('#app .panel .body p');
        if(!text)return {error:'No Safety page paragraph'};
        const range=document.createRange();
        range.selectNodeContents(text);
        const selection=window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        const selected=selection.toString();
        const style=getComputedStyle(text);
        selection.removeAllRanges();
        return {selected,style:style.userSelect};
      });
      assert.equal(selection.style,'text','Safety content cannot be selected');
      assert(/respectful|harassment|impersonation/i.test(selection.selected),'Mobile Safety page content cannot be selected for copying');
      item.copySelection='PASS';
    }
    if(check.path==='safety'){
      // A direct deep-link visit must not call native history.back() into another site.
      await globalBack.click();
      await page.waitForURL('**#/home',{timeout:10000});
      assert.equal(await page.evaluate(()=>location.hostname),'frymastercheese.github.io','Direct-link Back left Bebo');
      item.directBack='PASS';
      // Legacy bookmarks to the retired feature should route safely home.
      await page.goto(host+'?redirect-smoke=1#/old-bebo',{waitUntil:'domcontentloaded'});
      await page.waitForURL('**#/home',{timeout:15000});
      assert.equal(await page.locator('#bebo-memory-search').count(),0,'Retired form reappeared');
      assert.equal(await page.locator('#nav [data-nav="old-bebo"]').count(),0,'Retired menu reappeared');
      item.retiredFeatureRedirect='PASS';
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
          regularText:styleOf('#app .panel h2')||styleOf('#app h1')||styleOf('#app .bebo-trust-intro h2'),
          announcement:styleOf('#bebo-announcement-bar .bebo-announcement-preview')??styleOf('#bebo-announcement-bar'),
          editable:styleOf('#app input')||styleOf('#app textarea')
        };
      });
      assert(layout.scroll<=layout.viewport+8,'Horizontal overflow '+layout.scroll+'px > '+layout.viewport+'px');
      assert.equal(layout.regularText,'text','Mobile page text cannot be highlighted and copied');
      assert.equal(layout.announcement,'text','Bebo announcement cannot be highlighted and copied: '+JSON.stringify(layout));
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
  const aboutCheck={layout:device.name,route:'about.html',status:'UNKNOWN'};
  try{
    await page.goto(host+'?about-audit='+device.name+'#/home',{waitUntil:'domcontentloaded',timeout:45000});
    await page.locator('#nav a.bebo-about-link').click();
    await page.waitForURL('**/Bebo/about.html',{timeout:15000});
    const heading=await page.locator('main h1').innerText();
    const description=await page.locator('main').innerText();
    assert(/Bebo Is Officially Back/.test(heading),'Original slogan missing from About page');
    assert(description.includes('Independent project notice:'),'Missing independent project clarification');
    assert(description.includes('Supabase'),'Missing real backend explanation');
    assert(description.includes('56 original'),'Missing accurate skin information');
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),host+'about.html');
    assert.equal(await page.locator('nav a[href="./#/home"]').count(),2,'About page needs Back and Home links');
    assert(!/old Bebo accounts are restored/i.test(description),'About incorrectly promises old accounts');
    const siteWidth=await page.evaluate(()=>({page:document.documentElement.scrollWidth,screen:innerWidth}));
    assert(siteWidth.page<=siteWidth.screen+8,'About page horizontally overflows the viewport');
    await page.locator('nav a').first().click();
    await page.waitForURL('**/Bebo/#/home',{timeout:15000});
    aboutCheck.status='PASS';
  }catch(error){
    aboutCheck.status='FAIL';
    aboutCheck.error=String(error.message).slice(0,600);
    await page.screenshot({path:'test-results/'+device.name+'-about.png',fullPage:true}).catch(()=>{});
  }
  results.push(aboutCheck);
  console.log(aboutCheck.layout.padEnd(8)+' '+aboutCheck.route.padEnd(12)+' '+aboutCheck.status+(aboutCheck.error?' '+aboutCheck.error:''));
  await context.close();
 }
}finally{await browser.close()}
const summary={pass:results.filter(x=>x.status==='PASS').length,fail:results.filter(x=>x.status==='FAIL').length,details:results,pageErrors:errors};
await fs.writeFile('test-results/results.json',JSON.stringify(summary,null,2));
console.log('SUMMARY '+summary.pass+'/'+results.length+' passed; uncaught errors '+errors.length);
if(errors.length)console.error('Uncaught JS errors:',errors.slice(0,12));
process.exitCode=summary.fail||errors.length?1:0;
