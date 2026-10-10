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
