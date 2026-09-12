import { test } from "node:test";
import assert from "node:assert/strict";
import { generateReadme } from "../scripts/lib/generate.js";

const readme = [
  "# Editorial header",
  "",
  "<!-- PROFILE:START:SELECTED_WORK -->",
  "old",
  "<!-- PROFILE:END:SELECTED_WORK -->",
  "",
  "<!-- PROFILE:START:RECENT_ACTIVITY -->",
  "old",
  "<!-- PROFILE:END:RECENT_ACTIVITY -->",
  "",
  "<!-- PROFILE:START:POPULAR_WORK -->",
  "old",
  "<!-- PROFILE:END:POPULAR_WORK -->",
  "",
  "<!-- PROFILE:START:CORE_STACK -->",
  "old",
  "<!-- PROFILE:END:CORE_STACK -->",
  "",
  "## Contact",
].join("\n");

const config = {
  portfolioBaseUrl: "https://vid3v.com",
  githubUser: "vid3v",
  limits: { selectedWork: 2, recentActivity: 5, popularWork: 5, coreStackItems: 18 },
  weights: { relevance: 3, utility: 2, popularity: 1, freshness: 1 },
  selectedProjects: [
    { slug: "maureen", githubRepo: "vid3v/maureen" },
    { slug: "waitnous", githubRepo: null },
    { slug: "ghost", githubRepo: null },
  ],
};

const portfolio = {
  profile: { name: "Vivien Tassing" },
  projects: [
    { slug: "maureen", title: "Maureen", category: "SaaS Platform", role: "Founder", shortDescription: "WhatsApp automation", technologies: ["Hono"], githubUrl: "https://github.com/vid3v/maureen", results: "Live", updatedAt: "2026-09-01T00:00:00Z" },
    { slug: "waitnous", title: "WaitNous", category: "Mobile Application", role: "Dev", shortDescription: "Ridesharing", technologies: ["Expo"], githubUrl: null, results: "In progress", updatedAt: "2026-08-01T00:00:00Z" },
  ],
  stack: [
    { name: "TypeScript", category: "Languages" },
    { name: "Hono", category: "Frameworks" },
  ],
};

const repos = [
  { full_name: "vid3v/maureen", name: "maureen", html_url: "https://github.com/vid3v/maureen", description: "WhatsApp automation", stargazers_count: 4, forks_count: 0, pushed_at: "2026-09-01", language: "TypeScript", fork: false, archived: false },
];
const reposByFullName = { "vid3v/maureen": repos[0] };
const events = [{ type: "PushEvent", repo: { name: "vid3v/maureen" } }];
const now = new Date("2026-09-12T00:00:00Z");

test("generateReadme replaces all four blocks and preserves editorial content", () => {
  const output = generateReadme({ readme, config, portfolio, repos, events, reposByFullName, now });
  assert.match(output, /# Editorial header/);
  assert.match(output, /## Contact/);
  assert.doesNotMatch(output, /old/);
  assert.match(output, /### \[Maureen\]/);
  assert.match(output, /### \[WaitNous\]/);
  assert.match(output, /Pushed to \[`vid3v\/maureen`\]/);
  assert.match(output, /\[maureen\]\(https:\/\/github\.com\/vid3v\/maureen\) — WhatsApp automation/);
  assert.match(output, /\*\*Languages:\*\* TypeScript/);
});

test("generateReadme is deterministic for identical input", () => {
  const a = generateReadme({ readme, config, portfolio, repos, events, reposByFullName, now });
  const b = generateReadme({ readme, config, portfolio, repos, events, reposByFullName, now });
  assert.equal(a, b);
});

test("generateReadme throws when fewer than limits.selectedWork projects match", () => {
  const emptyPortfolio = { ...portfolio, projects: [] };
  assert.throws(
    () => generateReadme({ readme, config, portfolio: emptyPortfolio, repos, events, reposByFullName, now }),
    /Not enough eligible projects/
  );
});
