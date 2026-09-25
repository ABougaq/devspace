# Bun vs pnpm for DevSpace

**Checked:** 2026-08-31

## Recommendation

Adopt pnpm as DevSpace's canonical package manager for repository development and CI, while keeping Node as the runtime, build runtime, and test runtime. Keep npm and npx in the published-package and end-user documentation paths.

Do not adopt Bun as DevSpace's runtime or test runner yet. Bun's package manager is credible, but using the wider Bun toolchain would combine a package-manager change with Node compatibility, native-addon, lifecycle-script, and test-environment changes. That is a poor trade for a project whose core job includes local process execution.

If installs are not currently painful, staying on npm is also a valid low-change choice. The value of pnpm is mainly lower dependency duplication across local projects, stricter dependency boundaries, and a better fit for a future multi-package repository. It is not a reason to change the product runtime.

## Why this project favors pnpm

DevSpace is currently a single package with no workspace packages. Its existing contract is:

- Node `>=22.19 <27`.
- Vite and TypeScript for builds, `tsx` for development and tests, and Node's test APIs in the test suite.
- Native-facing dependencies including `better-sqlite3` and `node-pty`.
- Extensive use of `child_process`, detached processes, PTYs, filesystem and networking APIs.
- A three-OS CI matrix covering Ubuntu, macOS, and Windows.
- A published npm package whose users install it with npm or npx.

pnpm changes the dependency manager while leaving that runtime contract intact. Bun can also install an existing Node project, but Bun's own compatibility documentation marks `node:child_process` and other relevant modules as incomplete or behaviorally different. That matters more here than Bun's runtime speed claims.

| Concern | pnpm | Bun |
| --- | --- | --- |
| Preserve the current Node runtime | Strong fit | Requires discipline to avoid runtime drift |
| Native SQLite and PTY dependencies | Install approval is explicit; runtime stays Node | Native support may work, but lifecycle trust and runtime differences need validation |
| Deterministic CI installs | `pnpm install --frozen-lockfile`, with frozen behavior in CI | Must explicitly use `--frozen-lockfile` or `bun ci` |
| Dependency boundary checking | Isolated symlinked layout catches undeclared imports | Default layout for a new single-package project is hoisted |
| Future workspaces | Mature workspace model | Supported, but not needed today |
| Replace build/test/runtime tools | Not the goal | Possible, but substantially increases scope |
| Overall value for DevSpace | Higher | Lower until a Bun runtime experiment proves safe |

## pnpm: pros and cons

### Pros

- Keeps Node, Vite, TypeScript, `tsx`, and the current test behavior unchanged.
- Uses a content-addressable store and links packages into the project, which can reduce duplicated dependency data across projects.
- Its isolated layout makes undeclared or phantom dependencies visible instead of accidentally resolving them from a flat tree. This is useful for keeping DevSpace's adapter boundaries honest.
- Provides a clear frozen-lockfile CI path and an official GitHub setup action that can use the repository's pinned package-manager version and cache.
- pnpm 10+ has explicit dependency build approval. DevSpace can approve only the native/build packages it actually needs, rather than allowing every dependency lifecycle script implicitly.
- Gives DevSpace a straightforward path to workspaces if the project later splits into server, UI, shared packages, or tools.

### Cons

- Requires a lockfile migration and a new contributor prerequisite. A local branch has already shown the required shape: `pnpm-lock.yaml`, a pinned `packageManager` field, CI setup, and an `allowBuilds` policy.
- The symlinked `node_modules` layout can expose assumptions in tooling that expects a flat directory. Start with pnpm's isolated layout and use hoisting only for a demonstrated compatibility issue.
- Native dependencies need explicit approval and a clean-install check on all three operating systems.
- Package-manager versions and lockfile versions need to stay aligned. Pin an exact tested version rather than tracking an unconstrained major.
- Existing npm-specific workflow details need a small audit. In particular, [`scripts/dev-server.mjs`](../../scripts/dev-server.mjs) invokes `npx`, and release scripts must not require pnpm unless the release job installs the pinned pnpm version.
- Contributors on some platforms need a tailored installation path. Current pnpm documentation calls out standalone-install limitations for Intel macOS and recommends care on Windows; CI setup should use the official action.

## Bun: pros and cons

### Pros

- Bun is an all-in-one executable containing a runtime, package manager, script runner, bundler, and test runner. That can be valuable for a project intentionally standardizing on Bun.
- Its package manager works in existing Node projects, supports a text `bun.lock`, frozen installs, workspaces, overrides, and platform-specific dependencies.
- Bun does not run arbitrary dependency lifecycle scripts by default. That reduces install-time execution, provided required native packages are deliberately added to `trustedDependencies`.
- Bun's Node-API support is broad enough that many native addons can work, so a future focused compatibility experiment is reasonable.
- A future standalone package or tool could use Bun to simplify its local toolchain without changing DevSpace itself.

### Cons

- The main benefit is also the main risk: adopting Bun beyond package installation changes execution semantics. DevSpace's heavy use of child processes, detached daemons, PTYs, `createRequire`, and native SQLite needs proof on Linux, macOS, and Windows.
- Bun's compatibility table explicitly lists gaps or differences in modules that are central to DevSpace, including `node:child_process` and `node:module`. This is not evidence that DevSpace cannot run on Bun, but it makes Bun a runtime project rather than a package-manager swap.
- Native packages commonly rely on install or postinstall scripts. Bun's secure default means missing trust configuration can produce an incomplete install; trusting too much weakens the benefit of the default.
- Bun's `bun.lock` is another lockfile format. Keeping both `package-lock.json` or `pnpm-lock.yaml` and `bun.lock` as active authoritative files would create drift and confuse contributors.
- Replacing `node:test`, `tsx`, Vite, or `tsc` with Bun's test runner/transpiler/bundler would add migration surface without an identified product requirement.
- Bun's package-manager speed claims are vendor benchmarks. DevSpace has not run a clean-install benchmark for its dependency graph, so speed should not be treated as a guaranteed benefit.

## What to adopt from pnpm

Use the smallest coherent pnpm adoption:

1. Convert the current npm lockfile with `pnpm import` and commit only `pnpm-lock.yaml` as the authoritative lockfile.
2. Pin the exact tested pnpm version with `packageManager` in `package.json`. Keep the Node engine range as the product contract.
3. Add a root `pnpm-workspace.yaml` only for pnpm settings such as `allowBuilds`; do not pretend DevSpace is a monorepo until it has more than one package.
4. Approve only the native/build dependencies required by a clean install, currently expected to include `better-sqlite3`, `node-pty`, and the build tool used by Vite. Review any additional prompt rather than approving it automatically.
5. Change CI to install the pinned pnpm version and run `pnpm install --frozen-lockfile`, followed by the existing typecheck, test, build, and doctor commands. Keep the existing Node 22 and three-OS matrix.
6. Make the development launcher manager-neutral or explicitly pnpm-aware instead of relying on `npx`.
7. Test `npm pack`, installation from the packed tarball, the global npm install path, and npx invocation. A repository package-manager change must not silently change the consumer-facing npm contract.

Do not add workspace protocol, catalogs, recursive orchestration, or a second package-manager lockfile until the repository has a concrete need for them.

## Where Bun could be tried safely

If there is interest in Bun, keep the first experiment separate from the canonical workflow:

- Run a disposable Bun install or a short-lived compatibility branch with an explicit frozen lockfile.
- Keep Node as the command used for `typecheck`, tests, build, and the CLI while measuring only installation behavior first.
- Configure and inspect trust for `better-sqlite3`, `node-pty`, and the project postinstall hook.
- Only consider a Bun CI compatibility job after the full native, PTY, subprocess, package, and three-OS checks pass.
- Do not commit a Bun lockfile unless the team decides Bun is the sole canonical manager for a defined package or workspace.

## Verification required before switching CI

The migration is ready only when a clean checkout passes on Ubuntu, macOS, and Windows with the pinned Node and pnpm versions:

- frozen install, including native addon loading;
- `typecheck`, all focused tests, build, and `doctor`;
- development launcher and subprocess/PTY behavior;
- npm pack contents and installation of the packed artifact;
- global npm install and npx execution;
- no undeclared-import failures under the isolated pnpm layout;
- no unexpected lifecycle scripts or unapproved native build prompts.

## Sources

The recommendation uses official documentation and the repository's current files:

- [pnpm install and frozen-lockfile behavior](https://pnpm.io/cli/install)
- [pnpm continuous integration](https://pnpm.io/continuous-integration)
- [pnpm symlinked `node_modules` structure](https://pnpm.io/symlinked-node-modules-structure)
- [pnpm build approvals](https://pnpm.io/cli/approve-builds) and [pnpm build settings](https://pnpm.io/settings/build)
- [pnpm workspaces](https://pnpm.io/workspaces)
- [pnpm installation and platform notes](https://pnpm.io/installation)
- [Bun install](https://bun.com/docs/pm/cli/install) and [Bun lockfiles](https://bun.com/docs/pm/lockfile)
- [Bun lifecycle scripts and trusted dependencies](https://bun.com/docs/pm/lifecycle)
- [Bun Node.js compatibility](https://bun.com/docs/runtime/nodejs-compat) and [Node-API support](https://bun.com/docs/runtime/node-api)
- [Bun workspaces](https://bun.com/docs/pm/workspaces)
- [npm `ci`](https://docs.npmjs.com/cli/v11/commands/npm-ci) and [npm package metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json)
