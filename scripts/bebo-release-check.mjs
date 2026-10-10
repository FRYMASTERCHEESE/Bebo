// Offline release checks for the GitHub Pages Bebo frontend.
// Safe for CI: never signs into accounts or modifies Supabase data.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const failures = [];
let passed = 0;
function check(condition, message) {
  if (condition) {
    passed++;
    console.log('PASS ' + message);
  } else {
    failures.push(message);
    console.error('FAIL ' + message);
  }
}
const read = path => readFileSync(path, 'utf8');
const html = read('index.html');
const main = read('social.js');
const verified = read('verified.js');
const about = read('about.html');
const sitemap = read('sitemap.xml');
const jsFiles = readdirSync('.').filter(file => file.endsWith('.js'));

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], {encoding:'utf8'});
  check(result.status === 0, 'JavaScript syntax: ' + file +
    (result.status === 0 ? '' : ' ' + result.stderr.slice(0, 250)));
  const source = read(file);
  const imports = [...source.matchAll(/from\s+['"]\.\/([^?'"]+)/g)];
  for (const match of imports) {
    check(existsSync(match[1]), file + ' resolves import ./' + match[1]);
  }
}

check(/<meta name="viewport"/.test(html), 'Mobile viewport present');
check(html.includes('id="app"'), 'Bebo main content present');
check(html.includes('https://bebo.nz/'), 'Production metadata points to custom domain');
check(main.includes("const BEBO_SITE_URL='https://bebo.nz/'"), 'Authentication redirects use bebo.nz');
check(main.includes("event==='PASSWORD_RECOVERY'")&&main.includes("sb.auth.updateUser({password})"), 'Password recovery form requires verified Supabase recovery event');
check(read('CNAME').trim()==='bebo.nz','GitHub Pages custom domain preserved');
check(html.includes('id="nav"'), 'Navigation present');
check(html.includes('data-nav="start"')&&main.includes("if(page==='start')"),
  'First-visit guide linked in navigation and safe public route');
check(main.includes('gettingStartedPage()')&&main.includes('Old Bebo accounts'),
  'Independent onboarding and old-account clarification');
check(html.includes('id="bebo-back-button"'), 'Global Back button present');
check(html.includes('class="bebo-page-progress"'), 'Progress feedback present');
check(html.includes('data-nav="safety"'), 'Safety and privacy navigation');
check(!html.includes('data-nav="old-bebo"'), 'Retired memories navigation absent');
check(!main.includes('memories.submit('), 'Retired memories listener absent');
check(main.includes('createVerification('), 'Verified badge module present');
check(main.includes("a==='verified-info'"), 'Verified badge click handler present');
check(main.includes("a==='verified-close'"), 'Verified badge close handler present');
check(verified.includes('Go back to profile'), 'Verified sheet Back button present');
check(verified.includes('Profile transparency'), 'Verified transparency content present');
check(main.includes('function backWithinBebo()'), 'Internal Back routing present');
check(main.includes("if(page==='old-bebo'){location.replace"), 'Old route safely redirects home');
check(html.includes('prefers-reduced-motion'), 'Reduced-motion accessibility');
check(main.includes('aria-current'), 'Accessible active navigation');
check(!/sb_secret_|service_role\s*[:=]/.test(read('config.js')), 'No secret-role key in public config');
check(existsSync('supabase/bebo_foreign_key_performance_indexes_v1.sql'),
  'Indexed foreign keys migration recorded');


check(html.includes('Bebo Is Officially Back'), 'Original Bebo slogan kept');
check(about.includes('Bebo Is Officially Back'), 'About page retains slogan');
check(about.includes('Independent project notice:'), 'About explains independent status');
check(about.includes('not the original Bebo service'), 'No claim to old Bebo accounts');
check(about.includes('Supabase'), 'About explains real account backend');
check(about.includes('56 original skins'), 'About describes original skins');
check(html.includes('href="./about.html"'), 'Homepage links to indexable About page');
check(html.includes('rel="canonical"'), 'Homepage canonical URL');
check(about.includes('rel="canonical"'), 'About canonical URL');
check(html.includes('property="og:title"'), 'Homepage social sharing metadata');
check(about.includes('property="og:title"'), 'About social sharing metadata');
check(sitemap.includes('https://bebo.nz/about.html'), 'Sitemap includes About page');
for(const file of ['privacy.html','community-guidelines.html','how-to.html','faq.html']){
 check(existsSync(file),'Public original content page '+file+' exists');
 if(existsSync(file)){
  const page=read(file);
  check(page.includes('<h1>')&&page.includes('rel="canonical"')&&page.includes('bebo.nz'),file+' has content and canonical metadata');
  check(sitemap.includes('https://bebo.nz/'+file),file+' included in sitemap');
  check(html.includes('href="./'+file+'"'),file+' linked from main website');
 }
}
check(read('privacy.html').includes('Google advertising is not enabled'),'No misleading claim that ads are currently live');
check(!html.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle'),'No premature Google ad script');
const adSeller='google.com, pub-4051392846058327, DIRECT, f08c47fec0942fa0';
check(existsSync('ads.txt')&&read('ads.txt').trim()===adSeller,'AdSense ads.txt seller authorization matches Bebo publisher');
check(existsSync('robots.txt')&&read('robots.txt').includes('https://bebo.nz/sitemap.xml'),'Robots TXT allows indexable sitemap');
for(const file of ['index.html','about.html','privacy.html','community-guidelines.html','how-to.html','faq.html']){
 check(read(file).includes('<meta name="google-adsense-account" content="ca-pub-4051392846058327">'),
   file+' has ownership verification meta without ad-serving script');
 check(!read(file).includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle'),
  file+' does not serve AdSense ads before approval and consent setup');
}
check(read('classic-modules.js').includes('classic-report-content')&&
 read('admin.js').includes('admin-content-hide')&&
 read('admin.js').includes('admin-content-reviewed'),
 'Blog, comment, group reporting and moderator hide queue wired');
check(read('classic-modules.js').includes('classic-report-photo')&&read('admin.js').includes('admin-photo-approve')&&read('admin.js').includes('admin-photo-hide'),'Member photo reports and owner approvals wired');
check(existsSync('supabase/bebo_photos_owner_review_reports_20261011.sql'),'Applied photo moderation database migration documented');
check(sitemap.includes('https://bebo.nz/'), 'Sitemap includes homepage');
for (const [name, source] of [['homepage',html],['about',about]]) {
  const match = source.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  check(Boolean(match), name + ' has structured data');
  if (match) {
    try {
      const obj = JSON.parse(match[1]);
      check(obj['@context'] === 'https://schema.org', name + ' structured data is valid JSON-LD');
    } catch { check(false, name + ' structured data is valid JSON-LD'); }
  }
}

console.log('\nBebo release checks: ' + passed + ' passed, ' + failures.length + ' failed.');
if (failures.length) process.exitCode = 1;
