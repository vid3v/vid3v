const TIMEOUT_MS = 15000;

function githubHeaders(token) {
  const headers = { accept: "application/vnd.github+json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

export async function fetchResponse(url, headers = {}) {
  return fetch(url, {
    headers: { accept: "application/json", "user-agent": "vid3v-profile-readme", ...headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

export async function fetchJson(url, headers = {}) {
  const response = await fetchResponse(url, headers);
  if (!response.ok) {
    throw new Error(`GET ${url} failed: HTTP ${response.status}`);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`GET ${url} returned invalid JSON`, { cause: error });
  }
}

export function validatePortfolio({ profile, projects, stack }) {
  if (!profile || typeof profile.name !== "string") {
    throw new Error("Portfolio profile response is malformed");
  }
  if (!Array.isArray(projects) || projects.length === 0) {
    throw new Error("Portfolio projects response is malformed");
  }
  if (!Array.isArray(stack) || stack.length === 0) {
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
  const excluded = new Set(config.excludedRepos ?? []);
  return repos.filter(
    (repo) => !repo.fork && !repo.archived && !excluded.has(repo.full_name)
  );
}

export async function fetchGitHubEvents(config, token) {
  const events = await fetchJson(
    `https://api.github.com/users/${config.githubUser}/events/public?per_page=30`,
    githubHeaders(token)
  );
  if (!Array.isArray(events)) {
    throw new Error("GitHub events response is malformed");
  }
  const excluded = new Set(config.excludedRepos ?? []);
  return events.filter((event) => !excluded.has(event.repo?.name));
}

export async function fetchGitHubRepo(fullName, token) {
  // A 404 means the repo is private, renamed or deleted: per spec §5 the project
  // stays eligible via its portfolio data and simply has no GitHub metadata.
  const response = await fetchResponse(
    `https://api.github.com/repos/${fullName}`,
    githubHeaders(token)
  );
  if (response.status === 404) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error(`GET https://api.github.com/repos/${fullName} failed: HTTP ${response.status}`);
  }
  let repo;
  try {
    repo = await response.json();
  } catch (error) {
    throw new Error(`GET https://api.github.com/repos/${fullName} returned invalid JSON`, { cause: error });
  }
  if (!repo || typeof repo.full_name !== "string") {
    throw new Error(`GitHub repo ${fullName} response is malformed`);
  }
  return repo;
}
