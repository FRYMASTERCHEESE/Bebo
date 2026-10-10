// Live Bebo custom-domain authentication contract smoke tests.
// Only synthetic identities are used. Every auth write is intercepted before reaching Supabase.
// This does NOT claim email delivery, confirmation or a real password change was verified.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const SITE='https://bebo.nz/';
const email='bebo-domain-ci@example.invalid';
const password='SyntheticOnlyPass_1234';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
const traffic=[];
const intercepted=(endpoint)=>'**/auth/v1/'+endpoint+'**';
const headers={'content-type':'application/json; charset=utf-8',
 'access-control-allow-origin':'https://bebo.nz','access-control-allow-credentials':'true'};
let outcome='NOT_RUN';
try {
 await page.route(intercepted('signup'),async route=>{
  const r=route.request(),url=new URL(r.url());
  const data=r.postDataJSON();
  traffic.push({kind:'signup',redirect:url.searchParams.get('redirect_to'),email:data.email});
  await route.fulfill({status:200,headers,body:JSON.stringify({
    user:{id:'12345678-1234-4234-8234-123456789012',email,identities:[{id:'test-ident',identity_id:'test-ident',provider:'email'}]},
    session:null
  })});
 });
 await page.route(intercepted('recover'),async route=>{
  const r=route.request(),url=new URL(r.url()),data=r.postDataJSON();
  traffic.push({kind:'recover',redirect:url.searchParams.get('redirect_to'),email:data.email});
  await route.fulfill({status:200,headers,body:'{}'});
 });
 await page.route('**/auth/v1/token?grant_type=password**',async route=>{
  const r=route.request(),url=new URL(r.url()),data=r.postDataJSON();
  traffic.push({kind:'login',grant:url.searchParams.get('grant_type'),email:data.email});
  await route.fulfill({status:400,headers,body:JSON.stringify({error:'invalid_grant',error_description:'Invalid login credentials',msg:'Invalid login credentials'})});
 });
 await page.goto(SITE+'?auth-smoke=20261010#/account',{waitUntil:'domcontentloaded',timeout:45000});
 await page.locator('form[data-form="signup"]').waitFor({state:'visible',timeout:30000});
 assert.equal(new URL(page.url()).hostname,'bebo.nz','Browser did not remain on the custom domain');
 assert.equal(await page.locator('form[data-form="login"]').count(),1,'Login form missing');

 const signup=page.locator('form[data-form="signup"]');
 await signup.locator('input[name="email"]').fill(email);
 await signup.locator('input[name="password"]').fill(password);
 await signup.locator('input[name="adult"]').check();
 await signup.locator('button:not([data-toggle-password])').click();
 await page.waitForFunction(()=>document.querySelector('#app')?.innerText?.includes('Check your email to confirm'),null,{timeout:20000});
 const signupRequest=traffic.find(t=>t.kind==='signup');
 assert(signupRequest,'Signup did not send its (intercepted) Supabase Auth request');
 assert.equal(signupRequest.redirect,SITE,'Signup confirmation must redirect to secure bebo.nz');
 assert.equal(signupRequest.email,email);
 console.log('PASS: Signup form sends correct https://bebo.nz/ confirmation redirect (intercepted, no email sent)');

 // A deliberately mocked invalid-login response tests error handling without creating a session.
 const login=page.locator('form[data-form="login"]');
 await login.locator('input[name="email"]').fill(email);
 await login.locator('input[name="password"]').fill(password);
 await login.locator('button:not([data-toggle-password])').click();
 await page.waitForFunction(()=>document.querySelector('#app')?.innerText?.includes('Invalid login credentials'),null,{timeout:20000});
 assert(traffic.some(t=>t.kind==='login'&&t.email===email),'Login did not reach its intercepted Supabase Auth endpoint');
 console.log('PASS: Login submission and invalid-credentials handling (intercepted, no real login)');

 page.once('dialog',dialog=>dialog.accept(email));
 await page.locator('[data-action="reset"]').click();
 await page.waitForFunction(()=>document.querySelector('#app')?.innerText?.includes('Check your email for the password reset link'),null,{timeout:20000});
 const resetRequest=traffic.find(t=>t.kind==='recover');
 assert(resetRequest,'Password reset did not send its (intercepted) recovery request');
 assert.equal(resetRequest.redirect,SITE,'Reset email must redirect to secure bebo.nz');
 assert.equal(resetRequest.email,email);
 console.log('PASS: Forgot password sends correct https://bebo.nz/ reset redirect (intercepted, no email sent)');

 await page.goto(SITE+'#/reset-password',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#app')?.innerText?.includes('Password reset'),null,{timeout:20000});
 assert.equal(await page.locator('form[data-form="recover-password"]').count(),0,
  'Unauthenticated browser must not be allowed to set a new password');
 console.log('PASS: Password-update form unavailable without an authenticated recovery session');
 console.log('SUMMARY: 4/4 Bebo domain auth contract checks passed; real email inbox and tokens not involved');
 outcome='PASS';
}finally{
 await page.close();
 await browser.close();
}
assert.equal(outcome,'PASS');
