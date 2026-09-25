# Changelog

All notable changes to DevSpace are documented here.

## [1.1.0] - Unreleased

Compared with `v1.0.8`, this release changes the configuration and model-facing tool contracts. The `/mcp` endpoint remains the connection point, but users who configure DevSpace through environment variables or build a custom MCP host should read the breaking changes before upgrading.

For a typical v1.0 user whose durable settings are in `~/.devspace/config.json`, the forward migration handles most of the configuration upgrade automatically: known settings are translated into `config.jsonc`, the old file is backed up, and `auth.json` is unchanged. Manual migration is primarily needed for environment-only settings, unsupported legacy fields, and integrations that depend on the old tool or UI contracts.

### Added

- Versioned, schema-backed JSONC configuration at `~/.devspace/config.jsonc`. Comments and trailing commas are supported, and `devspace config set` preserves existing formatting.
- One-time migration from the legacy `~/.devspace/config.json`, with an automatic `config.json.v1.0.bak` backup after a successful migration.
- Explicit `claude` and `codex` tool surfaces with stable, discoverable tool inventories.
- Universal Git-backed aggregate review through `show_changes`, including durable `reviewRef` values that can be reopened after a later review or process restart.
- `devspace show-changes <review-ref> [--json]` for reopening a historical review from the terminal.
- MCP support for the `2026-07-28` protocol, with stateless compatibility handling for older 2025-era clients on the same `/mcp` endpoint.
- Self-contained npm packaging with executable `devspace` and `devspace-agentd` launchers.
- Bounded workspace caching and more reliable instruction, checkout, worktree, and daemon lifecycle handling.

### Changed

- The default tool mode is now `codex` instead of the `v1.0.8` default of `minimal`.
- The old `minimal`, `full`, and `codex` mode setting is replaced by `tools.mode: "claude" | "codex"`.
- Dedicated `grep`, `glob`, and `ls` tools are removed. Use the selected shell tool with commands such as `rg`, `find`, and `ls` when search or directory inspection is needed.
- Aggregate review is available in both tool surfaces. UI metadata is now limited to the workspace card and the aggregate review card, which produces a less cluttered end-of-turn diff instead of a card for each individual tool call.
- `ui.enabled: false` disables UI metadata but does not remove the `show_changes` tool or the review instruction.
- Restricted Claude subagents now keep read, edit, and shell authority scoped to the workspace. This improves safety but can reject workflows that depended on reaching unrelated files outside it.
- Claude-mode `bash` is general local shell execution. Commands run with the user's local authority and are not a separate filesystem sandbox.
- Repository development uses pnpm 11.25.0 and `pnpm-lock.yaml`; npm package consumers can continue to install with npm or npx.

### Breaking changes and migration notes

#### 1. Environment-only configuration is no longer imported

The following `v1.0.8` configuration variables are no longer read in `v1.1`:

| `v1.0.8` environment variable(s) | `v1.1` JSONC setting |
| --- | --- |
| `HOST`, `PORT` | `server.host`, `server.port` |
| `DEVSPACE_PUBLIC_BASE_URL`, `DEVSPACE_ALLOWED_HOSTS`, `DEVSPACE_TRUST_PROXY` | `server.publicBaseUrl`, `server.allowedHosts`, `server.trustProxy` |
| `DEVSPACE_ALLOWED_ROOTS`, `DEVSPACE_WORKTREE_ROOT` | `workspaces.allowedRoots`, `workspaces.worktreeRoot` |
| `DEVSPACE_STATE_DIR` | `storage.stateDir` |
| `DEVSPACE_TOOL_MODE`, `DEVSPACE_MINIMAL_TOOLS` | `tools.mode` |
| `DEVSPACE_WIDGETS` | `ui.enabled` |
| `DEVSPACE_ARTIFACTS`, `DEVSPACE_ARTIFACT_MAX_FILE_BYTES` | `artifacts.enabled`, `artifacts.maxFileBytes` |
| `DEVSPACE_SKILLS`, `DEVSPACE_SKILL_PATHS`, `DEVSPACE_AGENT_DIR` | `skills.enabled`, `skills.paths`, `skills.agentDir` |
| `DEVSPACE_SUBAGENTS` | `subagents.enabled` |
| `DEVSPACE_LOG_LEVEL`, `DEVSPACE_LOG_FORMAT`, `DEVSPACE_LOG_REQUESTS`, `DEVSPACE_LOG_ASSETS`, `DEVSPACE_LOG_TOOL_CALLS`, `DEVSPACE_LOG_SHELL_COMMANDS` | `logging.*` |
| `DEVSPACE_OAUTH_ACCESS_TOKEN_TTL_SECONDS`, `DEVSPACE_OAUTH_REFRESH_TOKEN_TTL_SECONDS`, `DEVSPACE_OAUTH_SCOPES`, `DEVSPACE_OAUTH_ALLOWED_REDIRECT_HOSTS` | `oauth.*` |

Only these two user-facing environment variables remain:

- `DEVSPACE_CONFIG_DIR` — changes the directory containing `config.jsonc` and `auth.json`.
- `DEVSPACE_OAUTH_OWNER_TOKEN` — optionally overrides the owner token.

This means an environment-only deployment can silently fall back to defaults in `v1.1` unless its settings are moved into JSONC first. In particular, its port, allowed roots, state directory, tool mode, public URL, or logging behavior may change.

The supported configuration shape is versioned and strict. A hand-written file should include `"configVersion": 1`, use the nested sections in the table above, and remove unknown keys. If `config.json` exists and `config.jsonc` does not, the first `v1.1` load migrates the supported legacy fields and renames the old file to `config.json.v1.0.bak`. If `config.jsonc` already exists, it wins and `config.json` is not consulted.

#### 2. The MCP tool contract changed

The available tools are now:

| `tools.mode` | Tools exposed |
| --- | --- |
| `claude` | `open_workspace`, `read`, `write`, `edit`, `bash`, `show_changes` |
| `codex` | `open_workspace`, `read`, `apply_patch`, `exec_command`, `write_stdin`, `show_changes` |

Migration from the old modes is not one-to-one:

- Old `minimal` users should choose `claude` for the closest editing workflow, or choose `codex` if the host already understands patch and process-session tools.
- Old `full` users should choose `claude` and use its shell for search and directory inspection; there is no direct replacement for the dedicated search tools.
- Old `codex` users can keep `codex`.
- Users with no explicit mode will receive `codex` by default.

Custom MCP hosts and model integrations that call `grep`, `glob`, `ls`, `write`, `edit`, or `bash` by name must rediscover the tools and update their calls. Hosts that render the old generic per-tool UI cards must also update: rich UI metadata now accompanies `open_workspace` and `show_changes`, while ordinary tool results remain compact and structured.

`show_changes` is now present in both modes and is the single aggregate review step after modifications. It requires a Git-backed workspace to produce a review. The `reviewRef` in its result is the durable handle for reopening that review; callers should persist the returned `workspaceId` and `reviewRef` rather than relying on an MCP transport session to hold application state.

#### 3. Widget settings no longer control review availability

`DEVSPACE_WIDGETS=off|changes|full` is replaced by `ui.enabled: true|false`. The old setting controlled both whether review was exposed and how many individual tool cards were rendered. In `v1.1`, review is a normal model-facing tool in both modes, and `ui.enabled` only controls whether the host receives UI metadata.

#### 4. Restricted subagent file access is tighter

Claude subagents running with restricted authority may no longer read or modify files outside the workspace. Users who relied on those subagents to access shared configuration or other home-directory files must place the required inputs in the workspace or use an explicitly broader authority mode.

#### 5. Source-checkout workflows use pnpm

Contributors running DevSpace from a source checkout should use Node `>=22.19 <27`, pnpm `11.25.0`, and `pnpm install --frozen-lockfile`. The npm lockfile and npm-based repository scripts were replaced. This does not change the normal `npm install -g` or `npx @waishnav/devspace` package-consumer workflow.

### Upgrade checklist

1. Back up `~/.devspace/config.json` if it exists. Start `v1.1` once and confirm that the generated `config.jsonc` contains the expected roots, port, storage directory, and public URL.
2. If deployment is environment-driven, copy every setting from the migration table into `config.jsonc`; do not assume the old environment will be imported.
3. Set `tools.mode` explicitly to `claude` or `codex` rather than relying on the new default.
4. Run `devspace doctor` and `devspace config get` before reconnecting the MCP host.
5. If using a custom MCP host, rediscover tools, handle `show_changes`, and migrate any per-tool card rendering to the workspace/aggregate-review cards.
