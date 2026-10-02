# Dev Tooling Setup Guide (TypeScript)

Production-ready linting, formatting, type-checking and tests for a TypeScript monorepo: **NestJS + Fastify + SWC** backend (Prisma when a DB is needed) and a **Next.js (Turbopack)** frontend (shadcn/ui + CopilotKit/AG-UI when needed), both linted with **oxlint** and formatted with **Prettier**. Use this checklist when bootstrapping a new project from this repo.

**Path:** `SETUP.md` (repo root). Point agents here for editor + CLI tooling setup. The Python equivalent lives in `base-repo-structure/SETUP.md`.

---

## For AI agents — read this first

When setting up or verifying dev tooling in a repo built from this template:

1. **Follow the three-layer rule** — rules in config files (`.oxlintrc.json`, `.prettierrc`, `tsconfig.json`); paths only in `.vscode/settings.json`; format/fix-on-save in VS Code **user** settings.
2. **Use pnpm only** — never npm or yarn. Commit `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
3. **Bare defaults only** — backend = Nest CLI default (`app.*` files + `test/app.e2e-spec.ts`), frontend = `create-next-app` default. Add folders and dependencies only when a feature needs them (YAGNI).
4. **Do not switch tools** — oxlint (not ESLint), Vitest (not Jest), SWC builder (not tsc), Prisma (not TypeORM). `create-next-app` ships ESLint — swap it (see [Frontend](#frontend-nextjs--oxlint)).
5. **Latest stable versions, never pinned in docs** — install every package and scaffold with `@latest`; never a prerelease (`rc`, `beta`, `canary`, `next`). If a package's `latest` tag is a prerelease (`pnpm view <pkg> dist-tags`), install its newest stable version instead. All versions must work **together**: if the newest major of one package breaks another (e.g. a new TypeScript major that Nest's SWC `typeCheck` can't load yet), use the newest major that passes [Verify CLI](#verify-cli), in **both** packages, and record why in [Troubleshooting](#troubleshooting).
6. **Never lint `node_modules`** — oxlint skips it only via `.gitignore` or `ignorePatterns`. Both are set; keep them.
7. **Verify with CLI** before claiming done (see [Verify CLI](#verify-cli)), then run the editor smoke test and remove it.
8. **Do not use** deprecated VS Code settings: `typescript.tsdk`, `typescript.enablePromptUseWorkspaceTsdk` (use `js/ts.tsdk.path`, `js/ts.tsdk.promptToUseWorkspaceVersion`).

### What the Python tools map to

| Python (base-repo-structure) | TypeScript (this repo) |
|------------------------------|------------------------|
| `ruff check` | `oxlint` (`pnpm run lint`) — backend **and** frontend |
| `ruff format` | Prettier (`pnpm run format` / `format:check`) |
| ruff `I` (import order, checked in CI) | `prettier-plugin-organize-imports` — sorts on format, `format:check` fails on unsorted imports |
| ruff `S` (bandit security) | oxlint security rules (`no-eval`, `no-implied-eval`, `no-new-func`, `no-script-url`, `no-proto`, `no-caller`, `no-console`, `no-new-buffer`; frontend: `react/no-danger`, `jsx-no-target-blank`, `jsx-no-script-url`) + `pnpm run audit` (dependency CVEs) |
| ruff `ANN` (annotations) | oxlint `explicit-function-return-type` (callbacks exempt) |
| basedpyright (`recommended`) | `tsc --noEmit` (`pnpm run typecheck`) + oxlint type-aware rules (`no-floating-promises`, `no-unsafe-*` — stops `any` leaking) |
| pytest | Vitest — backend: `test`, `test:e2e`; frontend: `test` (React Testing Library + jsdom) |
| FastAPI + uvicorn | NestJS + Fastify |
| dishka | Nest modules (built-in DI) |
| pydantic | Zod |
| loguru | Nest `Logger` / `ConsoleLogger({ json: true })` |
| python-dotenv | Node built-in `process.loadEnvFile()` |
| google-adk (agents) | framework TBD — exposed to the frontend via AG-UI (see `backend/CLAUDE.md`) |
| `.python-version` | `.nvmrc` |

### Workspace diagnostics — yes / no

VS Code has **no global "show workspace-wide problems" setting** — each extension decides. Python parity: BasedPyright ↔ TypeScript project diagnostics (background, all files); Ruff ↔ oxlint (open files only, full scan via task).

| Tool | Background check of **all** files? | Full project scan into the Problems panel |
|------|-------------------------------------|-------------------------------------------|
| **TypeScript** | **YES (experimental)** — `js/ts.tsserver.experimental.enableProjectDiagnostics: true` in user settings; covers each TS project once a file from it has been opened | **Tasks → `backend: typecheck` / `frontend: typecheck`** (`$tsc` matcher) |
| **oxlint** | **NO** — the Oxc extension lints open/edited files only (no workspace mode) | **Tasks → `backend: lint` / `frontend: lint`** (custom `oxlint` matcher, `--format unix`) |

**Empty Problems panel = clean code** when the CLI passes.

---

## Architecture: three layers

| Layer | Location | Purpose | Commit? |
|-------|----------|---------|---------|
| **Rules** | `.oxlintrc.json`, `.prettierrc`, `tsconfig.json`, `nest-cli.json`, `.swcrc` | What to enforce — shared by CLI and editor | Yes |
| **Project wiring** | `.vscode/settings.json` | TypeScript SDK path | Yes |
| **Personal prefs** | VS Code user `settings.json` | Format/fix-on-save, extension toggles | No (per machine) |

**Golden rule:** lint and format **rules** live in config files, never in VS Code settings.

---

## Required extensions

| Extension | ID | Role |
|-----------|-----|------|
| Oxc | `oxc.oxc-vscode` | oxlint diagnostics + fix-on-save (LSP) |
| Prettier | `esbenp.prettier-vscode` | Formatting (uses the project's `prettier` + `.prettierrc`) |

Install: `code --install-extension oxc.oxc-vscode`, then **Cmd+Shift+P → Developer: Reload Window**.

---

## Backend (NestJS + Fastify + SWC)

### 1. Scaffold

```bash
pnpm dlx @nestjs/cli@latest new backend --package-manager pnpm --skip-git --strict
cd backend
```

Current Nest generates an ESM project (`"type": "module"`, `.js` import suffixes) with oxlint, Vitest and Prettier. If a future Nest scaffold ships different tools, swap them back to the ones in this guide.

### 2. Swap Express for Fastify, add SWC

```bash
pnpm remove @nestjs/platform-express @types/express @nestjs/mau supertest @types/supertest
pnpm add @nestjs/platform-fastify
pnpm add -D @swc/cli @swc/core unplugin-swc
pnpm approve-builds @swc/core esbuild
```

Current pnpm blocks dependency install scripts: `pnpm add -D @swc/cli @swc/core unplugin-swc` ends with `ERR_PNPM_IGNORED_BUILDS` — **expected**; the `approve-builds` line fixes it. pnpm fails every install until each script is approved or denied. The decisions are saved to `pnpm-workspace.yaml` (`allowBuilds`) — commit it:

- `@swc/core: true` — verifies the native SWC binary
- `esbuild: true` — used by Vitest/Vite
- Any other package pnpm lists: deny with `'!<pkg>'` unless it needs a native binary

Also remove the `deploy` script (it needs `@nestjs/mau`), and pin Node to the latest LTS:

```bash
echo 'lts/*' > .nvmrc
```

### 3. `src/main.ts` — Fastify

```ts
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0'); // 0.0.0.0 for Docker / Cloud Run
}
await bootstrap();
```

### 4. SWC builder — `nest-cli.json` + `.swcrc`

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "builder": "swc",
    "typeCheck": true,
    "deleteOutDir": true
  }
}
```

`typeCheck: true` runs `tsc` alongside SWC so builds still fail on type errors.

`.swcrc`:

```json
{
  "$schema": "https://swc.rs/schema.json",
  "sourceMaps": true,
  "jsc": {
    "parser": { "syntax": "typescript", "decorators": true, "dynamicImport": true },
    "baseUrl": "./"
  },
  "minify": false
}
```

### 5. Vitest with SWC — `vitest.config.ts` / `vitest.config.e2e.ts`

SWC must also compile tests, otherwise decorator metadata is missing and Nest DI breaks.

```ts
import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } }), tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
  },
});
```

`vitest.config.e2e.ts`: identical, except `include: ['**/*.e2e-spec.ts']`.

Replace the generated `test/app.e2e-spec.ts` (it imports the removed `supertest`) with this Fastify `inject` version:

```ts
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';

describe('App (e2e)', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.payload).toBe('Hello World!');
  });
});
```

### 6. `backend/.oxlintrc.json`

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["typescript", "unicorn", "oxc", "import", "node", "promise", "vitest"],
  "categories": { "correctness": "error", "suspicious": "warn" },
  "options": { "typeAware": true },
  "env": { "node": true },
  "rules": {
    "typescript/no-explicit-any": "error",
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "typescript/await-thenable": "error",
    "typescript/no-extraneous-class": ["warn", { "allowWithDecorator": true }],
    "typescript/no-unsafe-argument": "error",
    "typescript/no-unsafe-assignment": "error",
    "typescript/no-unsafe-call": "error",
    "typescript/no-unsafe-member-access": "error",
    "typescript/no-unsafe-return": "error",
    "typescript/explicit-function-return-type": [
      "error",
      { "allowExpressions": true, "allowTypedFunctionExpressions": true }
    ],
    "eslint/no-eval": "error",
    "eslint/no-implied-eval": "error",
    "typescript/no-implied-eval": "error",
    "eslint/no-new-func": "error",
    "eslint/no-script-url": "error",
    "eslint/no-proto": "error",
    "eslint/no-caller": "error",
    "unicorn/no-new-buffer": "error",
    "eslint/no-console": "error"
  },
  "ignorePatterns": ["node_modules/", "dist/", "coverage/"]
}
```

- `plugins` **replaces** the defaults (`typescript`, `unicorn`, `oxc`) — always list them.
- `options.typeAware` needs `oxlint-tsgolint` (Nest installs it). Catches floating promises, misused promises etc. — the closest thing to basedpyright strictness.
- Nest tightened: `no-explicit-any` is `off` by default — this template makes it an error.
- `no-extraneous-class` + `allowWithDecorator` — Nest modules are empty decorated classes.
- `no-unsafe-*` (type-aware) — blocks `any` from flowing into typed code (basedpyright-level strictness).
- `explicit-function-return-type` — ruff `ANN` equivalent; `allowExpressions` exempts callbacks (`describe(() => …)`).
- Security block (`no-eval` … `no-console`) — ruff `S` / bandit equivalent; logging goes through Nest `Logger`.

### 7. `.prettierrc` (backend and frontend)

```bash
pnpm add -D prettier-plugin-organize-imports
```

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-organize-imports"]
}
```

The plugin runs TypeScript's own "organize imports" (the same as VS Code's `source.organizeImports`) during formatting, so imports are sorted on save **and** `format:check` fails in CI on unsorted or unused imports — the ruff `I` equivalent.

`printWidth: 100` matches Ruff's `line-length` in the Python repo. Backend `.prettierignore`:

```bash
printf 'pnpm-lock.yaml\npnpm-workspace.yaml\ndist\ncoverage\n' > .prettierignore
```

### 8. Scripts (`backend/package.json`)

```json
{
  "lint": "oxlint --deny-warnings",
  "lint:fix": "oxlint --fix",
  "typecheck": "tsc --noEmit",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "test": "vitest run",
  "test:e2e": "vitest run --config ./vitest.config.e2e.ts",
  "audit": "pnpm audit --audit-level=high"
}
```

`lint` only checks (CI-safe); `lint:fix` edits files. `--deny-warnings` makes warnings fail CI, like basedpyright's `failOnWarnings`.

Finally, format once — the Nest scaffold doesn't follow `.prettierrc` / sorted imports, so `format:check` fails until you do:

```bash
pnpm run format
```

### 8b. Adding a feature (generator)

```bash
pnpm nest g resource <name> --type rest --crud false
pnpm run format
```

Verified: this passes `lint`, `typecheck`, `format:check`, `test`, `build`. Never use CRUD mode (`--crud` / interactive "yes") — it generates empty DTO/entity classes and unused-parameter stubs that fail oxlint, and adds `@nestjs/mapped-types` pinned to `*`. Validation uses Zod schemas instead of DTO classes (`backend/CLAUDE.md`).

### 9. Agents — AG-UI (when needed)

The agent framework is not chosen yet; nothing is installed. When the first agent lands, its endpoint must speak **AG-UI** over SSE (`@ag-ui/core` + `@ag-ui/encoder`) and send rich chat blocks as **A2UI** messages — rules in `backend/CLAUDE.md`.

### 10. Prisma — add when the first feature needs a database

Not installed by default (YAGNI). Use **the newest stable Prisma ORM, not TypeORM**. Check `pnpm view prisma dist-tags` first — if `latest` is a release candidate, install the newest stable version of `prisma`, `@prisma/client` and `@prisma/adapter-pg` (all three on the **same** version). The steps below follow the stable Prisma ORM's driver-adapter setup:

```bash
cd backend
pnpm add -D prisma@<newest-stable>
pnpm add @prisma/client@<same> @prisma/adapter-pg@<same> pg
pnpm add -D @types/pg
pnpm approve-builds prisma @prisma/engines   # engines postinstall downloads the migration engine
pnpm prisma init --datasource-provider postgresql --output ../src/generated/prisma
```

`prisma init` creates:

- `prisma/schema.prisma` — `generator client { provider = "prisma-client"; output = "../src/generated/prisma" }` (no URL in the schema)
- a Prisma config file — `prisma.config.ts`, or a versioned name (e.g. `prisma7.config.ts`) so it can coexist with a newer Prisma; use whichever `init` creates. It holds the DB URL
- `.env` with `DATABASE_URL`, and `backend/.gitignore` ignoring `/src/generated/prisma`
- `.agents/skills/` + `.claude/skills/` — Prisma's own agent skills for Claude Code. Keep them.

If the generated config has `import "dotenv/config"`, replace it with Node's built-in loader (no `dotenv` dependency):

```ts
import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

if (existsSync('.env')) process.loadEnvFile();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] },
});
```

Then:

- Add `"src/generated/"` to `ignorePatterns` in `.oxlintrc.json`
- Add `src/generated`, `prisma/migrations`, `.agents`, `.claude` to `.prettierignore`
- `PrismaService` + `PrismaModule` go in `src/prisma/` (code in `backend/CLAUDE.md`)
- `pnpm prisma generate` after every schema change; `pnpm prisma migrate dev --name <change>` locally; `pnpm prisma migrate deploy` in CI/CD
- VS Code extension `Prisma.prisma` for `.prisma` files

Prisma lists its supported Node versions in its docs and warns during install on newer ones — use the latest Node **LTS** (`.nvmrc` is `lts/*`).

---

## Frontend (Next.js + oxlint)

`create-next-app` ships **ESLint** — swap it for oxlint so both packages share one linter:

```bash
pnpm dlx create-next-app@latest frontend --ts --app --src-dir --tailwind --use-pnpm --disable-git --import-alias '@/*' --yes
cd frontend
rm eslint.config.mjs README.md
pnpm remove eslint eslint-config-next
pnpm add -D oxlint oxlint-tsgolint prettier
# Same TypeScript and @types/node majors as the backend (create-next-app ships older ones; a bare `pnpm add typescript` keeps them)
pnpm add -D "typescript@^$(node -p "require('../backend/node_modules/typescript/package.json').version.split('.')[0]")"
pnpm add -D "@types/node@^$(node -p "require('../backend/node_modules/@types/node/package.json').version.split('.')[0]")"
echo 'lts/*' > .nvmrc
```

- Turbopack is the default bundler for `next dev` and `next build`; SWC is built in. No flags needed.
- React Compiler stays off (`--react-compiler` adds a Babel pass and slows builds) — enable it only if profiling shows a need.
- Keep `AGENTS.md` and the generated `CLAUDE.md` (`@AGENTS.md`) — `next dev` re-writes that block. Append project rules below the import (see `frontend/CLAUDE.md`).
- Check `next.config.ts` has no `reactCompiler: true` (`--yes` reuses saved create-next-app preferences).
- In `frontend/pnpm-workspace.yaml`, delete `allowBuilds` entries for packages you removed (e.g. `unrs-resolver`, which came from `eslint-config-next`); keep `sharp: false`.

`frontend/.oxlintrc.json` (full file — backend rules minus `no-new-buffer`, plus React/Next rules):

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["typescript", "unicorn", "oxc", "import", "react", "jsx-a11y", "nextjs", "vitest"],
  "categories": {
    "correctness": "error",
    "suspicious": "warn"
  },
  "options": {
    "typeAware": true
  },
  "env": {
    "browser": true
  },
  "rules": {
    "typescript/no-explicit-any": "error",
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "typescript/await-thenable": "error",
    "typescript/no-extraneous-class": [
      "warn",
      {
        "allowWithDecorator": true
      }
    ],
    "typescript/no-unsafe-argument": "error",
    "typescript/no-unsafe-assignment": "error",
    "typescript/no-unsafe-call": "error",
    "typescript/no-unsafe-member-access": "error",
    "typescript/no-unsafe-return": "error",
    "typescript/explicit-function-return-type": [
      "error",
      {
        "allowExpressions": true,
        "allowTypedFunctionExpressions": true
      }
    ],
    "eslint/no-eval": "error",
    "eslint/no-implied-eval": "error",
    "typescript/no-implied-eval": "error",
    "eslint/no-new-func": "error",
    "eslint/no-script-url": "error",
    "eslint/no-proto": "error",
    "eslint/no-caller": "error",
    "eslint/no-console": "error",
    "react/react-in-jsx-scope": "off",
    "import/no-unassigned-import": [
      "warn",
      {
        "allow": ["**/*.css"]
      }
    ],
    "react/no-danger": "error",
    "react/jsx-no-script-url": "error",
    "react/jsx-no-target-blank": "error"
  },
  "ignorePatterns": ["node_modules/", ".next/", "dist/", "coverage/", "next-env.d.ts"],
  "overrides": [
    {
      "files": ["src/components/ui/**"],
      "rules": {
        "typescript/explicit-function-return-type": "off"
      }
    }
  ]
}
```

- `nextjs` plugin = the `eslint-config-next` rules (e.g. `no-html-link-for-pages`, `no-img-element`).
- `react-in-jsx-scope` is obsolete with the automatic JSX runtime.
- `overrides` exempts `src/components/ui/**` (shadcn's generated source) from `explicit-function-return-type` — verified: `shadcn add` components have no return types, and `--overwrite` would undo hand edits. Every other rule still applies there.
- `no-unassigned-import` would flag `import './globals.css'` — CSS side-effect imports are allowed.
- `explicit-function-return-type` applies to components: add `: React.JSX.Element` to `create-next-app`'s `layout.tsx` and `page.tsx`.

Tests — Vitest + React Testing Library (from Next's bundled guide `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`):

```bash
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths prettier-plugin-organize-imports
```

`frontend/vitest.config.mts`:

```ts
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: { environment: 'jsdom' },
});
```

Tests sit next to the code. `src/app/page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import Page from './page';

test('renders the main heading', () => {
  render(<Page />);
  expect(screen.getByRole('heading', { level: 1 })).toBeDefined();
});
```

Vitest can't render `async` Server Components — cover those with e2e tests when needed.

Scripts (`frontend/package.json`):

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "oxlint --deny-warnings",
  "lint:fix": "oxlint --fix",
  "typecheck": "next typegen && tsc --noEmit",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "test": "vitest run",
  "test:watch": "vitest",
  "audit": "pnpm audit --audit-level=high"
}
```

`next typegen` generates Next's route types (`LayoutProps`, `PageProps`) — without it, `tsc` fails on a clean checkout with `Cannot find name 'LayoutProps'`.

Same `.prettierrc` as the backend (step 7). Frontend `.prettierignore`, then format once (create-next-app uses double quotes):

```bash
printf 'pnpm-lock.yaml\npnpm-workspace.yaml\n.next\nnext-env.d.ts\ndist\ncoverage\n' > .prettierignore
pnpm run format
```

---

## Root `.gitignore`

One file at the repo root covers both packages (`frontend/.gitignore` from create-next-app can stay):

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Build output
dist/
build/
out/
.next/
next-env.d.ts
*.tsbuildinfo

# Tests
coverage/
.vitest/

# Generated code (Prisma client, when added)
**/src/generated/

# Env — commit only .env.example
.env
.env.*
!.env.example

# Logs
logs/
*.log
npm-debug.log*
pnpm-debug.log*
yarn-debug.log*
yarn-error.log*

# Caches
.cache/
.turbo/
.vercel/
.eslintcache

# Editor / OS
.DS_Store
Thumbs.db
.idea/
*.swp
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
!.vscode/tasks.json
```

Without it oxlint lints `node_modules` and appears to hang.

---

## Workspace settings (commit `.vscode/`)

### `.vscode/extensions.json`

```json
{ "recommendations": ["oxc.oxc-vscode", "esbenp.prettier-vscode"] }
```

### `.vscode/settings.json`

```json
{
  "npm.autoDetect": "off",
  "js/ts.tsdk.path": "backend/node_modules/typescript/lib",
  "js/ts.tsdk.promptToUseWorkspaceVersion": true
}
```

The Oxc extension finds nested `backend/.oxlintrc.json` and `frontend/.oxlintrc.json` automatically (it searches `**/.oxlintrc.json`) and uses the `oxlint` binary from each package's `node_modules`.

### `.vscode/tasks.json` — manual only

| Task | Command | Problem matcher |
|------|---------|-----------------|
| `backend: dev` | `pnpm run start:dev` | — |
| `backend: lint` | `pnpm run --silent lint --format unix` | custom `oxlint` |
| `backend: typecheck` | `pnpm run typecheck` | `$tsc` (fileLocation `backend/`) |
| `backend: format` | `pnpm run format:check` | — |
| `backend: test` | `pnpm run test && pnpm run test:e2e` | — |
| `frontend: dev` | `pnpm run dev` | — |
| `frontend: test` | `pnpm run test` | — |
| `frontend: lint` / `typecheck` / `format` | same, in `frontend/` | same |

Running a lint or typecheck task puts **every file's** problems in the Problems panel — the TypeScript equivalent of Ruff's "Run Task" full scan. The custom oxlint matcher (oxlint ships none):

```json
{
  "owner": "oxlint",
  "source": "oxlint",
  "fileLocation": ["relative", "${workspaceFolder}/backend"],
  "pattern": {
    "regexp": "^(.+?):(\\d+):(\\d+): (.*) \\[(Error|Warning)/(.+)\\]$",
    "file": 1, "line": 2, "column": 3, "message": 4, "severity": 5, "code": 6
  }
}
```

`$tsc` reports paths relative to the task's `cwd`, so override `fileLocation` per package: `{ "base": "$tsc", "fileLocation": ["relative", "${workspaceFolder}/backend"] }`.

Never add `"runOn": "folderOpen"` unless the user asks.

---

## User settings (once per machine)

`~/Library/Application Support/Code/User/settings.json` (Cursor: `.../Cursor/User/settings.json`):

```json
{
  "files.autoSave": "onFocusChange",
  "[typescript]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.codeActionsOnSave": {
      "source.fixAll.oxc": "always",
      "source.fixAll.eslint": "always",
      "source.organizeImports": "always"
    }
  },
  "oxc.requireConfig": true,
  "js/ts.tsserver.experimental.enableProjectDiagnostics": true
}
```

Repeat the `[typescript]` block for `[typescriptreact]`, `[javascript]`, `[javascriptreact]`.

- `source.fixAll.oxc` + `source.fixAll.eslint` side by side — each only acts in projects that use it.
- `oxc.requireConfig: true` — the Oxc extension runs only where a `.oxlintrc.json` exists, so ESLint projects don't get duplicate warnings.

---

## Verify CLI

```bash
cd backend
pnpm run lint && pnpm run typecheck && pnpm run format:check
pnpm run test && pnpm run test:e2e && pnpm run build && pnpm run audit

cd ../frontend
pnpm run lint && pnpm run typecheck && pnpm run format:check
pnpm run test && pnpm run build && pnpm run audit
```

All must pass. Then boot once: `cd backend && pnpm run start` → `curl localhost:3000/` returns `Hello World!`; `cd frontend && pnpm run start` → `localhost:3000` returns 200 (run one at a time or set `PORT`).

## Verify editor (smoke test — delete after)

Create `backend/src/smoke.ts`:

```ts
// SMOKE TEST: delete after verifying
async function save(): Promise<void> {}
export function run(value: any): void {
  save();
}
```

Expect in Problems (source **oxc**): `no-floating-promises`, `no-explicit-any`, `no-unused-vars`. Save the file → Prettier formats it. Then delete it.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `pnpm run lint` hangs for minutes | oxlint is linting `node_modules` — missing `.gitignore` / `ignorePatterns` |
| `pnpm install` fails with `ERR_PNPM_IGNORED_BUILDS` | Run `pnpm approve-builds <pkg>` / `'!<pkg>'`; commit `pnpm-workspace.yaml` |
| Nest DI is `undefined` in tests | Vitest config missing `unplugin-swc` plugin |
| Nest build/`typeCheck` fails right after a TypeScript upgrade | The new TypeScript major isn't supported by Nest's SWC `typeCheck` yet — use the newest major that passes, in both packages |
| `react-in-jsx-scope` warnings | Turn the rule off (automatic JSX runtime) |
| `Unexpected empty class` on modules | `no-extraneous-class` needs `allowWithDecorator: true` |
| `format:check` fails right after scaffolding | Run `pnpm run format` once (Nest/Next scaffolds use double quotes and unsorted imports) |
| `test:e2e` / typecheck fails: cannot find `supertest` | Replace `test/app.e2e-spec.ts` with the Fastify `inject` version (step 5) |
| Frontend on an older TypeScript than the backend | Use the step's `typescript@^<backend major>` command — bare `pnpm add typescript` keeps create-next-app's version |
| Lint/format fails right after `shadcn add` | Run `pnpm run format`; return types in `src/components/ui/**` are exempt via `overrides` |
| `format:check` fails after editing imports | Run `pnpm run format` — the organize-imports plugin sorts them (ruff `I` equivalent) |
| `explicit-function-return-type` on Next's `layout.tsx` / `page.tsx` | Add `: React.JSX.Element` |
| `no-console` error | Backend: use Nest `Logger`; frontend: remove before committing |
| Lint/format fails right after `nest g resource` | Use `--crud false`, then `pnpm run format` (generator ignores `.prettierrc`) |
| Vitest fails on an empty `*.spec.ts` | Vitest rejects test files with no tests — write a test or delete the file |
| Oxc extension silent | `.oxlintrc.json` missing, or extension not installed; Output panel → **Oxc** |
| Duplicate lint warnings in ESLint projects | Set `oxc.requireConfig: true` in user settings |
| `Cannot find name 'LayoutProps'` (frontend) | `typecheck` must run `next typegen` before `tsc` |
| `no-unassigned-import` on `globals.css` | Allow `**/*.css` for that rule |
| `pnpm add prisma` installed a release candidate | `latest` points to a prerelease — install the newest stable version (`pnpm view prisma versions`) for `prisma`, `@prisma/client`, `@prisma/adapter-pg` |
| Prisma config fails: cannot find `dotenv` | Replace `import "dotenv/config"` with `process.loadEnvFile()` (see step 10) |
| Prettier flags `.agents/skills/**` | `prisma init` added Prisma skills — add `.agents`, `.claude` to `.prettierignore` |
| `AGENTS.md` keeps reappearing in the diff | `next dev` maintains it — commit it |

---

## New project checklist

- [ ] **1.** Copy this repo (or follow Backend steps 1–9 + Frontend; step 10 only when a DB is needed)
- [ ] **2.** `pnpm install` in `backend/` and `frontend/`
- [ ] **3.** `nvm install && nvm use` (reads `.nvmrc` = `lts/*`, the latest Node LTS)
- [ ] **4.** Install VS Code extensions → Reload Window
- [ ] **5.** Confirm user settings block (once per machine)
- [ ] **6.** Create `backend/.env` / `frontend/.env.local` for secrets (never commit)
- [ ] **7.** Run [Verify CLI](#verify-cli) — all green
- [ ] **8.** Run the editor smoke test → delete it
- [ ] **9.** Commit config files — never rely on personal settings alone

---

## Reference: this repo's layout

```
<project>/
├── SETUP.md                     ← this file
├── CLAUDE.md                    ← shared coding rules for AI agents
├── .gitignore
├── .vscode/                     ← extensions, settings (tsdk path), tasks
├── backend/
│   ├── CLAUDE.md                ← backend rules (Nest structure, DI, validation, logging)
│   ├── .oxlintrc.json           ← lint rules
│   ├── .prettierrc              ← format rules
│   ├── .swcrc, nest-cli.json    ← SWC builder
│   ├── vitest.config*.ts        ← unit + e2e tests (SWC)
│   ├── pnpm-workspace.yaml      ← allowBuilds decisions
│   ├── .nvmrc
│   ├── src/                     ← Nest default: main.ts, app.module/controller/service (+ spec)
│   └── test/                    ← app.e2e-spec.ts
└── frontend/                    ← Next.js (App Router, src/, Tailwind, Turbopack)
    ├── CLAUDE.md, AGENTS.md     ← frontend rules + Next's agent rules
    ├── .oxlintrc.json, .prettierrc, tsconfig.json, next.config.ts, .nvmrc
    └── src/app/                 ← create-next-app default (layout, page, globals.css)
```

---

## Agent completion criteria

Before marking tooling setup done, confirm:

1. Backend: `lint`, `typecheck`, `format:check`, `test`, `test:e2e`, `build`, `audit` all pass
2. Frontend: `lint`, `typecheck`, `format:check`, `test`, `build`, `audit` all pass on a clean checkout (`rm -rf .next` first)
3. Server boots and `GET /` returns `Hello World!`
4. Editor smoke test shows oxc diagnostics (then removed)
5. Same TypeScript major in both packages; no prerelease versions; no ESLint/Jest/supertest leftovers (`eslint.config.mjs`, `eslint`, `eslint-config-next`)
6. `pnpm-workspace.yaml` committed with no entries for removed packages; `pnpm install` runs clean from scratch
7. Same `@types/node` major in both packages; `.nvmrc` = `lts/*` in both
