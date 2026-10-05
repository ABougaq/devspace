import type { ToolMode } from "../config.js";
import { codexInstructions, registerCodexTools } from "./codex.js";
import { claudeInstructions, registerClaudeTools } from "./claude.js";
import { hybridInstructions, registerHybridTools } from "./hybrid.js";
import { type ToolSurface } from "./types.js";

const TOOL_SURFACES: Record<ToolMode, ToolSurface> = {
  claude: {
    register: registerClaudeTools,
    instructions: claudeInstructions,
  },
  codex: {
    register: registerCodexTools,
    instructions: codexInstructions,
  },
  hybrid: {
    register: registerHybridTools,
    instructions: hybridInstructions,
  },
};

export function getToolSurface(mode: ToolMode): ToolSurface {
  return TOOL_SURFACES[mode];
}
