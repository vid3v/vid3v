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
