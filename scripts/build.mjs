// Refreshes GitHub stats for every project in projects.json and regenerates README.md and data/projects.json.
// Usage: GITHUB_TOKEN=... node scripts/build.mjs  (the token only raises the rate limit; public data needs none)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const { categories, projects } = JSON.parse(readFileSync(new URL('projects.json', root), 'utf8'));
const token = process.env.GITHUB_TOKEN;

async function stats(repo) {
  const res = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: { accept: 'application/vnd.github+json', ...(token && { authorization: `Bearer ${token}` }) },
  });
  if (!res.ok) throw new Error(`${repo}: HTTP ${res.status}`);
  const r = await res.json();
  return {
    url: r.html_url,
    stars: r.stargazers_count,
    forks: r.forks_count,
    license: r.license?.spdx_id && r.license.spdx_id !== 'NOASSERTION' ? r.license.spdx_id : null,
    created: r.created_at.slice(0, 10),
    pushed: r.pushed_at.slice(0, 10),
    homepage: r.homepage || null,
    archived: r.archived,
  };
}

const enriched = [];
for (const p of projects) {
  try {
    enriched.push({ ...p, ...(await stats(p.repo)) });
  } catch (err) {
    console.warn(`skipped ${err.message}`);
  }
}

const today = new Date().toISOString().slice(0, 10);
mkdirSync(new URL('data/', root), { recursive: true });
writeFileSync(new URL('data/projects.json', root), JSON.stringify({ updated: today, categories, projects: enriched }, null, 2) + '\n');

const byStars = (a, b) => b.stars - a.stars || a.name.localeCompare(b.name);
const challenge = enriched.filter((p) => p.category !== 'beyond');
const anchor = (title) => title.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/ /g, '-');
const meta = (p) => [p.award && `🏆 ${p.award}`, `★ ${p.stars.toLocaleString('en-US')}`, p.license ?? 'no license', p.post && `[launch post](${p.post})`].filter(Boolean).join(' · ');
const line = (p) => `- [${p.name}](${p.url}) - ${p.summary} ${meta(p)}`;

const top = [...challenge].sort(byStars).slice(0, 15);
// Prize tiers in the order Comfy's winners page lists them; a project's first prize decides its place.
const tiers = ['Best Overall', 'Most Innovative', 'Most Viral', 'Open Weights Only', 'Built with FLUX', 'Built with MiniMax H3', 'Honorable mention'];
const tier = (p) => tiers.findIndex((t) => p.award.startsWith(t));
const winners = enriched.filter((p) => p.award).sort((a, b) => tier(a) - tier(b) || byStars(a, b));
const sections = categories.map((c) => {
  const items = enriched.filter((p) => p.category === c.id).sort(byStars);
  return `## ${c.title}\n\n${c.intro}\n\n${items.map(line).join('\n')}`;
});

const licenses = Object.entries(
  enriched.reduce((n, p) => ({ ...n, [p.license ?? 'none']: (n[p.license ?? 'none'] ?? 0) + 1 }), {}),
).sort((a, b) => b[1] - a[1] || (a[0] === 'none') - (b[0] === 'none'));
const byCategory = categories.map((c) => {
  const items = enriched.filter((p) => p.category === c.id).sort(byStars);
  return { ...c, count: items.length, best: items[0] };
});

const readme = `# Open Source Higgsfield [![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

There are ${enriched.length} open-source Higgsfield AI alternatives in this list: ${challenge.length} GitHub projects from ComfyUI's #OpenSourceHiggsfield challenge (October 2026), ${winners.length} of them prize winners, and ${enriched.length - challenge.length} older ones. They cover character swap, effects, camera re-shoots, films and full studios.

This is an unofficial community list. It is not affiliated with or endorsed by Higgsfield or Comfy.

## At a glance

| | |
| --- | --- |
| Projects | ${enriched.length}: ${challenge.length} from the challenge, ${enriched.length - challenge.length} older |
| Prize winners | ${winners.length}, Best Overall: ${winners[0] ? `[${winners[0].name}](${winners[0].url})` : 'none'} ([Winners](#winners)) |
| Most starred challenge project | ${top[0] ? `[${top[0].name}](${top[0].url}), ★ ${top[0].stars.toLocaleString('en-US')}` : 'none'} |
| Licenses | ${licenses.map(([l, n]) => `${l} ${n}`).join(', ')} |
| Stars and licenses as of | ${today} |
| Machine-readable data | [data/projects.json](data/projects.json) |
| Rebuild | \`node scripts/build.mjs\` |
| List license | CC0 1.0 |
| Website | [jutsustudio.com/open-source-higgsfield](https://jutsustudio.com/open-source-higgsfield/), the same list by category |

## By category

| Category | Projects | Most starred |
| --- | --- | --- |
${byCategory.map((c) => `| [${c.title}](#${anchor(c.title)}) | ${c.count} | ${c.best ? `[${c.best.name}](${c.best.url}), ★ ${c.best.stars.toLocaleString('en-US')}` : 'none'} |`).join('\n')}

## The challenge

- **October 16, 2026.** ComfyUI announced the [#OpenSourceHiggsfield challenge](https://comfy.org/open-source-higgsfield/): "Higgsfield promised to open-source their entire platform. They didn't." Comfy and its partners, including NVIDIA, RunPod and MiniMax, put up $25,000 in prizes for open-source builds on the Comfy Developer Platform. The suggested tracks were Cinematic Studio, Re-shoot a video and Openjutsu (swap a character in a video).
- **October 26.** The Comfy team released its own entry, [OPENjutsu](https://github.com/D3voz/openjutsu), an open-source Genjutsu-style character swap, and the clonable [comfy-openjutsu](https://github.com/Comfy-Org/comfy-openjutsu) app template.
- **October 28.** Builder Night in San Francisco.
- **October 29.** ComfyUI [said](https://x.com/ComfyUI/status/2115928993623109648) Higgsfield had sent it a cease and desist asking it to shut the challenge down.
- **October 30.** Submission deadline.
- **November 10.** Comfy [announced the winners](https://comfy.org/open-source-higgsfield/). Best Overall and $10,000 went to [ComfyUI Panorama Stickers](https://github.com/nomadoor/ComfyUI-Panorama-Stickers). See [Winners](#winners).

Entries were found through the #OpenSourceHiggsfield tag on X and through GitHub search. Empty repositories, clones of other entries and private placeholders are left out.

## Winners

Prizes as listed on [Comfy's winners page](https://comfy.org/open-source-higgsfield/), November 10, 2026. The category winners each got a GeForce RTX 5090; the ten honorable mentions got $250 in Comfy Credits each.

| Project | Prize | What it does | Stars |
| --- | --- | --- | --- |
${winners.map((p) => `| [${p.name}](${p.url}) | ${p.award} | ${p.summary} | ${p.stars.toLocaleString('en-US')} |`).join('\n')}

## Most starred

| Project | What it does | Stars | License |
| --- | --- | --- | --- |
${top.map((p) => `| [${p.name}](${p.url}) | ${p.summary} | ${p.stars.toLocaleString('en-US')} | ${p.license ?? 'none'} |`).join('\n')}

## Contents

- [Winners](#winners)
${categories.map((c) => `- [${c.title}](#${anchor(c.title)})`).join('\n')}
- [Contributing](#contributing)

${sections.join('\n\n')}

## Contributing

Missing a project? Open a pull request that adds it to [projects.json](projects.json) with a one-line summary, then run \`node scripts/build.mjs\` to refresh the stats and this README. Projects need a public repository with a README.

See also [Awesome Higgsfield](https://github.com/jutsuhq/awesome-higgsfield) for SDKs, MCP servers and agent skills built on Higgsfield itself.

Maintained by [Jutsu Studio](https://jutsustudio.com/), the open-source Higgsfield desktop app for Mac ([GitHub](https://github.com/jutsuhq/jutsu-studio)) and for [Windows and Linux](https://github.com/jutsuhq/higgsfield-desktop).

## License

[CC0 1.0](LICENSE). To the extent possible under law, the maintainers waive all copyright to this list.
`;

writeFileSync(new URL('README.md', root), readme);
console.log(`${enriched.length} projects, top: ${top.slice(0, 3).map((p) => `${p.repo} ${p.stars}`).join(', ')}`);
