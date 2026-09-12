# GitHub Profile README — Dynamic Professional Profile

- **Date:** 2026-09-12
- **Repository:** `vid3v/vid3v`
- **Status:** Design approved

## 1. Objective

Replace the existing profile README with an English-language professional profile aimed at recruiters and prospects. The README should present Vivien Tassing as a **Full-stack engineer** and founder building production-ready products, while remaining useful and maintainable over time.

The profile must combine deliberate editorial content with automatically refreshed proof of work. It should favor clarity, relevant projects, and credible technical signals over decorative statistics or an exhaustive list of historical technologies.

## 2. Audience and positioning

Primary audiences:

- **Recruiters:** quickly understand the role, technical scope, experience level, and evidence of delivered products.
- **Prospects:** understand the problems and product surfaces Vivien can help build, see relevant examples, and find a direct contact path.

Approved positioning:

> **Full-stack engineer**  
> Founder building production-ready web and mobile products, typed APIs and edge-native systems.

Public availability statement:

> Open to selected projects and collaborations.

The README will be written in English.

## 3. Proposed README structure

Stable editorial sections will be maintained manually in `README.md`:

1. **Hero**
   - Name and concise professional title.
   - Short value proposition.
   - Links to the portfolio, website contact form, and LinkedIn.
   - Availability statement.

2. **What I build**
   - Complete web and mobile products.
   - Typed APIs and operational back offices.
   - Edge-native systems with Cloudflare.
   - Developer tools and open-source packages.

3. **Selected work**
   - Dynamic block containing three projects.

4. **Recent GitHub activity**
   - Dynamic block containing a short, filtered activity summary.

5. **Open source & public work**
   - Dynamic block containing notable public repositories.

6. **Core stack**
   - Dynamic block containing a curated stack from the portfolio.

7. **Let's work together**
   - Website contact form as the primary project contact path.
   - LinkedIn as the secondary professional contact path.

The README must not expose a personal email address unless this is explicitly requested later.

## 4. Dynamic data sources

### Portfolio: `vid3v.com`

The generator will consume the existing public API routes:

- `https://vid3v.com/api/profile`
- `https://vid3v.com/api/projects?status=PUBLIC&visibility=VISIBLE`
- `https://vid3v.com/api/stack`

The portfolio is the source of truth for:

- professional profile and bio;
- project descriptions, roles, categories, and technologies;
- projects hosted on GitHub, Bitbucket, or private organizations;
- core stack and professional presentation.

Only public portfolio data will be used. The generator must not attempt to expose confidential project details.

### GitHub

The generator will use the public GitHub API for user `vid3v` to retrieve:

- public repository metadata;
- repository descriptions and primary languages;
- stars and forks;
- last update timestamps;
- recent public activity;
- public open-source signals.

The workflow will use the automatically provided `GITHUB_TOKEN`; no personal GitHub token is required for the initial public-data implementation.

## 5. Selected projects

The eligible project list is explicitly configured in the `vid3v/vid3v` repository. The confirmed candidates are:

- Feathers Refresh
- Maureen
- WaitNous
- FalaMoney
- Factory Management

The generator will select three projects from this list. It will combine:

- **Relevance** to the full-stack engineer positioning;
- **Utility** and evidence of a real product or concrete use case;
- **Popularity** using public GitHub signals when available;
- **Freshness** based on recent activity or updates.

Relevance and utility are the dominant signals. Popularity must not cause a less representative project to replace a stronger professional example. Projects without GitHub metadata, including Bitbucket or private-organization projects, remain eligible through their `vid3v.com` data.

Each rendered project should contain, where available:

- project name;
- short description;
- role;
- three or four representative technologies;
- public project, repository, demo, or package link.

The configuration should permit the eligible list and scoring weights to evolve without changing the README generator’s core logic.

## 6. Dynamic blocks and update boundaries

The README will contain explicit markers for generated sections. Recommended marker format:

```md
<!-- PROFILE:START:SELECTED_WORK -->
<!-- generated content -->
<!-- PROFILE:END:SELECTED_WORK -->
```

Equivalent markers will be used for:

- `RECENT_ACTIVITY`;
- `POPULAR_WORK`;
- `CORE_STACK`.

The generator may replace content only inside these marker pairs. It must never overwrite the manually maintained editorial sections.

The generator must validate that each expected marker pair exists exactly once before writing. Missing, duplicated, or malformed markers must fail the run.

## 7. Repository architecture

The profile repository will contain:

```text
vid3v/vid3v/
├── README.md
├── profile.config.json
├── scripts/
│   └── update-profile-readme.mjs
└── .github/
    └── workflows/
        └── update-profile-readme.yml
```

Responsibilities:

- `README.md`: stable editorial profile plus dynamic markers.
- `profile.config.json`: eligible projects, scoring weights, limits, and source URLs.
- `scripts/update-profile-readme.mjs`: fetch, validate, score, render, and update logic.
- `.github/workflows/update-profile-readme.yml`: daily and manual execution, permissions, and commit behavior.

The initial implementation should avoid adding a runtime dependency unless it provides clear value. Node.js built-in `fetch` and filesystem APIs are sufficient for the first generator.

## 8. GitHub Actions behavior

The workflow will:

- run once per day using `schedule`;
- support manual execution with `workflow_dispatch`;
- check out the repository;
- run the Node.js generator;
- commit and push only when `README.md` changed;
- use the workflow-provided `GITHUB_TOKEN` with the minimum required contents permission.

The generated commit should use a recognizable message, for example:

```text
chore(profile): update dynamic README sections
```

The workflow must not create a commit when the generated content is identical to the current README.

## 9. Failure and resilience behavior

The safe default is to preserve the last published state.

If `vid3v.com` or GitHub is unavailable, returns a non-success response, returns malformed data, or fails validation:

1. the generator exits with a non-zero status;
2. the workflow is marked as failed;
3. no README change is committed or pushed;
4. the currently published README remains unchanged;
5. the failure is visible in GitHub Actions logs.

The initial implementation will not publish partial data or fallback placeholder text. A future cache can be considered separately, but is out of scope for this design.

## 10. Rendering constraints

The generated content must be concise and readable on GitHub desktop and mobile.

The generator should:

- limit Selected work to exactly three projects when enough valid candidates exist;
- keep Recent GitHub activity short and filtered;
- exclude forks and archived repositories from activity/popularity sections;
- ignore repositories without useful descriptions where a description is required;
- avoid decorative contribution counters and noisy badge walls;
- escape or safely format remote text before inserting it into Markdown;
- use stable ordering and deterministic rendering to avoid unnecessary daily commits.

The output should remain useful if a remote project has no public repository metadata.

## 11. Validation and testing

Before writing the README, the generator must validate:

- all remote requests succeed;
- JSON responses have the expected shape;
- only public/visible portfolio records are considered;
- configured projects can be matched by slug or an explicit source identifier;
- required README markers exist exactly once;
- each dynamic section renders valid non-empty Markdown;
- the selected-project result is deterministic for unchanged source data.

The implementation should include local testable behavior for:

- scoring and ranking projects;
- filtering forks and archived repositories;
- rendering each dynamic block;
- marker replacement;
- rejecting malformed or missing markers;
- failing without writing when a source fetch or validation fails.

A dry-run or preview mode is recommended for local verification, but it must not be required by the scheduled workflow.

## 12. Out of scope

The following are intentionally excluded from this design:

- changing the `vid3v-command-center` repository;
- making `vid3v.com` generate or write the README;
- using a third-party README/statistics service;
- exposing private repositories or confidential project details;
- adding a personal email address;
- maintaining a complete historical technology inventory;
- contribution graphs or large statistic dashboards unless a later decision demonstrates clear professional value;
- automatic modification of manually authored README content.

## 13. Success criteria

The design is successful when:

1. a recruiter can identify the role, core capabilities, selected work, and LinkedIn link quickly;
2. a prospect can understand the type of products and systems Vivien builds and reach the website contact form quickly;
3. project and stack information can be updated from `vid3v.com` without manual README editing;
4. GitHub activity and public-work sections refresh daily without noisy commits;
5. a failed source does not degrade or erase the last valid README;
6. manual editorial content remains under the owner’s control;
7. the workflow is self-contained in `vid3v/vid3v` and does not require a third-party service.
