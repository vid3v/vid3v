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
