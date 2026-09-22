# Issue tracker: GitHub

Issues and specs for this repo live in GitHub Issues under `Zeta7/Night-Club-Api`. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue:** `gh issue create --title "..." --body "..."`. Use a PowerShell here-string or `--body-file` for multi-line bodies.
- **Read an issue:** `gh issue view <number> --comments`, filtering comments with `jq` and also fetching labels.
- **List issues:** `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue:** `gh issue comment <number> --body "..."`
- **Apply or remove labels:** `gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- **Close:** `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone. When operating on the sibling Mobile repo without changing directories, pass `--repo Zeta7/Night-Club-Mobile` explicitly.

## Cross-repository work

`Zeta7/Night-Club-Api` and `Zeta7/Night-Club-Mobile` keep separate issues, instructions, commits, and verification results.

- An issue covers implementation in its own repository only.
- When an initiative changes both repositories, create one implementation issue in each repository.
- Keep one canonical specification issue in the repository where the initiative was first captured. The counterpart issue links to that specification instead of copying it.
- Add `Related issue: owner/repo#number` and `Coordination issue: owner/repo#number` near the top of each cross-repository issue body.
- Before modifying the sibling repository, switch to its root and read its `AGENTS.md` or `CLAUDE.md` and `docs/agents/` guidance.
- Report API and Mobile validation separately. Closing an issue in one repository does not imply completion in the other.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR:** `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage:** `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`, then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE`; drop `OWNER`, `MEMBER`, and `COLLABORATOR`.
- **Comment, label, or close:** `gh pr comment`, `gh pr edit --add-label` or `--remove-label`, and `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either. Resolve it with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

For cross-repository work, create a counterpart issue only when the sibling repository requires an actual change.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The map is a single issue with child issues as tickets.

- **Map:** a single issue labelled `wayfinder:map`, holding the Notes, Decisions-so-far, and Fog body. Create it with `gh issue create --label wayfinder:map`.
- **Child ticket:** an issue linked to the map as a GitHub sub-issue using `gh api` on the sub-issues endpoint. Where sub-issues are not enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels use `wayfinder:<type>` with `research`, `prototype`, `grilling`, or `task`. Once claimed, assign the ticket to the driving developer.
- **Blocking:** use GitHub's native issue dependencies. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric database ID from `gh api repos/<owner>/<repo>/issues/<n> --jq .id`, not the issue number or `node_id`. Where dependencies are unavailable, use a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query:** list the map's open children, drop any with an open blocker or assignee, and take the first in map order.
- **Claim:** `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve:** `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer—gist plus link—to the map's Decisions-so-far.
