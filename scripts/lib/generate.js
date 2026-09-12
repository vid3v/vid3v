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
