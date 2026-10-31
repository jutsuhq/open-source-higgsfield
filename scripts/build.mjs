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
const meta = (p) => [`★ ${p.stars.toLocaleString('en-US')}`, p.license ?? 'no license', p.post && `[launch post](${p.post})`].filter(Boolean).join(' · ');
const line = (p) => `- [${p.name}](${p.url}) - ${p.summary} ${meta(p)}`;

const top = [...challenge].sort(byStars).slice(0, 15);
const sections = categories.map((c) => {
  const items = enriched.filter((p) => p.category === c.id).sort(byStars);
  return `## ${c.title}\n\n${c.intro}\n\n${items.map(line).join('\n')}`;
});

const readme = `# Open Source Higgsfield [![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

> Open-source Higgsfield AI alternatives on GitHub, starting with every notable project built for ComfyUI's #OpenSourceHiggsfield challenge: Genjutsu-style character swap, one-tap effects, camera re-shoots and full studios that run open-weights models on your own GPU or on Comfy Cloud.

${challenge.length} challenge projects and ${enriched.length - challenge.length} older alternatives, with stars and licenses as of ${today}. Browse the same list by category at [jutsustudio.com/open-source-higgsfield](https://jutsustudio.com/open-source-higgsfield/).

This is an unofficial community list. It is not affiliated with or endorsed by Higgsfield or Comfy.

## The challenge

- **October 16, 2026.** ComfyUI announced the [#OpenSourceHiggsfield challenge](https://comfy.org/open-source-higgsfield/): "Higgsfield promised to open-source their entire platform. They didn't." Comfy and its partners, including NVIDIA, RunPod and MiniMax, put up $25,000 in prizes for open-source builds on the Comfy Developer Platform. The suggested tracks were Cinematic Studio, Re-shoot a video and Openjutsu (swap a character in a video).
- **October 26.** The Comfy team released its own entry, [OPENjutsu](https://github.com/D3voz/openjutsu), an open-source Genjutsu-style character swap, and the clonable [comfy-openjutsu](https://github.com/Comfy-Org/comfy-openjutsu) app template.
- **October 28.** Builder Night in San Francisco.
- **October 29.** ComfyUI [said](https://x.com/ComfyUI/status/2115928993623109648) Higgsfield had sent it a cease and desist asking it to shut the challenge down.
- **October 30.** Submission deadline.

Entries were found through the #OpenSourceHiggsfield tag on X and through GitHub search. Empty repositories, clones of other entries and private placeholders are left out.

## Most starred

| Project | What it does | Stars | License |
| --- | --- | --- | --- |
${top.map((p) => `| [${p.name}](${p.url}) | ${p.summary} | ${p.stars.toLocaleString('en-US')} | ${p.license ?? 'none'} |`).join('\n')}

## Contents

${categories.map((c) => `- [${c.title}](#${anchor(c.title)})`).join('\n')}
- [Contributing](#contributing)

${sections.join('\n\n')}

## Contributing

Missing a project? Open a pull request that adds it to [projects.json](projects.json) with a one-line summary, then run \`node scripts/build.mjs\` to refresh the stats and this README. Projects need a public repository with a README.

See also [Awesome Higgsfield](https://github.com/jutsuhq/awesome-higgsfield) for SDKs, MCP servers and agent skills built on Higgsfield itself.

Maintained by [Jutsu Studio](https://jutsustudio.com/), the open-source Higgsfield desktop app for Mac ([GitHub](https://github.com/jutsuhq/jutsu-studio)).

## License

[CC0 1.0](LICENSE). To the extent possible under law, the maintainers waive all copyright to this list.
`;

writeFileSync(new URL('README.md', root), readme);
console.log(`${enriched.length} projects, top: ${top.slice(0, 3).map((p) => `${p.repo} ${p.stars}`).join(', ')}`);
