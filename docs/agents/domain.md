# Domain Docs

How the engineering skills consume this repository's domain documentation.

## Before exploring, read these

- `CONTEXT.md` at the repository root.
- `CONTEXT-MAP.md` instead, if it exists; read each context relevant to the task.
- ADRs under `docs/adr/` that affect the area being changed.
- In a multi-context repository, also inspect context-specific ADR directories.

If a file or directory does not exist, proceed silently. The domain-modeling workflow creates documentation lazily when terminology or decisions are resolved.

## File structure

This repository uses the single-context layout:

```text
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Cross-repository dependencies

`Night-Club-Mobile` is a separate repository and owns its own domain documentation.

For work that affects frontend behavior or changes the API contract:

1. Read the Mobile repository's agent and domain guidance.
2. Verify the current OpenAPI contract, generated client, and frontend consumer behavior.
3. Keep frontend-specific terminology and ADRs in the Mobile repository instead of duplicating them here.
4. Surface disagreements between confirmed API behavior and Mobile expectations explicitly.

## Use the glossary's vocabulary

When output names a domain concept—such as in an issue title, proposal, hypothesis, or test—use the term defined in `CONTEXT.md`.

If the needed concept is missing, reconsider whether new language is being invented or record the gap for domain modeling.

## Flag ADR conflicts

If proposed work contradicts an existing ADR, surface the conflict explicitly instead of silently overriding it.
