import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const marketingPages = [
  'index.html',
  'features.html',
  'features/voice-agent.html',
  'features/app.html',
  'features/dynamic-menu.html',
  'features/command.html',
  'features/admin.html',
  'features/analytics.html',
  'features/kiosk.html',
  'features/pos-staff.html',
  'pricing.html',
  'hardware.html',
  'privacy.html',
  'terms.html'
];

function pageUrl(page) {
  return page === 'index.html' ? 'https://dialtone.menu/' : `https://dialtone.menu/${page}`;
}

function metaContent(html, attribute, value) {
  const pattern = new RegExp(`<meta\\s+${attribute}="${value}"\\s+content="([^"]+)"`, 'i');
  return html.match(pattern)?.[1] || '';
}

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));
}

for (const page of marketingPages) {
  const html = await readFile(new URL(`../public/${page}`, import.meta.url), 'utf8');
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').replaceAll('&amp;', '&');
  const description = metaContent(html, 'name', 'description');
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1] || '';

  assert.ok(title.length > 0 && title.length <= 60, `${page} should have a concise title`);
  assert.ok(
    description.length >= 140 && description.length <= 160,
    `${page} description should contain 140-160 characters; received ${description.length}`
  );
  assert.equal(canonical, pageUrl(page), `${page} should use its own canonical URL`);
  assert.equal((html.match(/<h1[\s>]/gi) || []).length, 1, `${page} should have exactly one h1`);

  for (const property of ['og:title', 'og:description', 'og:type', 'og:url', 'og:image']) {
    assert.ok(metaContent(html, 'property', property), `${page} should include ${property}`);
  }
  for (const name of ['twitter:card', 'twitter:title', 'twitter:description']) {
    assert.ok(metaContent(html, 'name', name), `${page} should include ${name}`);
  }

  jsonLdBlocks(html);
}

const homepage = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const homepageGraph = jsonLdBlocks(homepage).find((block) => Array.isArray(block['@graph']))['@graph'];
assert.deepEqual(
  homepageGraph.map((entity) => entity['@type']),
  ['Organization', 'WebSite', 'SoftwareApplication'],
  'Homepage should connect organization, website, and software entities'
);
const software = homepageGraph.find((entity) => entity['@type'] === 'SoftwareApplication');
assert.equal(software.offers.lowPrice, '199', 'Software offer should match the lowest paid plan');
assert.equal(software.offers.highPrice, '399', 'Software offer should match the highest published plan');

const faq = jsonLdBlocks(homepage).find((block) => block['@type'] === 'FAQPage');
const visibleHomepageText = homepage
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .replace(/\s+([.,!?])/g, '$1')
  .trim();
for (const question of faq.mainEntity) {
  assert.ok(visibleHomepageText.includes(question.name), `FAQ question should be visible: ${question.name}`);
  assert.ok(
    visibleHomepageText.includes(question.acceptedAnswer.text),
    `FAQ answer should be visible: ${question.acceptedAnswer.text}`
  );
}

for (const page of marketingPages.filter((page) => page.startsWith('features/'))) {
  const html = await readFile(new URL(`../public/${page}`, import.meta.url), 'utf8');
  const breadcrumb = jsonLdBlocks(html).find((block) => block['@type'] === 'BreadcrumbList');
  assert.ok(breadcrumb, `${page} should include BreadcrumbList structured data`);
  assert.deepEqual(
    breadcrumb.itemListElement.map((item) => item.position),
    [1, 2],
    `${page} breadcrumb positions should be ordered`
  );
}

const sitemap = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
for (const page of marketingPages) {
  assert.match(sitemap, new RegExp(`<loc>${pageUrl(page)}</loc>`), `${page} should be listed in the sitemap`);
}
assert.doesNotMatch(sitemap, /404\.html/, '404 page should not be listed in the sitemap');

const notFound = await readFile(new URL('../public/404.html', import.meta.url), 'utf8');
assert.match(notFound, /<meta name="robots" content="noindex, nofollow" \/>/, '404 page should be noindex');

console.log('SEO tests passed');