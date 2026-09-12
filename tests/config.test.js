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

test("validateConfig rejects invalid weights", () => {
  const broken = { ...validConfig, weights: { ...validConfig.weights, relevance: "3" } };
  assert.throws(() => validateConfig(broken), /weights/);
  const negative = { ...validConfig, weights: { ...validConfig.weights, utility: -1 } };
  assert.throws(() => validateConfig(negative), /weights/);
});

test("loadConfig reads the real profile.config.json", () => {
  const config = loadConfig(new URL("../profile.config.json", import.meta.url));
  assert.equal(config.githubUser, "vid3v");
  assert.equal(config.selectedProjects.length, 5);
});
