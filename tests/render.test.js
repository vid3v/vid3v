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

test("renderSelectedWork suppresses the star badge when the count is 0", () => {
  const markdown = renderSelectedWork([
    {
      project: {
        title: "Maureen",
        slug: "maureen",
        shortDescription: "WhatsApp automation platform",
        technologies: ["Hono"],
        githubUrl: "https://github.com/vid3v/maureen",
      },
      repo: { stargazers_count: 0 },
    },
  ]);
  assert.doesNotMatch(markdown, /⭐/);
});
