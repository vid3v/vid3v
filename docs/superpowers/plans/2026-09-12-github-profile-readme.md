# GitHub Profile README — Dynamic Professional Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `vid3v/vid3v` README.md with an English professional profile whose dynamic sections (selected work, GitHub activity, popular repos, core stack) are regenerated daily by a GitHub Actions workflow from `vid3v.com` public APIs and the GitHub API.

**Architecture:** A zero-dependency Node.js generator in the profile repository fetches portfolio data (`vid3v.com/api/*`) and GitHub public data, scores the five configured priority projects, renders four Markdown blocks between HTML marker comments, and rewrites `README.md` only when content changed. Any fetch or validation failure aborts the run without writing, preserving the last published README.

**Tech Stack:** Node.js ≥ 20.11 (built-in `fetch`, `node:test`), GitHub Actions (`actions/checkout@v7`, `actions/setup-node@v7`, Node 24), spec at `docs/superpowers/specs/2026-09-12-github-profile-readme-design.md`.

**Working directory:** all tasks run in `~/Documents/dev-lab/vid3v` (the cloned `vid3v/vid3v` repository, branch `main`).

---

## File Structure

```text
vid3v/
├── README.md                                  # Modify (Task 7): editorial profile + 4 marker blocks
├── profile.config.json                        # Create (Task 1): eligible projects, weights, limits, URLs
├── scripts/
│   ├── update-profile-readme.mjs              # Create (Task 7): CLI entry point (fetch → generate → write)
│   └── lib/
│       ├── config.js                          # Create (Task 1): load + validate configuration
│       ├── markers.js                         # Create (Task 2): marker validation and block replacement
│       ├── fetchers.js                        # Create (Task 3): portfolio + GitHub fetch and validation
│       ├── scoring.js                         # Create (Task 4): project scoring and top-3 selection
│       ├── render.js                          # Create (Task 5): Markdown renderers per dynamic block
│       └── generate.js                        # Create (Task 6): pure composition of all blocks
├── tests/
│   ├── config.test.js                         # Create (Task 1)
│   ├── markers.test.js                        # Create (Task 2)
│   ├── fetchers.test.js                       # Create (Task 3)
│   ├── scoring.test.js                        # Create (Task 4)
│   ├── render.test.js                         # Create (Task 5)
│   └── generate.test.js                       # Create (Task 6)
└── .github/workflows/update-profile-readme.yml  # Create (Task 8)
```

Responsibility boundaries: `config.js` owns configuration validity; `markers.js` owns README boundary safety; `fetchers.js` owns remote I/O and response-shape validation; `scoring.js` owns ranking decisions; `render.js` owns Markdown formatting; `generate.js` owns pure composition; the CLI owns I/O side effects only.

---

### Task 1: Configuration file and config module

**Files:**
- Create: `profile.config.json`
- Create: `scripts/lib/config.js`
- Test: `tests/config.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/config.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig, validateConfig } from "../scripts/lib/config.js";

const validConfig = {
  portfolioBaseUrl: "https://vid3v.com",
  githubUser: "vid3v",
  limits: { selectedWork: 3, recentActivity: 5, popularWork: 5, coreStackItems: 18 },
  weights: { relevance: 3, utility: 2, popularity: 1, freshness: 1 },
  selectedProjects: [
    { slug: "feathers-refresh", githubRepo: "vid3v/feathers-refresh" },
    { slug: "maureen", githubRepo: "vid3v/maureen" },
    { slug: "waitnous", githubRepo: "vid3v/wait-nous-app" },
    { slug: "fala-money", githubRepo: null },
    { slug: "factory-management", githubRepo: null },
  ],
};

test("validateConfig accepts a valid config", () => {
  assert.doesNotThrow(() => validateConfig(validConfig));
});

test("validateConfig rejects missing portfolioBaseUrl", () => {
  const broken = { ...validConfig, portfolioBaseUrl: undefined };
  assert.throws(() => validateConfig(broken), /portfolioBaseUrl/);
});

test("validateConfig rejects fewer than 3 selected projects", () => {
  const broken = { ...validConfig, selectedProjects: validConfig.selectedProjects.slice(0, 2) };
  assert.throws(() => validateConfig(broken), /selectedProjects/);
});

test("validateConfig rejects a project without slug", () => {
  const broken = {
    ...validConfig,
    selectedProjects: [{ githubRepo: null }, ...validConfig.selectedProjects.slice(1)],
  };
  assert.throws(() => validateConfig(broken), /slug/);
});

test("validateConfig rejects non-positive limits", () => {
  const broken = { ...validConfig, limits: { ...validConfig.limits, selectedWork: 0 } };
  assert.throws(() => validateConfig(broken), /limits/);
});

test("loadConfig reads the real profile.config.json", () => {
  const config = loadConfig(new URL("../profile.config.json", import.meta.url));
  assert.equal(config.githubUser, "vid3v");
  assert.equal(config.selectedProjects.length, 5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/config.test.js`
Expected: FAIL with `Cannot find module '../scripts/lib/config.js'`

- [ ] **Step 3: Create `profile.config.json`**

```json
{
  "portfolioBaseUrl": "https://vid3v.com",
  "githubUser": "vid3v",
  "limits": {
    "selectedWork": 3,
    "recentActivity": 5,
    "popularWork": 5,
    "coreStackItems": 18
  },
  "weights": {
    "relevance": 3,
    "utility": 2,
    "popularity": 1,
    "freshness": 1
  },
  "selectedProjects": [
    { "slug": "feathers-refresh", "githubRepo": "vid3v/feathers-refresh" },
    { "slug": "maureen", "githubRepo": "vid3v/maureen" },
    { "slug": "waitnous", "githubRepo": "vid3v/wait-nous-app" },
    { "slug": "fala-money", "githubRepo": null },
    { "slug": "factory-management", "githubRepo": null }
  ]
}
```

- [ ] **Step 4: Write minimal implementation**

Create `scripts/lib/config.js`:

```js
import { readFileSync } from "node:fs";

const REQUIRED_LIMITS = ["selectedWork", "recentActivity", "popularWork", "coreStackItems"];

export function loadConfig(path) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return validateConfig(raw);
}

export function validateConfig(config) {
  const errors = [];

  if (!config.portfolioBaseUrl || typeof config.portfolioBaseUrl !== "string") {
    errors.push("portfolioBaseUrl is required");
  }
  if (!config.githubUser || typeof config.githubUser !== "string") {
    errors.push("githubUser is required");
  }
  if (!Array.isArray(config.selectedProjects) || config.selectedProjects.length < 3) {
    errors.push("selectedProjects must list at least 3 projects");
  } else {
    config.selectedProjects.forEach((project, index) => {
      if (!project.slug || typeof project.slug !== "string") {
        errors.push(`selectedProjects[${index}].slug is required`);
      }
    });
  }
  for (const key of REQUIRED_LIMITS) {
    const value = config.limits?.[key];
    if (!Number.isInteger(value) || value <= 0) {
      errors.push(`limits.${key} must be a positive integer`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`Invalid profile.config.json:\n- ${errors.join("\n- ")}`);
  }
  return config;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/config.test.js`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add profile.config.json scripts/lib/config.js tests/config.test.js
git commit -m "feat(profile): add profile config and validation"
```

---

### Task 2: Markers module

**Files:**
- Create: `scripts/lib/markers.js`
- Test: `tests/markers.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/markers.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { markerStart, markerEnd, replaceBlock } from "../scripts/lib/markers.js";

const readme = [
  "# Header",
  "<!-- PROFILE:START:SELECTED_WORK -->",
  "old content",
  "<!-- PROFILE:END:SELECTED_WORK -->",
  "## Editorial section",
  "<!-- PROFILE:START:CORE_STACK -->",
  "old stack",
  "<!-- PROFILE:END:CORE_STACK -->",
].join("\n");

test("markerStart and markerEnd produce the agreed format", () => {
  assert.equal(markerStart("SELECTED_WORK"), "<!-- PROFILE:START:SELECTED_WORK -->");
  assert.equal(markerEnd("SELECTED_WORK"), "<!-- PROFILE:END:SELECTED_WORK -->");
});

test("replaceBlock replaces only the targeted block", () => {
  const updated = replaceBlock(readme, "SELECTED_WORK", "new content");
  assert.match(updated, /new content/);
  assert.doesNotMatch(updated, /old content/);
  assert.match(updated, /old stack/);
  assert.match(updated, /## Editorial section/);
});

test("replaceBlock keeps markers in place", () => {
  const updated = replaceBlock(readme, "CORE_STACK", "new stack");
  assert.match(updated, /<!-- PROFILE:START:CORE_STACK -->\nnew stack\n<!-- PROFILE:END:CORE_STACK -->/);
});

test("replaceBlock throws when markers are missing", () => {
  assert.throws(() => replaceBlock("# No markers", "SELECTED_WORK", "x"), /exactly once/);
});

test("replaceBlock throws when markers are duplicated", () => {
  const duplicated = `${readme}\n${readme}`;
  assert.throws(() => replaceBlock(duplicated, "SELECTED_WORK", "x"), /exactly once/);
});

test("replaceBlock throws when end marker precedes start marker", () => {
  const reversed = [
    "<!-- PROFILE:END:SELECTED_WORK -->",
    "<!-- PROFILE:START:SELECTED_WORK -->",
  ].join("\n");
  assert.throws(() => replaceBlock(reversed, "SELECTED_WORK", "x"), /malformed/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/markers.test.js`
Expected: FAIL with `Cannot find module '../scripts/lib/markers.js'`

- [ ] **Step 3: Write minimal implementation**

Create `scripts/lib/markers.js`:

```js
export function markerStart(section) {
  return `<!-- PROFILE:START:${section} -->`;
}

export function markerEnd(section) {
  return `<!-- PROFILE:END:${section} -->`;
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

export function replaceBlock(readme, section, content) {
  const start = markerStart(section);
  const end = markerEnd(section);
  const pairs = countOccurrences(readme, start);
  const ends = countOccurrences(readme, end);

  if (pairs !== 1 || ends !== 1) {
    throw new Error(
      `Markers for ${section} must appear exactly once (found ${pairs} start / ${ends} end)`
    );
  }

  const startIndex = readme.indexOf(start);
  const endIndex = readme.indexOf(end);
  if (endIndex < startIndex) {
    throw new Error(`Markers for ${section} are malformed`);
  }

  return `${readme.slice(0, startIndex)}${start}\n${content.trimEnd()}\n${readme.slice(endIndex)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/markers.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/markers.js tests/markers.test.js
git commit -m "feat(profile): add marker replacement utilities"
```

---

### Task 3: Fetchers module

**Files:**
- Create: `scripts/lib/fetchers.js`
- Test: `tests/fetchers.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/fetchers.test.js`:

```js
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  fetchJson,
  fetchPortfolio,
  fetchGitHubRepos,
  fetchGitHubRepo,
  validatePortfolio,
} from "../scripts/lib/fetchers.js";

const config = { portfolioBaseUrl: "https://vid3v.com", githubUser: "vid3v" };

const portfolioResponse = {
  profile: { name: "Vivien Tassing" },
  projects: [
    { slug: "maureen", status: "PUBLIC", visibility: "VISIBLE" },
    { slug: "secret", status: "PRIVATE", visibility: "VISIBLE" },
    { slug: "hidden", status: "PUBLIC", visibility: "HIDDEN" },
  ],
  stack: [{ name: "TypeScript", category: "Languages" }],
};

const reposResponse = [
  { full_name: "vid3v/maureen", fork: false, archived: false },
  { full_name: "vid3v/some-fork", fork: true, archived: false },
  { full_name: "vid3v/old-stuff", fork: false, archived: true },
];

let originalFetch;
beforeEach(() => {
  originalFetch = globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("fetchJson returns parsed JSON on HTTP 200", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true }), { status: 200 });
  assert.deepEqual(await fetchJson("https://example.com"), { ok: true });
});

test("fetchJson throws on non-2xx responses", async () => {
  globalThis.fetch = async () => new Response("nope", { status: 503 });
  await assert.rejects(() => fetchJson("https://example.com"), /HTTP 503/);
});

test("fetchPortfolio filters projects to PUBLIC and VISIBLE", async () => {
  globalThis.fetch = async (url) =>
    new Response(JSON.stringify(url.includes("/api/profile")
      ? portfolioResponse.profile
      : url.includes("/api/projects")
        ? portfolioResponse.projects
        : portfolioResponse.stack), { status: 200 });

  const portfolio = await fetchPortfolio(config);
  assert.deepEqual(
    portfolio.projects.map((p) => p.slug),
    ["maureen"]
  );
});

test("validatePortfolio rejects malformed payloads", () => {
  assert.throws(() => validatePortfolio({ profile: null, projects: [], stack: [] }), /profile/);
  assert.throws(
    () => validatePortfolio({ profile: { name: "x" }, projects: [], stack: [] }),
    /projects/
  );
});

test("fetchGitHubRepos filters out forks and archived repositories", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify(reposResponse), { status: 200 });
  const repos = await fetchGitHubRepos(config, undefined);
  assert.deepEqual(repos.map((r) => r.full_name), ["vid3v/maureen"]);
});

test("fetchGitHubRepo throws on malformed repo payload", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ message: "Not Found" }), { status: 200 });
  await assert.rejects(() => fetchGitHubRepo("vid3v/unknown", undefined), /malformed/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/fetchers.test.js`
Expected: FAIL with `Cannot find module '../scripts/lib/fetchers.js'`

- [ ] **Step 3: Write minimal implementation**

Create `scripts/lib/fetchers.js`:

```js
const TIMEOUT_MS = 15000;

function githubHeaders(token) {
  const headers = { accept: "application/vnd.github+json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

export async function fetchJson(url, headers = {}) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "vid3v-profile-readme", ...headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`GET ${url} failed: HTTP ${response.status}`);
  }
  return response.json();
}

export function validatePortfolio({ profile, projects, stack }) {
  if (!profile || typeof profile.name !== "string") {
    throw new Error("Portfolio profile response is malformed");
  }
  if (!Array.isArray(projects) || projects.length === 0) {
    throw new Error("Portfolio projects response is malformed");
  }
  if (!Array.isArray(stack)) {
    throw new Error("Portfolio stack response is malformed");
  }
}

export async function fetchPortfolio(config) {
  const base = config.portfolioBaseUrl.replace(/\/$/, "");
  const [profile, projects, stack] = await Promise.all([
    fetchJson(`${base}/api/profile`),
    fetchJson(`${base}/api/projects?status=PUBLIC&visibility=VISIBLE`),
    fetchJson(`${base}/api/stack`),
  ]);
  validatePortfolio({ profile, projects, stack });
  return {
    profile,
    projects: projects.filter((p) => p.status === "PUBLIC" && p.visibility === "VISIBLE"),
    stack,
  };
}

export async function fetchGitHubRepos(config, token) {
  const repos = await fetchJson(
    `https://api.github.com/users/${config.githubUser}/repos?per_page=100&sort=pushed`,
    githubHeaders(token)
  );
  if (!Array.isArray(repos)) {
    throw new Error("GitHub repos response is malformed");
  }
  return repos.filter((repo) => !repo.fork && !repo.archived);
}

export async function fetchGitHubEvents(config, token) {
  const events = await fetchJson(
    `https://api.github.com/users/${config.githubUser}/events/public?per_page=30`,
    githubHeaders(token)
  );
  if (!Array.isArray(events)) {
    throw new Error("GitHub events response is malformed");
  }
  return events;
}

export async function fetchGitHubRepo(fullName, token) {
  const repo = await fetchJson(`https://api.github.com/repos/${fullName}`, githubHeaders(token));
  if (!repo || typeof repo.full_name !== "string") {
    throw new Error(`GitHub repo ${fullName} response is malformed`);
  }
  return repo;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/fetchers.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/fetchers.js tests/fetchers.test.js
git commit -m "feat(profile): add portfolio and GitHub fetchers"
```

---

### Task 4: Scoring module

**Files:**
- Create: `scripts/lib/scoring.js`
- Test: `tests/scoring.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/scoring.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  relevanceScore,
  utilityScore,
  popularityScore,
  freshnessScore,
  scoreProject,
  selectProjects,
} from "../scripts/lib/scoring.js";

const weights = { relevance: 3, utility: 2, popularity: 1, freshness: 1 };
const now = new Date("2026-09-12T00:00:00Z");

test("relevanceScore maps categories to the agreed scale", () => {
  assert.equal(relevanceScore({ category: "Open Source Library" }), 3);
  assert.equal(relevanceScore({ category: "SaaS Platform" }), 3);
  assert.equal(relevanceScore({ category: "Enterprise Suite" }), 3);
  assert.equal(relevanceScore({ category: "Mobile Application" }), 2);
  assert.equal(relevanceScore({ category: "Web Platform" }), 2);
  assert.equal(relevanceScore({ category: "Something else" }), 1);
});

test("utilityScore rewards real products with a public link", () => {
  assert.equal(utilityScore({ results: "In production", githubUrl: "https://x" }), 2);
  assert.equal(utilityScore({ results: "In production", demoUrl: "https://x" }), 2);
  assert.equal(utilityScore({ results: "In production" }), 1);
  assert.equal(utilityScore({ results: "  " }), 0);
  assert.equal(utilityScore({}), 0);
});

test("popularityScore buckets stars and forks", () => {
  assert.equal(popularityScore(undefined), 0);
  assert.equal(popularityScore({ stargazers_count: 0, forks_count: 0 }), 0);
  assert.equal(popularityScore({ stargazers_count: 1, forks_count: 0 }), 1);
  assert.equal(popularityScore({ stargazers_count: 2, forks_count: 1 }), 2);
  assert.equal(popularityScore({ stargazers_count: 9, forks_count: 1 }), 3);
});

test("freshnessScore decays with age", () => {
  assert.equal(freshnessScore("2026-09-01T00:00:00Z", now), 3);
  assert.equal(freshnessScore("2026-07-01T00:00:00Z", now), 2);
  assert.equal(freshnessScore("2026-01-01T00:00:00Z", now), 1);
  assert.equal(freshnessScore("2020-01-01T00:00:00Z", now), 0);
  assert.equal(freshnessScore(undefined, now), 0);
});

test("scoreProject prefers repo pushed_at over portfolio updatedAt", () => {
  const project = { category: "SaaS Platform", results: "Live", githubUrl: "https://x", updatedAt: "2020-01-01T00:00:00Z" };
  const withRepo = scoreProject(project, { pushed_at: "2026-09-01T00:00:00Z", stargazers_count: 5, forks_count: 0 }, weights, now);
  const withoutRepo = scoreProject(project, undefined, weights, now);
  assert.ok(withRepo > withoutRepo);
});

test("selectProjects returns top 3 ordered by score, ties broken by config order", () => {
  const config = {
    limits: { selectedWork: 3 },
    weights,
    selectedProjects: [
      { slug: "a", githubRepo: null },
      { slug: "b", githubRepo: null },
      { slug: "c", githubRepo: null },
      { slug: "d", githubRepo: null },
    ],
  };
  const projectsBySlug = {
    a: { slug: "a", category: "Web Platform", results: "r", githubUrl: "u", updatedAt: "2020-01-01T00:00:00Z" },
    b: { slug: "b", category: "SaaS Platform", results: "r", githubUrl: "u", updatedAt: "2026-09-01T00:00:00Z" },
    c: { slug: "c", category: "Web Platform", results: "r", githubUrl: "u", updatedAt: "2020-01-01T00:00:00Z" },
    d: { slug: "d", category: "Web Platform", results: "r", githubUrl: "u", updatedAt: "2020-01-01T00:00:00Z" },
  };
  const selected = selectProjects(config, projectsBySlug, {}, now);
  assert.deepEqual(selected.map((s) => s.project.slug), ["b", "a", "c"]);
});

test("selectProjects skips configured projects missing from the portfolio", () => {
  const config = {
    limits: { selectedWork: 2 },
    weights,
    selectedProjects: [
      { slug: "ghost", githubRepo: null },
      { slug: "b", githubRepo: null },
      { slug: "c", githubRepo: null },
    ],
  };
  const projectsBySlug = {
    b: { slug: "b", category: "SaaS Platform", results: "r", githubUrl: "u", updatedAt: "2026-09-01T00:00:00Z" },
    c: { slug: "c", category: "Web Platform", results: "r", githubUrl: "u", updatedAt: "2020-01-01T00:00:00Z" },
  };
  const selected = selectProjects(config, projectsBySlug, {}, now);
  assert.deepEqual(selected.map((s) => s.project.slug), ["b", "c"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/scoring.test.js`
Expected: FAIL with `Cannot find module '../scripts/lib/scoring.js'`

- [ ] **Step 3: Write minimal implementation**

Create `scripts/lib/scoring.js`:

```js
const RELEVANCE_BY_CATEGORY = {
  "Open Source Library": 3,
  "SaaS Platform": 3,
  "Enterprise Suite": 3,
  "Mobile Application": 2,
  "Web Platform": 2,
};

export function relevanceScore(project) {
  return RELEVANCE_BY_CATEGORY[project.category] ?? 1;
}

export function utilityScore(project) {
  const hasResults = typeof project.results === "string" && project.results.trim().length > 0;
  const hasLink = Boolean(project.githubUrl || project.demoUrl);
  if (hasResults && hasLink) return 2;
  if (hasResults) return 1;
  return 0;
}

export function popularityScore(repo) {
  if (!repo) return 0;
  const signals = (repo.stargazers_count ?? 0) + (repo.forks_count ?? 0);
  if (signals >= 10) return 3;
  if (signals >= 3) return 2;
  if (signals >= 1) return 1;
  return 0;
}

export function freshnessScore(dateString, now = new Date()) {
  if (!dateString) return 0;
  const days = (now.getTime() - new Date(dateString).getTime()) / 86400000;
  if (days <= 30) return 3;
  if (days <= 90) return 2;
  if (days <= 365) return 1;
  return 0;
}

export function scoreProject(project, repo, weights, now = new Date()) {
  const lastUpdate = repo?.pushed_at ?? project.updatedAt;
  return (
    weights.relevance * relevanceScore(project) +
    weights.utility * utilityScore(project) +
    weights.popularity * popularityScore(repo) +
    weights.freshness * freshnessScore(lastUpdate, now)
  );
}

export function selectProjects(config, projectsBySlug, reposByFullName, now = new Date()) {
  const scored = config.selectedProjects
    .map((entry, index) => {
      const project = projectsBySlug[entry.slug];
      if (!project) return null;
      const repo = entry.githubRepo ? reposByFullName[entry.githubRepo] : undefined;
      return {
        entry,
        project,
        repo,
        index,
        score: scoreProject(project, repo, config.weights, now),
      };
    })
    .filter(Boolean);

  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.slice(0, config.limits.selectedWork);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/scoring.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/scoring.js tests/scoring.test.js
git commit -m "feat(profile): add project scoring and selection"
```

---

### Task 5: Render module

**Files:**
- Create: `scripts/lib/render.js`
- Test: `tests/render.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/render.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  escapeInline,
  projectLink,
  renderSelectedWork,
  renderRecentActivity,
  renderPopularWork,
  renderCoreStack,
} from "../scripts/lib/render.js";

test("escapeInline neutralizes Markdown-breaking characters", () => {
  assert.equal(escapeInline("a | b\nc  d `e`"), "a \\| b c d 'e'");
  assert.equal(escapeInline(undefined), "");
});

test("projectLink prefers githubUrl, then demoUrl, then portfolio page", () => {
  assert.equal(projectLink({ githubUrl: "https://g", demoUrl: "https://d", slug: "s" }), "https://g");
  assert.equal(projectLink({ demoUrl: "https://d", slug: "s" }), "https://d");
  assert.equal(projectLink({ slug: "maureen" }), "https://vid3v.com/fr/projects/maureen");
});

test("renderSelectedWork renders title, role, description and technologies", () => {
  const markdown = renderSelectedWork([
    {
      project: {
        title: "Maureen",
        slug: "maureen",
        role: "Founder & Full-Stack Developer",
        shortDescription: "WhatsApp automation platform",
        technologies: ["Hono", "D1", "Queues", "Workers AI", "R2"],
        githubUrl: "https://github.com/vid3v/maureen",
      },
      repo: { stargazers_count: 4 },
    },
  ]);
  assert.match(markdown, /### \[Maureen\]\(https:\/\/github\.com\/vid3v\/maureen\)/);
  assert.match(markdown, /Founder & Full-Stack Developer/);
  assert.match(markdown, /WhatsApp automation platform/);
  assert.match(markdown, /Hono · D1 · Queues · Workers AI/);
  assert.match(markdown, /⭐ 4/);
});

test("renderRecentActivity deduplicates repos and applies the limit", () => {
  const events = [
    { type: "PushEvent", repo: { name: "vid3v/maureen" } },
    { type: "PushEvent", repo: { name: "vid3v/maureen" } },
    { type: "ReleaseEvent", repo: { name: "vid3v/feathers-refresh" } },
    { type: "IssueCommentEvent", repo: { name: "vid3v/other" } },
  ];
  const markdown = renderRecentActivity(events, 1);
  assert.equal(markdown, "- Pushed to [`vid3v/maureen`](https://github.com/vid3v/maureen)");
});

test("renderRecentActivity falls back when nothing relevant", () => {
  const markdown = renderRecentActivity([{ type: "IssueCommentEvent", repo: { name: "x/y" } }], 5);
  assert.match(markdown, /private client work/);
});

test("renderPopularWork filters repos without description and ranks by stars", () => {
  const repos = [
    { name: "low", html_url: "https://g/low", description: "d", stargazers_count: 1, pushed_at: "2026-01-01", language: "TypeScript" },
    { name: "high", html_url: "https://g/high", description: "d", stargazers_count: 9, pushed_at: "2026-01-01", language: null },
    { name: "nodesc", html_url: "https://g/nodesc", description: null, stargazers_count: 99, pushed_at: "2026-01-01" },
  ];
  const markdown = renderPopularWork(repos, 5);
  assert.match(markdown, /high/);
  assert.match(markdown, /low/);
  assert.doesNotMatch(markdown, /nodesc/);
  assert.match(markdown, /· TypeScript/);
});

test("renderCoreStack groups by category and respects the total limit", () => {
  const stack = [
    { name: "TypeScript", category: "Languages" },
    { name: "SQL", category: "Languages" },
    { name: "Hono", category: "Frameworks" },
  ];
  const markdown = renderCoreStack(stack, 2);
  assert.match(markdown, /\*\*Languages:\*\* TypeScript · SQL/);
  assert.doesNotMatch(markdown, /Hono/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/render.test.js`
Expected: FAIL with `Cannot find module '../scripts/lib/render.js'`

- [ ] **Step 3: Write minimal implementation**

Create `scripts/lib/render.js`:

```js
const ACTIVITY_VERBS = {
  PushEvent: "Pushed to",
  CreateEvent: "Created repository",
  ReleaseEvent: "Released",
  PublicEvent: "Open-sourced",
};

export function escapeInline(text) {
  return String(text ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\|/g, "\\|")
    .replace(/`/g, "'")
    .trim();
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function projectLink(project) {
  return (
    project.githubUrl ||
    project.demoUrl ||
    `https://vid3v.com/fr/projects/${project.slug}`
  );
}

export function renderSelectedWork(selected) {
  return selected
    .map(({ project, repo }) => {
      const name = escapeInline(project.title);
      const link = projectLink(project);
      const role = project.role ? ` — *${escapeInline(project.role)}*` : "";
      const description = escapeInline(project.shortDescription || project.description);
      const technologies = toArray(project.technologies)
        .slice(0, 4)
        .map(escapeInline)
        .join(" · ");
      const stars = repo ? ` · ⭐ ${repo.stargazers_count}` : "";
      return `### [${name}](${link})${role}\n\n${description}\n\n\`${technologies}\`${stars}\n`;
    })
    .join("\n");
}

export function renderRecentActivity(events, limit) {
  const seen = new Set();
  const lines = [];
  for (const event of events) {
    const verb = ACTIVITY_VERBS[event.type];
    const repo = event.repo?.name;
    if (!verb || !repo || seen.has(repo)) continue;
    seen.add(repo);
    lines.push(`- ${verb} [\`${repo}\`](https://github.com/${repo})`);
    if (lines.length >= limit) break;
  }
  if (lines.length === 0) {
    return "Focused on private client work — see [Selected work](#selected-work).";
  }
  return lines.join("\n");
}

export function renderPopularWork(repos, limit) {
  const ranked = repos
    .filter((repo) => typeof repo.description === "string" && repo.description.trim().length > 0)
    .sort(
      (a, b) =>
        b.stargazers_count - a.stargazers_count ||
        new Date(b.pushed_at) - new Date(a.pushed_at)
    )
    .slice(0, limit);

  if (ranked.length === 0) {
    return "No public repositories with descriptions yet.";
  }
  return ranked
    .map((repo) => {
      const language = repo.language ? ` · ${escapeInline(repo.language)}` : "";
      return `- [${escapeInline(repo.name)}](${repo.html_url}) — ${escapeInline(repo.description)} (⭐ ${repo.stargazers_count}${language})`;
    })
    .join("\n");
}

export function renderCoreStack(stack, limit) {
  const groups = new Map();
  let count = 0;
  for (const item of stack) {
    if (count >= limit) break;
    const category = escapeInline(item.category);
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(escapeInline(item.name));
    count += 1;
  }
  return [...groups.entries()]
    .map(([category, names]) => `**${category}:** ${names.join(" · ")}`)
    .join("\n\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/render.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/render.js tests/render.test.js
git commit -m "feat(profile): add Markdown renderers for dynamic blocks"
```

---

### Task 6: Generate module (pure composition)

**Files:**
- Create: `scripts/lib/generate.js`
- Test: `tests/generate.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/generate.test.js`:

```js
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
  assert.match(output, /maureen — WhatsApp automation/);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/generate.test.js`
Expected: FAIL with `Cannot find module '../scripts/lib/generate.js'`

- [ ] **Step 3: Write minimal implementation**

Create `scripts/lib/generate.js`:

```js
import { replaceBlock } from "./markers.js";
import { selectProjects } from "./scoring.js";
import {
  renderSelectedWork,
  renderRecentActivity,
  renderPopularWork,
  renderCoreStack,
} from "./render.js";

export function generateReadme({ readme, config, portfolio, repos, events, reposByFullName, now = new Date() }) {
  const projectsBySlug = Object.fromEntries(
    portfolio.projects.map((project) => [project.slug, project])
  );

  const selected = selectProjects(config, projectsBySlug, reposByFullName, now);
  if (selected.length < Math.min(config.limits.selectedWork, config.selectedProjects.length)) {
    throw new Error(
      `Not enough eligible projects to render Selected work (found ${selected.length}, need ${config.limits.selectedWork})`
    );
  }

  let output = readme;
  output = replaceBlock(output, "SELECTED_WORK", renderSelectedWork(selected));
  output = replaceBlock(output, "RECENT_ACTIVITY", renderRecentActivity(events, config.limits.recentActivity));
  output = replaceBlock(output, "POPULAR_WORK", renderPopularWork(repos, config.limits.popularWork));
  output = replaceBlock(output, "CORE_STACK", renderCoreStack(portfolio.stack, config.limits.coreStackItems));
  return output;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/generate.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/generate.js tests/generate.test.js
git commit -m "feat(profile): add pure README generation"
```

---

### Task 7: CLI entry point and new README.md

**Files:**
- Create: `scripts/update-profile-readme.mjs`
- Modify: `README.md` (full rewrite)

- [ ] **Step 1: Write the CLI entry point**

Create `scripts/update-profile-readme.mjs`:

```js
#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "./lib/config.js";
import {
  fetchPortfolio,
  fetchGitHubRepos,
  fetchGitHubEvents,
  fetchGitHubRepo,
} from "./lib/fetchers.js";
import { generateReadme } from "./lib/generate.js";

const dryRun = process.argv.slice(2).includes("--dry-run");
const root = path.resolve(import.meta.dirname, "..");

try {
  const config = loadConfig(path.join(root, "profile.config.json"));
  const readmePath = path.join(root, "README.md");
  const readme = readFileSync(readmePath, "utf8");

  const token = process.env.GITHUB_TOKEN;
  const [portfolio, repos, events] = await Promise.all([
    fetchPortfolio(config),
    fetchGitHubRepos(config, token),
    fetchGitHubEvents(config, token),
  ]);

  const reposByFullName = Object.fromEntries(repos.map((repo) => [repo.full_name, repo]));
  for (const entry of config.selectedProjects) {
    if (entry.githubRepo && !reposByFullName[entry.githubRepo]) {
      reposByFullName[entry.githubRepo] = await fetchGitHubRepo(entry.githubRepo, token);
    }
  }

  const updated = generateReadme({ readme, config, portfolio, repos, events, reposByFullName });

  if (dryRun) {
    process.stdout.write(updated);
    process.exit(0);
  }

  if (updated === readme) {
    console.log("README is already up to date");
    process.exit(0);
  }

  writeFileSync(readmePath, updated);
  console.log("README updated");
} catch (error) {
  console.error(`Profile README update failed: ${error.message}`);
  process.exit(1);
}
```

Note: any thrown error (fetch, validation, markers) exits with status 1 **before** `writeFileSync`, so a failed run never modifies the README. This implements the spec's resilience behavior (§9).

- [ ] **Step 2: Rewrite `README.md`**

Replace the entire content of `README.md` with:

```markdown
# Hi, I'm Vivien Tassing 👋

## Full-stack engineer

Founder building production-ready web and mobile products, typed APIs and edge-native systems.

[Portfolio](https://vid3v.com) · [Contact](https://vid3v.com/fr/contact) · [LinkedIn](https://www.linkedin.com/in/vivien-tassing)

> Open to selected projects and collaborations.

## What I build

- Complete web and mobile products — from app to back office
- Typed APIs and operational admin consoles
- Edge-native systems with Cloudflare Workers, D1 and R2
- Developer tools and open-source packages

## Selected work

<!-- PROFILE:START:SELECTED_WORK -->
<!-- Generated from vid3v.com and GitHub — do not edit manually -->
<!-- PROFILE:END:SELECTED_WORK -->

## Recent GitHub activity

<!-- PROFILE:START:RECENT_ACTIVITY -->
<!-- Generated from GitHub — do not edit manually -->
<!-- PROFILE:END:RECENT_ACTIVITY -->

## Open source & public work

<!-- PROFILE:START:POPULAR_WORK -->
<!-- Generated from GitHub — do not edit manually -->
<!-- PROFILE:END:POPULAR_WORK -->

## Core stack

<!-- PROFILE:START:CORE_STACK -->
<!-- Generated from vid3v.com — do not edit manually -->
<!-- PROFILE:END:CORE_STACK -->

## Let's work together

Open to selected projects and collaborations.

- **For projects:** [Discuss your product → vid3v.com/contact](https://vid3v.com/fr/contact)
- **For opportunities:** [Connect on LinkedIn](https://www.linkedin.com/in/vivien-tassing)
```

- [ ] **Step 3: Run the full test suite**

Run: `node --test`
Expected: PASS (31 tests across 6 files)

- [ ] **Step 4: Verify the generator end-to-end in dry-run mode**

Run: `node scripts/update-profile-readme.mjs --dry-run`
Expected: the README with all four dynamic blocks filled with real data from `vid3v.com` and GitHub, printed to stdout; exit code 0. If a remote API is unreachable, expect exit code 1 with `Profile README update failed: ...` and **no file modification** (verify with `git status --short README.md` showing nothing).

- [ ] **Step 5: Run the generator for real and inspect the result**

Run: `node scripts/update-profile-readme.mjs && git diff --stat`
Expected: `README updated`, and `git diff --stat` shows `README.md | ... +` only. Read `README.md` to confirm the rendered blocks look professional.

- [ ] **Step 6: Run the generator again to verify no-op behavior**

Run: `node scripts/update-profile-readme.mjs`
Expected: `README is already up to date`, exit code 0, no new changes in `git status`.

- [ ] **Step 7: Commit**

```bash
git add scripts/update-profile-readme.mjs README.md
git commit -m "feat(profile): add CLI generator and new professional README"
```

---

### Task 8: GitHub Actions workflow and final verification

**Files:**
- Create: `.github/workflows/update-profile-readme.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/update-profile-readme.yml`:

```yaml
name: Update profile README

on:
  schedule:
    # Daily at 05:23 UTC
    - cron: "23 5 * * *"
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: update-profile-readme
  cancel-in-progress: false

jobs:
  update:
    name: Regenerate dynamic sections
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@v7

      - name: Set up Node.js
        uses: actions/setup-node@v7
        with:
          node-version: 24

      - name: Run tests
        run: node --test

      - name: Regenerate README
        run: node scripts/update-profile-readme.mjs
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Commit and push if changed
        run: |
          if [[ -n "$(git status --porcelain README.md)" ]]; then
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git add README.md
            git commit -m "chore(profile): update dynamic README sections"
            git push
          else
            echo "README already up to date — nothing to commit"
          fi
```

Notes:
- `secrets.GITHUB_TOKEN` is the automatically provided token; it raises the GitHub API rate limit from 60 to 1000 requests/hour and can push to the repository thanks to `permissions: contents: write`.
- A failed run (API down, malformed data, missing markers) exits non-zero before the commit step, so the last published README is preserved — per spec §9.

- [ ] **Step 2: Run the full test suite one final time**

Run: `node --test`
Expected: PASS (31 tests)

- [ ] **Step 3: Verify the final repository structure**

Run: `git status --short && find . -type f -not -path './.git/*' | sort`
Expected: only the workflow file is new/modified; structure matches:

```text
.github/workflows/update-profile-readme.yml
README.md
profile.config.json
scripts/lib/{config,markers,fetchers,scoring,render,generate}.js
scripts/update-profile-readme.mjs
tests/*.test.js
docs/superpowers/...
```

- [ ] **Step 4: Commit the workflow**

```bash
git add .github/workflows/update-profile-readme.yml
git commit -m "ci(profile): daily dynamic README update workflow"
```

- [ ] **Step 5: Push and activate (requires owner authentication)**

Run: `git push origin main`
Expected: push succeeds. Then verify on GitHub:
1. Open `https://github.com/vid3v/vid3v/actions` and manually trigger **Update profile README** via **Run workflow**.
2. Confirm the run passes and either commits `chore(profile): update dynamic README sections` or reports "README already up to date".
3. Confirm `https://github.com/vid3v` renders the new profile with filled dynamic sections.

- [ ] **Step 6: Final spec-conformance checklist**

Verify each item manually after the first scheduled run:

- [ ] Selected work shows exactly 3 projects from the priority list, with role, description, technologies and a public link.
- [ ] Recent activity excludes noise (no forks, no archived repos, deduplicated).
- [ ] Popular work excludes repos without descriptions and ranks by stars.
- [ ] Core stack groups technologies by category with a cap of 18 items.
- [ ] Editorial sections (hero, What I build, contact) are untouched by the workflow.
- [ ] A second manual workflow run produces no new commit (deterministic rendering).
- [ ] No personal email address appears anywhere in the README.

---

## Self-Review Notes

- **Spec coverage:** §3 structure → Task 7; §4 sources → Task 3; §5 selection/scoring → Task 1 + 4; §6 markers → Task 2 + 6; §7 architecture → file structure; §8 Actions behavior → Task 8; §9 resilience → Task 7 Step 1 (exit before write) + Task 8 (failed job blocks commit); §10 rendering constraints → Task 5; §11 validation → all test tasks. No gaps found.
- **Placeholder scan:** no TBD/TODO; every code step contains complete code; every test contains complete assertions.
- **Type consistency:** `selectProjects(config, projectsBySlug, reposByFullName, now)` and `generateReadme({...})` signatures are identical across Tasks 4, 6 and 7; marker names (`SELECTED_WORK`, `RECENT_ACTIVITY`, `POPULAR_WORK`, `CORE_STACK`) match between Tasks 2, 6, 7 and 8; config keys match between `profile.config.json` (Task 1) and all consumers.
