import type { RiskTier } from '../core/agent-runtime.js';

export type ToolSideEffect =
  | 'none'
  | 'local_read'
  | 'local_write'
  | 'local_delete'
  | 'shell_execute'
  | 'external_read'
  | 'external_write'
  | 'scheduler_write'
  | 'skill_write'
  | 'memory_read';

export interface ToolManifestEntry {
  name: string;
  capability: string;
  riskTier: RiskTier;
  reversible: boolean;
  requiresApproval: boolean;
  sideEffect: ToolSideEffect;
}

const TOOL_MANIFEST: Record<string, ToolManifestEntry> = {
  read_file: tool('read_file', 'filesystem:read', 'R0_READ_ONLY', true, false, 'none'),
  list_dir: tool('list_dir', 'filesystem:read', 'R0_READ_ONLY', true, false, 'none'),
  send_file: tool('send_file', 'filesystem:read', 'R2_EXTERNAL_ACTION', true, true, 'external_write'),
  write_file: tool('write_file', 'filesystem:write', 'R1_LOCAL_WRITE', true, true, 'local_write'),
  create_file: tool('create_file', 'filesystem:write', 'R1_LOCAL_WRITE', true, true, 'local_write'),
  edit_file: tool('edit_file', 'filesystem:write', 'R1_LOCAL_WRITE', true, true, 'local_write'),
  delete_file: tool('delete_file', 'filesystem:write', 'R3_HIGH_IMPACT', false, true, 'local_delete'),
  approve_scope: tool('approve_scope', 'filesystem:approval', 'R2_EXTERNAL_ACTION', true, true, 'local_write'),

  run_command: tool('run_command', 'shell:execute', 'R2_EXTERNAL_ACTION', false, true, 'shell_execute'),
  cd: tool('cd', 'shell:cwd', 'R0_READ_ONLY', true, false, 'none'),
  approve_command: tool('approve_command', 'shell:approval', 'R2_EXTERNAL_ACTION', true, true, 'shell_execute'),

  git_status: tool('git_status', 'git:read', 'R0_READ_ONLY', true, false, 'local_read'),
  git_diff: tool('git_diff', 'git:read', 'R0_READ_ONLY', true, false, 'local_read'),
  git_log: tool('git_log', 'git:read', 'R0_READ_ONLY', true, false, 'local_read'),
  git_add: tool('git_add', 'git:write', 'R1_LOCAL_WRITE', true, true, 'local_write'),
  git_commit: tool('git_commit', 'git:write', 'R1_LOCAL_WRITE', true, true, 'local_write'),
  git_push: tool('git_push', 'git:write', 'R2_EXTERNAL_ACTION', false, true, 'external_write'),

  create_pr: tool('create_pr', 'github:write', 'R2_EXTERNAL_ACTION', true, true, 'external_write'),
  review_pr: tool('review_pr', 'github:write', 'R2_EXTERNAL_ACTION', true, true, 'external_write'),
  list_issues: tool('list_issues', 'github:read', 'R0_READ_ONLY', true, false, 'external_read'),
  create_issue: tool('create_issue', 'github:write', 'R2_EXTERNAL_ACTION', true, true, 'external_write'),
  github_api: tool('github_api', 'github:api', 'R3_HIGH_IMPACT', false, true, 'external_write'),

  fetch_url: tool('fetch_url', 'web:read', 'R0_READ_ONLY', true, false, 'external_read'),
  send_message: tool('send_message', 'messaging:write', 'R2_EXTERNAL_ACTION', false, true, 'external_write'),

  install_skill: tool('install_skill', 'skills:write', 'R1_LOCAL_WRITE', true, true, 'skill_write'),
  list_skills: tool('list_skills', 'skills:read', 'R0_READ_ONLY', true, false, 'memory_read'),
  use_skill: tool('use_skill', 'skills:read', 'R0_READ_ONLY', true, false, 'memory_read'),

  schedule_task: tool('schedule_task', 'scheduler:write', 'R2_EXTERNAL_ACTION', true, true, 'scheduler_write'),
  list_scheduled_tasks: tool('list_scheduled_tasks', 'scheduler:read', 'R0_READ_ONLY', true, false, 'memory_read'),
  cancel_scheduled_task: tool('cancel_scheduled_task', 'scheduler:write', 'R1_LOCAL_WRITE', true, true, 'scheduler_write'),

  budget_status: tool('budget_status', 'system:read', 'R0_READ_ONLY', true, false, 'memory_read'),
};

/** Returns structured authority metadata for a Mercury tool. */
export function getToolManifest(name: string): ToolManifestEntry {
  return TOOL_MANIFEST[name] ?? tool(name, `unknown:${name}`, 'R1_LOCAL_WRITE', false, true, 'local_write');
}

/** Returns tool authority metadata in the same order as the requested tool names. */
export function listToolManifests(names: string[]): ToolManifestEntry[] {
  const unique = [...new Set(names)];
  return unique.map(getToolManifest);
}

function tool(
  name: string,
  capability: string,
  riskTier: RiskTier,
  reversible: boolean,
  requiresApproval: boolean,
  sideEffect: ToolSideEffect,
): ToolManifestEntry {
  return { name, capability, riskTier, reversible, requiresApproval, sideEffect };
}
