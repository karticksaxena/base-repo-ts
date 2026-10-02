# base-repo-ts

TypeScript starter template: **NestJS + Fastify + SWC** backend (Prisma when a DB is needed) and a **Next.js** frontend (shadcn/ui, CopilotKit + AG-UI/A2UI for agents), with oxlint, Prettier, `tsc` and Vitest wired up. The TypeScript twin of `base-repo-structure` (Python / FastAPI).

Both apps start as their framework's bare defaults (Nest CLI, `create-next-app`) with the tooling wired up — add folders and libraries as features need them.

## Quick start

```bash
nvm install && nvm use      # latest Node LTS (.nvmrc)
cd backend && pnpm install
pnpm run start:dev           # http://localhost:3000

cd ../frontend && pnpm install
pnpm run dev                 # http://localhost:3000 (run backend on another PORT)
```

## Checks

```bash
pnpm run lint          # oxlint (type-aware)
pnpm run typecheck     # tsc --noEmit
pnpm run format:check  # Prettier
pnpm run test          # Vitest (backend: also test:e2e)
pnpm run build         # backend: SWC; frontend: Turbopack
pnpm run audit         # dependency vulnerabilities
```

## Docs

- [`SETUP.md`](SETUP.md) — tooling setup and verification (read this first)
- [`CLAUDE.md`](CLAUDE.md) — shared coding rules for AI agents
- [`backend/CLAUDE.md`](backend/CLAUDE.md) — backend structure and patterns
- [`frontend/CLAUDE.md`](frontend/CLAUDE.md) — Next.js rules
