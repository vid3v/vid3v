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
