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
