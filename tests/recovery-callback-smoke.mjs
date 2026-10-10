// Reproduces email recovery redirect on the live Bebo domain, using ONLY synthetic, mocked auth.
// No real reset links, members, accounts, passwords, or emails are used.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const site='https://bebo.nz/';
const sub='00000000-0000-4000-8000-000000000017';
const now=Math.floor(Date.now()/1000);
const jwt='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'+
 Buffer.from(JSON.stringify({sub,aud:'authenticated',role:'authenticated',email:'example@example.invalid',exp:now+3600,iat:now})).toString('base64url')+
 '.synthetic-do-not-use';
const safeHeaders={'access-control-allow-origin':'*','content-type':'application/json'};
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915}});
const page=await context.newPage();
const seen=[];
const errors=[];
page.on('pageerror',e=>errors.push(String(e.message)));
await page.route('**/auth/v1/**',async route=>{
 const url=new URL(route.request().url()),p=url.pathname;
 seen.push(p);
 if(p.endsWith('/user')){
  await route.fulfill({status:200,headers:safeHeaders,body:JSON.stringify({id:sub,aud:'authenticated',role:'authenticated',email:'example@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-10-10T01:00:00Z',identities:[]})});return;
 }
 if(p.endsWith('/token')){
  await route.fulfill({status:200,headers:safeHeaders,body:JSON.stringify({access_token:jwt,refresh_token:'synthetic-refresh',expires_in:3600,token_type:'bearer',user:{id:sub,aud:'authenticated',role:'authenticated',email:'example@example.invalid'}})});return;
 }
 await route.fulfill({status:400,headers:safeHeaders,body:'{}'});
});
await page.route('**/rest/v1/**',async route=>{
 const accept=String(route.request().headers().accept||'');
 await route.fulfill({status:200,headers:safeHeaders,body:accept.includes('application/vnd.pgrst.object+json')?'null':'[]'});
});
try{
 const callback=site+'#access_token='+encodeURIComponent(jwt)+
  '&expires_in=3600&expires_at='+(now+3600)+'&refresh_token=synthetic-refresh&token_type=bearer&type=recovery';
 await page.goto(callback,{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>Boolean(document.querySelector('#app')?.innerText?.trim()),null,{timeout:20000});
 await page.locator('form[data-form="recover-password"]').waitFor({state:'visible',timeout:30000});
 assert.equal(new URL(page.url()).hostname,'bebo.nz');
 assert.equal(new URL(page.url()).hash,'#/reset-password','Valid recovery callback should route to password-change page');
 assert(!page.url().includes('access_token='),'Recovery token must not remain in address bar');
 assert(seen.some(x=>x.endsWith('/user')),'Recovery callback must validate identity with Supabase Auth');
 assert.equal(await page.locator('form[data-form="recover-password"] input[name="password"]').count(),1);
 assert.equal(await page.locator('form[data-form="recover-password"] input[name="confirm_password"]').count(),1);
 const recoveryInputs=page.locator('form[data-form="recover-password"] input[type="password"]');
 assert.equal(await recoveryInputs.count(),2,'Both reset passwords should be concealed by default');
 const firstInput=page.locator('form[data-form="recover-password"] input[name="password"]');
 const secondInput=page.locator('form[data-form="recover-password"] input[name="confirm_password"]');
 const buttons=page.locator('form[data-form="recover-password"] button[data-toggle-password]');
 assert.equal(await buttons.count(),2,'Both reset fields need independent Show/Hide buttons');
 await firstInput.fill('NewPassword123!');
 await secondInput.fill('NewPassword123!');
 await buttons.nth(0).click();
 assert.equal(await firstInput.getAttribute('type'),'text','First reset password not revealed');
 assert.equal(await secondInput.getAttribute('type'),'password','Showing first reset field must not reveal confirmation');
 assert.equal(await firstInput.inputValue(),'NewPassword123!','First password changed on toggle');
 await buttons.nth(0).click();
 assert.equal(await firstInput.getAttribute('type'),'password','Hide new password did not work');
 await buttons.nth(1).click();
 assert.equal(await secondInput.getAttribute('type'),'text','Show confirmation password did not work');
 assert.equal(await secondInput.inputValue(),'NewPassword123!','Confirmation password changed on toggle');
 await buttons.nth(1).click();
 assert.equal(await secondInput.getAttribute('type'),'password','Hide confirmation password did not work');
 assert.equal(errors.length,0,'JavaScript errors: '+errors.join('; '));
 console.log('PASS: Synthetic Supabase recovery callback opens password-change form on bebo.nz, keeps credentials out of URLs, and verifies user');
}finally{
 await context.close();
 await browser.close();
}
