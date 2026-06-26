# Contributing to OpenClip

Thanks for helping build a free, open-source alternative to OpusClip. This doc
describes how the project is versioned and how changes flow to production.

## Branching model

| Branch        | Purpose                                                        |
| ------------- | -------------------------------------------------------------- |
| `main`        | Production. Vercel deploys this. **Protected** — no direct pushes. |
| `dev`         | Integration/staging. Features accumulate here and are tested via Vercel preview deployments. |
| `feature/*`   | One branch per change, cut from `dev`.                         |
| `fix/*`       | Bug fixes, cut from `dev`.                                     |

### The flow

1. Branch off `dev`: `git switch dev && git switch -c feature/my-thing`.
2. Make your change, commit using **Conventional Commits** (see below).
3. Open a PR into `dev`. CI (type-check + build) must pass. Vercel posts a
   preview URL on the PR — verify your change there.
4. Merge into `dev`. Features keep accumulating; test them on `dev`'s preview.
5. When there's a meaningful batch, open a PR from `dev` → `main`. Merging it
   triggers a production deploy and the release automation.

Nothing reaches production except through a `dev` → `main` PR, so `main` always
reflects a deliberate, tested release.

## Conventional Commits

Commit messages drive the changelog and the version bump. Use:

- `feat: …` — a new feature (bumps the **minor** version, e.g. 1.0 → 1.1).
- `fix: …` — a bug fix (bumps the **patch** version, e.g. 1.1.0 → 1.1.1).
- `feat!: …` or a `BREAKING CHANGE:` footer — a breaking change (bumps **major**).
- `chore:`, `docs:`, `refactor:`, `test:`, `ci:`, `style:` — no release on their own.

Examples:

```
feat(editor): drag clip edges to trim
fix(render): correct SPS VUI timing so TikTok keeps source framerate
docs: document the free-chatbot clip flow
```

## Releases (automated)

Releases are handled by [release-please](https://github.com/googleapis/release-please):

1. As `feat`/`fix` commits land on `main`, release-please keeps an open
   **"chore: release X.Y.Z"** PR that bumps `package.json` and updates
   `CHANGELOG.md`.
2. When you're ready to cut a release, merge that PR. release-please then
   creates the `vX.Y.Z` git tag and a GitHub Release with the notes.

You never edit the version or changelog by hand.

## Local development

```bash
npm ci            # install (root workspace)
npm run dev       # start the frontend dev server
npm run build     # type-check (tsc -b) + production build (vite) — same as CI
```

The app is browser-only: all video processing happens locally via ffmpeg.wasm
and WebCodecs. There is no backend to run.
