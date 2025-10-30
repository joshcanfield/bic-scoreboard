# UI Workspace (TypeScript Migration)

This folder hosts the forthcoming TypeScript build for the control UI.

- `npm install` to install Vite, TypeScript, Vitest, Playwright, and linting tooling.
- `npm run dev` launches Vite with proxies to the Java service (`/api` → 8080, `/ws` → 8082).
- `npm run build` outputs static assets to `src/main/dist/web-generated`; the legacy UI remains in `src/main/dist/web` during the migration.
- `npm run test` executes unit tests with Vitest (`jsdom` environment).
- `npm run check` lints, runs Vitest in CI mode, and performs a TypeScript typecheck.
- `npm run generate:types` produces REST client typings from `openapi/game.yaml` into `src/api/game.types.ts`.

Once the migration progresses, copy or translate existing `src/main/dist/web/**` assets into this workspace and flip Gradle to consume the generated bundle.
