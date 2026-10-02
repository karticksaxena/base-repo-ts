@AGENTS.md

# Frontend Coding Rules

## Dev tooling setup

For linting, formatting, type-checking and VS Code settings (oxlint, Prettier, tsc), follow **`../SETUP.md`**. Lint rules live in `.oxlintrc.json`, format rules in `.prettierrc`. Never add ESLint — `create-next-app` ships it; this repo replaced it with oxlint.

## Grounded research

Use the **`grounded-research`** skill before deciding on best practices, setup steps, versions, libraries, config options or anything new or fast-moving — never from memory alone. If the skill isn't installed, follow the same method: check the installed packages (`pnpm view`, type declarations, bundled docs), then Context7, DeepWiki and the web; cross-check 2+ sources, verify by running, cite sources, and flag anything unverified.

---

## Subagents

Start subagents on the **Sonnet** model only (`model: "sonnet"` on every Agent call) — never Opus or larger — to keep usage costs down.

---

## Stack

Next.js (App Router, `src/` dir) · React · Turbopack (default for `dev` and `build`) · SWC (built into Next) · Tailwind CSS · **shadcn/ui** · **CopilotKit** (AG-UI + A2UI) · TypeScript (same major as the backend) · `pnpm` · Node LTS (`.nvmrc`)

Always the **latest stable, mutually compatible** versions — never prereleases, never versions hardcoded in docs (see `../SETUP.md` rule 5).

The `@AGENTS.md` block above is maintained by `next dev` — keep it. For Next.js APIs, read `node_modules/next/dist/docs/` before writing code; it may differ from training data.

---

## Frontend Rules

1. **SERVER COMPONENTS BY DEFAULT** — add `'use client'` only for state, effects, event handlers or browser APIs; keep client components small and at the leaves
2. **FETCH ON THE SERVER** — call the backend from Server Components, Server Actions or Route Handlers; never from client code when the server can do it
3. **NO SECRETS IN `NEXT_PUBLIC_*`** — those are shipped to the browser; server-only config uses plain env vars
4. **ZOD AT BOUNDARIES** — validate form input and backend responses with Zod
5. **NO `any`, NO FLOATING PROMISES, EXPLICIT RETURN TYPES** — same oxlint rules as the backend; components return `React.JSX.Element` (or `React.JSX.Element | null`)
6. **`next/link` AND `next/image`** — never raw `<a>` for internal links or raw `<img>` (oxlint `nextjs` plugin enforces)
7. **PROXY, NOT MIDDLEWARE** — current Next.js calls request middleware `proxy.ts`
8. **SHADCN/UI FOR ALL UI** — build UI from shadcn components; never hand-roll a button, dialog, form, etc. that shadcn provides
9. **COPILOTKIT FOR AGENT UI** — chat and agent interactions go through CopilotKit over AG-UI; never a custom chat/streaming client
10. **YAGNI / KISS** — add a folder, library or abstraction only when a feature needs it

---

## Project Structure

Starts as the **`create-next-app` default** (`src/app/`, `public/`). Folders below are created only when needed:

```
src/
  app/                  # routes only: page.tsx, layout.tsx, loading.tsx, error.tsx, route.ts
  components/
    ui/                 # shadcn components (added by `shadcn add`) — owned source, edit freely
  features/
    <name>/             # feature-specific components, hooks, server actions, schemas
  lib/                  # utils.ts (shadcn cn()), API client, shared Zod schemas
public/                 # static assets
```

- Route files stay thin — they compose components from `features/` and `components/`
- No cross-feature imports — share via `components/` or `lib/`
- Shared component → `components/` only when 2+ features use it
- Import with the `@/` alias (`@/lib/api`), not long relative paths

### ❌ DON'T

- `'use client'` on a page or layout just to use one hook — extract a small client component
- Fetch in `useEffect` when a Server Component can fetch
- Put business logic in `app/` route files
- `console.log` in committed code

---

## UI — shadcn/ui

- Setup (once, when the first UI lands): `pnpm dlx shadcn@latest init` → creates `components.json`, `src/lib/utils.ts` (`cn()`), theme variables in `globals.css`
- Add components with `pnpm dlx shadcn@latest add <component>` → `src/components/ui/` — check there before adding or writing one
- After `init` / `add`, run `pnpm run format` (shadcn output doesn't follow `.prettierrc`); `src/components/ui/**` is exempt from the return-type lint rule
- Components are copied source you own — customize them in place; don't wrap them in another layer
- Merge classes with `cn()` — never string-concatenate Tailwind classes
- Theme via the CSS variables in `globals.css` — never hard-code colors in components
- Pick the primitive library once at `init` (Radix: `asChild`, Base UI: `render`) and keep it

---

## Agents — CopilotKit + AG-UI + A2UI

- **CopilotKit** — use the newest API entry point its docs recommend (at time of writing the `/v2` subpath: `@copilotkit/react-core/v2` + `@copilotkit/react-core/v2/styles.css`), never the legacy root import
- Wrap the app (root `layout.tsx`) in `<CopilotKit runtimeUrl="/api/copilotkit" agent="<agent-id>">`
- Runtime in a Route Handler `src/app/api/copilotkit/route.ts`: `CopilotRuntime` with `HttpAgent` from `@ag-ui/client` pointing at the backend's AG-UI endpoint (`copilotRuntimeNextJSAppRouterEndpoint`)
- Hooks from that entry point: `useAgent` (shared agent state), `useFrontendTool` (actions the agent can call in the UI), `useAgentContext` (app context for the agent) — not the legacy `useCoAgent` / `useCopilotAction` / `useCopilotReadable`
- Prebuilt chat UI: `CopilotChat` / `CopilotSidebar` / `CopilotPopup` — style them to match shadcn theme variables
- **AG-UI** is the only transport between frontend and backend agents — the backend streams AG-UI events over SSE (see `../backend/CLAUDE.md`)
- **A2UI** for rich chat blocks (cards, forms, tables generated by the agent): rendered by CopilotKit's built-in A2UI renderer from the agent's declarative messages; register only catalog components backed by shadcn — never render agent-supplied HTML
- Backend URLs for the runtime are server-only env vars — never `NEXT_PUBLIC_*`

---

## Testing (Vitest + React Testing Library)

- Tests sit next to the code: `page.test.tsx` beside `page.tsx`
- Query by role/label (`getByRole`), not by class names or test IDs
- Vitest can't render `async` Server Components — test their logic separately; cover the page with e2e when needed
- Never hit the real backend or an LLM in tests — mock `fetch` / the agent

---

## Performance

- Keep the client bundle small: Server Components first, `next/dynamic` for heavy client-only widgets
- `next/image` for images, `next/font` for fonts
- Cache deliberately (read the caching guide in `node_modules/next/dist/docs/`) — never cache per-user data globally
- Parallel data fetching: `await Promise.all([...])`, never sequential independent `await`s
