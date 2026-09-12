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

async function main() {
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
      return;
    }

    if (updated === readme) {
      console.log("README is already up to date");
      return;
    }

    writeFileSync(readmePath, updated);
    console.log("README updated");
  } catch (error) {
    console.error(`Profile README update failed: ${error.message}`);
    process.exit(1);
  }
}

await main();
