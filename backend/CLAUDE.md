# Backend Coding Rules

## Dev tooling setup

For linting, formatting, type-checking, tests and VS Code settings (oxlint, Prettier, tsc, Vitest, SWC), follow **`../SETUP.md`**. Lint rules live in `.oxlintrc.json`, format rules in `.prettierrc` — never in `.vscode/settings.json`.

## Grounded research

Use the **`grounded-research`** skill before deciding on best practices, setup steps, versions, libraries, config options or anything new or fast-moving — never from memory alone. If the skill isn't installed, follow the same method: check the installed packages (`pnpm view`, type declarations, bundled docs), then Context7, DeepWiki and the web; cross-check 2+ sources, verify by running, cite sources, and flag anything unverified.

---

## Subagents

Start subagents on the **Sonnet** model only (`model: "sonnet"` on every Agent call) — never Opus or larger — to keep usage costs down.

---

## Stack

Google Cloud Run · NestJS · **Fastify** (`@nestjs/platform-fastify`) · **SWC** builder · Prisma + PostgreSQL (when needed) · Zod · Vitest · `pnpm` · Node LTS (`.nvmrc`) · Agents: framework TBD, exposed via **AG-UI** + **A2UI**

Always the **latest stable, mutually compatible** versions — never prereleases, never versions hardcoded in docs (see `../SETUP.md` rule 5).

---

## Backend Rules

1. **REPOSITORY PATTERN** — ALL DB/Redis ops through repositories
2. **ESM IMPORTS** — relative imports must end in `.js` (`import { X } from './x.service.js'`); the project is `"type": "module"`
3. **ZOD AT BOUNDARIES** — validate every request body/query/param with a Zod schema: `@Body({ schema: createItemSchema })`; types come from `z.infer`
4. **LOG CRITICAL OPS** — external calls, exceptions, state changes; use Nest `Logger`, never `console.log`
5. **NO `any`** — use `unknown` and narrow; `typescript/no-explicit-any` is an error
6. **NO FLOATING PROMISES** — every promise is awaited, returned, or explicitly `void`-ed
7. **NO `api/` OR VERSION FOLDERS** — feature modules are imported directly in `app.module.ts`; API versions live in controller decorators (see API Versioning), never in folders
8. **EXPLICIT RETURN TYPES** — every function and method declares its return type (oxlint `explicit-function-return-type` enforces; callbacks exempt); controller responses match a Zod response schema (Nest twin of Python's "dual Pydantic")
9. **FIELD DESCRIPTIONS** — every Zod schema field has `.describe('...')` — readability, and it carries into generated API docs and agent tool schemas
10. **YAGNI / KISS** — add a folder, dependency or abstraction only when a feature needs it

---

## Project Structure

Starts as the **Nest CLI default** — nothing extra. Folders are added as features land.

```
src/
  main.ts                  # bootstrap: FastifyAdapter, listen on 0.0.0.0
  app.module.ts            # root module — imports feature modules
  app.controller.ts        # default route (replace when the first feature lands)
  app.service.ts
  app.controller.spec.ts   # unit tests sit next to the code
test/
  app.e2e-spec.ts          # e2e tests (Fastify inject)
```

### Adding a feature

```bash
pnpm nest g resource <name> --type rest --crud false   # module + controller + service + specs
pnpm run format                                         # generator output ignores .prettierrc
```

- Always `--crud false`: CRUD mode adds empty DTO/entity classes, unused-parameter stubs (fail oxlint) and `@nestjs/mapped-types` with a `*` version
- Add methods, Zod schemas and the repository by hand as the feature needs them

```
src/<name>/
  <name>.module.ts         # DI wiring for the feature
  <name>.controller.ts     # HTTP layer only
  <name>.service.ts        # business logic
  <name>.repository.ts     # data access (add when it needs a DB)
  <name>.schemas.ts        # Zod request/response schemas (replace the generated DTO classes)
```

Shared folders, created only when 2+ features need them:

- `src/common/` — exceptions, shared helpers
- `src/prisma/` — `PrismaModule` + `PrismaService` (when Prisma is added)

### Feature Rules

- New domain = new feature folder — never grow an existing feature into another domain
- Use another feature only through its module's exported providers — never import its internal files
- Controller → service → repository, all within the same feature folder
- Feature modules imported in `app.module.ts`, never auto-discovered
- **No top-level `schemas/` folder** — schemas live with the feature they serve

### ❌ DON'T

- Business logic in controllers
- DB queries in services
- Speculative folders, base classes or "for later" scaffolding
- `console.log` anywhere in `src/`

---

## Agents — AG-UI + A2UI

The agent framework is **not chosen yet** (Google ADK TS, Mastra, …). Don't add one until a feature needs it. The contract with the frontend is fixed regardless:

- **AG-UI protocol** — every agent endpoint takes `POST` with a `RunAgentInput` body and streams AG-UI events over SSE (`text/event-stream`): `RUN_STARTED` → `TEXT_MESSAGE_*` / `TOOL_CALL_*` / `STATE_SNAPSHOT` / `STATE_DELTA` → `RUN_FINISHED` (or `RUN_ERROR`)
- Use `@ag-ui/core` types and `@ag-ui/encoder` (`EventEncoder`) — never a custom streaming format
- There is no ready-made AG-UI server for TypeScript ADK (the ADK bridge `ag_ui_adk` is Python) → write one adapter per agent framework that maps its events to AG-UI
- With Fastify, stream to the raw response (`reply.raw`); always end with `RUN_FINISHED` or `RUN_ERROR` and close the stream
- **A2UI** for rich chat blocks: agents send declarative A2UI messages (`createSurface`, `updateComponents`, `updateDataModel`) inside AG-UI, using only components from the agreed catalog — never raw HTML/JS
- The frontend consumes this with CopilotKit (see `../frontend/CLAUDE.md`)

---

## Dependency Injection (Nest modules)

```ts
@Module({
  controllers: [Feature1Controller],
  providers: [Feature1Service, Feature1Repository],
})
export class Feature1Module {}

@Injectable()
export class Feature1Service {
  constructor(private readonly repository: Feature1Repository) {}
}
```

- Constructor injection only; no manual `new` for providers
- SWC emits decorator metadata — tests must use `unplugin-swc` (already in `vitest.config*.ts`) or DI breaks

---

## Validation

```ts
// feature1.schemas.ts
export const createItemSchema = z.object({ name: z.string().trim().min(1).max(100) }).strict();
export type CreateItemDto = z.infer<typeof createItemSchema>;

// feature1.controller.ts
@Post()
create(@Body({ schema: createItemSchema }) dto: CreateItemDto): Promise<Item> { ... }
```

Register Nest's built-in `StandardSchemaValidationPipe` once, as an `APP_PIPE` provider in `app.module.ts`, so e2e tests get it too.

---

## Logging

```ts
private readonly logger = new Logger(Feature1Service.name);

this.logger.log(`Created item ${item.id}`);
this.logger.error('Sync failed', error instanceof Error ? error.stack : undefined);
```

- Prod: `new ConsoleLogger({ json: true })` passed to `NestFactory.create` in `main.ts`
- **Log**: external APIs, DB writes, exceptions, state changes, slow ops (>1s)
- **Never log**: loops, reads, helpers, secrets, PII

---

## Exceptions

```ts
// src/common/exceptions.ts (create when the first feature needs it)
export class AppError extends HttpException {}
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, HttpStatus.NOT_FOUND);
  }
}
// ValidationError 400 · UnauthorizedError 401 · ConflictError 409 · ServiceError 500
```

- Services throw `AppError` subclasses — never raw `HttpException`
- Use the specific subclass (`NotFoundError`, not `AppError`)
- Controllers never catch; Nest maps them to HTTP responses

---

## Security (OWASP Top 10)

**NEVER**: hard-code secrets, commit `.env`, log PII, allow `*` CORS origins, build SQL with string concatenation
**ALWAYS**: env vars validated with Zod at startup, `.strict()` request schemas, parameterized queries, rate limiting on auth routes (`@nestjs/throttler`)

---

## Database — Prisma (not TypeORM)

- **Prisma ORM** (newest stable) + PostgreSQL through the `@prisma/adapter-pg` driver adapter
- Newest **stable** Prisma ORM — if npm `latest` is a release candidate, use the newest stable; `prisma`, `@prisma/client`, `@prisma/adapter-pg` always on the same version
- Not installed by default (YAGNI) — add it when the first feature needs a DB; steps in `../SETUP.md`
- Files: `prisma/schema.prisma`, `prisma/migrations/`, the Prisma config file `prisma init` creates (`prisma.config.ts` or a versioned name like `prisma7.config.ts`; DB URL lives here, not in the schema), generated client in `src/generated/prisma/` (gitignored, regenerate with `prisma generate`)

```ts
// src/prisma/prisma.service.ts — the only place PrismaClient is constructed (exported by PrismaModule)
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

---

## Repository Pattern

All DB access goes through repositories that inject `PrismaService`. **No generic `BaseRepository`** (KISS / YAGNI) — the Prisma client is already a typed CRUD API; wrapping it again adds a layer with no benefit.

```ts
// src/users/users.repository.ts
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  // Accept an optional transaction client so services can compose transactions
  create(data: Prisma.UserCreateInput, db: Prisma.TransactionClient = this.prisma): Promise<User> {
    return db.user.create({ data });
  }
}
```

- Services never touch `PrismaService` directly — only repositories do
- Add a repository method only when a service needs it — no speculative CRUD
- Unique-constraint violations: catch `Prisma.PrismaClientKnownRequestError` with code `P2002` in the repository method and throw `ConflictError`

---

## Migrations (Prisma Migrate)

- Local: `pnpm prisma migrate dev --name <change>` — creates the SQL migration and regenerates the client
- CI/CD: `pnpm prisma migrate deploy` — **never** on app startup
- Never edit an applied migration — always create a new one
- Always read the generated SQL before committing
- One migration per PR unless tightly coupled
- Destructive ops (drop column/table): add a `-- DANGER` comment in the SQL, review manually

---

## API Versioning

```ts
// main.ts
app.setGlobalPrefix('api');
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' }); // /api/v1/...

@Controller({ path: 'users', version: '2' }) // /api/v2/users — only on breaking change
```

- Version only on breaking changes (schema change, removal, new required param)
- URI versioning only — never header-based
- Versions live in the controller decorator, not in folders; service + repository are shared across versions
- Deprecation: add an `X-API-Deprecation` header + sunset date before removing

---

## Database Patterns (Prisma)

- **N+1**: load relations with `include` / `select` in one query — never query inside a loop
- **Bulk**: `createMany` / `updateMany` / `deleteMany`, not one `await` per row
- **Transactions**: `prisma.$transaction(async (tx) => { ... })` — pass `tx` to every repository call inside; on failure log with the stack and throw `ServiceError`
- **Select only what you need**: `select` the fields a response uses
- **Parallel I/O**: independent calls → `await Promise.all([...])`, never sequential `await`s

---

## Locks

- Cross-instance (Cloud Run has many containers): Redis lock with a timeout — keep the critical section < 5s
- Single-instance: in-process mutex only for in-memory state
- Never nest locks

---

## Testing (Vitest)

- Unit: `src/**/*.spec.ts`, next to the code (Nest default) — mock external deps, no DB
- Integration: real test DB/Redis, roll back after each test — **never mock the DB in integration tests**
- E2E: `test/**/*.e2e-spec.ts` — Fastify `app.inject()`; call `await app.getHttpAdapter().getInstance().ready()` after `app.init()`
- Never hit external APIs or LLMs in tests (mock them)
- SWC compiles tests too (`unplugin-swc` in `vitest.config*.ts`) — required for Nest DI

---

## Timezone

UTC everywhere in the DB (`new Date().toISOString()`). Convert to user timezone only at the display layer.
