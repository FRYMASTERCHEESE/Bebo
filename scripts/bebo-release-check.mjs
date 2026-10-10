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

console.log('\nBebo release checks: ' + passed + ' passed, ' + failures.length + ' failed.');
if (failures.length) process.exitCode = 1;
