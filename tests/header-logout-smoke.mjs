// Live Bebo header auth-state and logout test. Supabase requests are intercepted;
// no real accounts, sessions or credentials are used or modified.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const SITE='https://bebo.nz/';
const uid='00000000-0000-4000-8000-000000000123';
const now=Math.floor(Date.now()/1000);
const email='bebo-header-ci@example.invalid';
const jwt='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'+
 Buffer.from(JSON.stringify({sub:uid,aud:'authenticated',role:'authenticated',email,exp:now+3600,iat:now})).toString('base64url')+
 '.synthetic-test-only';
const headers={'content-type':'application/json','access-control-allow-origin':'*'};
const user={id:uid,aud:'authenticated',role:'authenticated',email,
 app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-10-10T01:00:00Z',identities:[]};
const browser=await chromium.launch({headless:true});
try {
 for(const viewport of [{width:412,height:915},{width:1365,height:900}]){
  const context=await browser.newContext({viewport}),page=await context.newPage();
  const jsErrors=[],requests=[];
  page.on('pageerror',err=>jsErrors.push(String(err.message)));
  await page.route('**/auth/v1/**',async route=>{
   const req=route.request(),url=new URL(req.url()),p=url.pathname;
   requests.push(p);
   if(p.endsWith('/user'))return route.fulfill({status:200,headers,body:JSON.stringify(user)});
   if(p.endsWith('/token'))return route.fulfill({status:200,headers,body:JSON.stringify({
      access_token:jwt,refresh_token:'synthetic-header-refresh',expires_in:3600,token_type:'bearer',user})});
   if(p.endsWith('/logout'))return route.fulfill({status:204,headers:{}});
   return route.fulfill({status:400,headers,body:JSON.stringify({error:'invalid_grant'})});
  });
  await page.route('**/rest/v1/**',async route=>{
   const accept=String(route.request().headers().accept||'');
   return route.fulfill({status:200,headers,
      body:accept.includes('application/vnd.pgrst.object+json')?'null':'[]'});
  });
  try{
   await page.goto(SITE+'?logout-smoke=20261011#/signin',{waitUntil:'domcontentloaded',timeout:45000});
   const guest=page.locator('#bebo-guest-actions'),logout=page.locator('#bebo-header-logout');
   await guest.waitFor({state:'visible',timeout:20000});
   assert.equal(await logout.isVisible(),false,'Log Out should be hidden from guests');
   const login=page.locator('form[data-form="login"]');
   await login.locator('input[name="email"]').fill(email);
   await login.locator('input[name="password"]').fill('SyntheticPasswordOnly!1');
   await login.locator('button:not([data-toggle-password])').click();
   await logout.waitFor({state:'visible',timeout:30000});
   assert.equal(await guest.isVisible(),false,'Sign In/Up must disappear after signing in');
   await page.goto(SITE+'?start-member-ci=20261011#/start',{waitUntil:'domcontentloaded'});
   await page.locator('.bebo-start-guide').waitFor({state:'visible',timeout:20000});
   assert.equal(await page.locator('.bebo-start-guide a[href="#/profile"]').count(),1,
     'Signed-in start guide must link to member profile');
   assert.equal(await guest.isVisible(),false,'New member guide must not reveal guest actions');
   assert.equal(await logout.isVisible(),true,'Member top logout must remain visible on Start Here');
   const layout=await logout.evaluate(el=>{
    const rect=el.getBoundingClientRect(),top=document.querySelector('nav.nav').getBoundingClientRect();
    return {height:rect.height,x:rect.x,right:rect.right,width:innerWidth,
     navBottom:rect.bottom,mainTop:top.top,position:getComputedStyle(el).position};
   });
   assert(layout.height>=44,'Log Out tap target too small');
   assert(layout.navBottom<=layout.mainTop+2,'Log Out must stay above the main navigation');
   assert(layout.x>=0&&layout.right<=layout.width+2,'Log Out must be visible within phone viewport');
   assert.equal(layout.position,'static','Log Out must not overlay page content');
   await logout.click();
   await guest.waitFor({state:'visible',timeout:20000});
   assert.equal(await logout.isVisible(),false,'Top Log Out should disappear after logout');
   assert.equal(new URL(page.url()).hash,'#/home','Logging out should safely return to Bebo Home');
   assert(requests.some(p=>p.endsWith('/logout')),'Log Out did not request Supabase session revocation');
   assert.equal(jsErrors.length,0,'Browser JavaScript errors: '+jsErrors.join('; '));
   console.log('PASS: '+viewport.width+'px Sign In -> top Log Out -> guest Sign In/Up restored; no real account touched');
  }finally{
   await context.close();
  }
 }
 console.log('SUMMARY: 2/2 authenticated-header logout flows passed');
}finally{await browser.close();}
