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

test("fetchJson sends user-agent and forward custom headers", async () => {
  let capturedInit;
  globalThis.fetch = async (url, init) => {
    capturedInit = init;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  await fetchJson("https://api.github.com/x", { accept: "application/vnd.github+json", authorization: "Bearer t" });
  assert.equal(capturedInit.headers["user-agent"], "vid3v-profile-readme");
  assert.equal(capturedInit.headers.accept, "application/vnd.github+json");
  assert.equal(capturedInit.headers.authorization, "Bearer t");
});
