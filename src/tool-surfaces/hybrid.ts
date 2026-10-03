import { registerClaudeMutationTools } from "./claude.js";
import { registerCodexProcessTools } from "./codex.js";
import {
  toolNames,
  type ToolInstructionContext,
  type ToolRegistrationContext,
} from "./types.js";

const HYBRID_INSTRUCTIONS = `Follow instructions returned by ${toolNames.openWorkspace}; read applicable instruction and skill files before working in their scope.`;

export function hybridInstructions({
  agents,
  skills,
}: ToolInstructionContext): string {
  return `${agents}${skills}${HYBRID_INSTRUCTIONS}`;
}

export function registerHybridTools(context: ToolRegistrationContext): void {
  registerClaudeMutationTools(context);
  registerCodexProcessTools(context);
}
