import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { PermissionsManifest } from '../capabilities/permissions.js';
import { listToolManifests, type ToolManifestEntry } from '../capabilities/tool-manifest.js';

export type AgentRuntimeState =
  | 'RECEIVED'
  | 'CONTRACTING'
  | 'EXECUTING'
  | 'VERIFYING'
  | 'LEARNING'
  | 'ARCHIVED'
  | 'HOLD'
  | 'REJECTED'
  | 'FAILED';

export type RiskTier =
  | 'R0_READ_ONLY'
  | 'R1_LOCAL_WRITE'
  | 'R2_EXTERNAL_ACTION'
  | 'R3_HIGH_IMPACT'
  | 'R4_FORBIDDEN';

export interface RuntimeSkillSummary {
  name: string;
  description: string;
  version?: string;
  status?: SkillStatus;
  riskTier?: string;
  evalCases?: string[];
  successMetrics?: Record<string, string | number>;
}

export type SkillStatus =
  | 'draft'
  | 'sandboxed'
  | 'evaluated'
  | 'beta'
  | 'stable'
  | 'deprecated'
  | 'blocked';

export type GoalTaskType = 'general' | 'code' | 'research' | 'file_write' | 'writing';

export interface GoalContract {
  id: string;
  userIntent: string;
  taskType: GoalTaskType;
  deliverable: 'direct_answer_or_artifact' | 'code_change_with_verification' | 'written_artifact';
  acceptanceTests: string[];
  constraints: {
    channelType: string;
    maxToolCalls: number;
    language: 'follow_user_context';
  };
  riskTier: RiskTier;
  permissions: {
    allowedTools: string[];
    allowedCapabilities: string[];
  };
  stopCondition: string;
}

export interface ToolAuthoritySummary {
  availableTools: string[];
  toolManifests: ToolManifestEntry[];
  allowedCapabilities: string[];
  approvalRequiredCapabilities: string[];
  score: number;
  riskSurface: number;
}

export interface SkillReliabilitySummary {
  availableSkills: RuntimeSkillSummary[];
  score: number;
}

export interface RuntimeFactors {
  goalContract: number;
  contextQuality: number;
  skillReliability: number;
  toolAuthority: number;
  evaluationFeedback: number;
  riskSurface: number;
}

export interface AgentCapabilityScore {
  formula: 'Goal Contract x Context Quality x Skill Reliability x Tool Authority x Evaluation Feedback / Risk Surface';
  score: number;
  factors: RuntimeFactors;
}

export interface RuntimeTransition {
  from: AgentRuntimeState;
  to: AgentRuntimeState;
  timestamp: number;
}

export type RuntimePlanStepId = 'contract' | 'plan' | 'execute' | 'verify' | 'learn';
export type RuntimePlanStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface RuntimePlanStep {
  id: RuntimePlanStepId;
  label: string;
  status: RuntimePlanStepStatus;
  evidence?: string;
  failureReason?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface RuntimeToolCall {
  name: string;
  inputPreview: string;
  failed: boolean;
  timestamp: number;
}

export type EvaluationVerdict = 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';

export interface RuntimeEvaluation {
  verdict: EvaluationVerdict;
  score: {
    goalCompletion: number;
    format: number;
    safety: number;
    evidence: number;
    overall: number;
  };
  issues: string[];
}

export interface EvolutionFeedback {
  proposalType: 'NONE' | 'IMPROVE_RUNTIME';
  allowedToModifySystem: false;
  signals: string[];
  proposals: EvolutionProposal[];
  summary: string;
}

export interface EvolutionProposal {
  id: string;
  runId: string;
  targetType: 'tool' | 'skill' | 'evaluator' | 'runtime';
  targetId?: string;
  reason: string;
  signals: string[];
  allowedToModifySystem: false;
  createdAt: number;
}

export interface AgentRuntimeEvidence {
  runId: string;
  state: AgentRuntimeState;
  goalContract: GoalContract;
  stateHistory: RuntimeTransition[];
  planSteps: RuntimePlanStep[];
  toolAuthority: ToolAuthoritySummary;
  skillReliability: SkillReliabilitySummary;
  toolCalls: RuntimeToolCall[];
  evaluation: RuntimeEvaluation;
  evolutionFeedback: EvolutionFeedback;
  capability: AgentCapabilityScore;
}

export interface AgentRuntimeOptions {
  runId: string;
  channelType: string;
  maxToolCalls: number;
  permissions: PermissionsManifest;
  toolNames: string[];
  toolManifests?: ToolManifestEntry[];
  skillSummaries?: RuntimeSkillSummary[];
}

/** In-memory queue for data-only evolution proposals generated from runtime evidence. */
export class EvolutionProposalQueue {
  private proposals: EvolutionProposal[] = [];

  constructor(private storagePath?: string) {
    this.load();
  }

  enqueue(proposals: EvolutionProposal[]): void {
    if (proposals.length === 0) return;
    this.proposals.push(...proposals);
    this.appendToDisk(proposals);
  }

  getRecent(limit: number = 10): EvolutionProposal[] {
    return this.proposals.slice(-limit);
  }

  private load(): void {
    if (!this.storagePath || !existsSync(this.storagePath)) return;
    const lines = readFileSync(this.storagePath, 'utf-8').split(/\r?\n/).filter(Boolean);
    this.proposals = lines
      .map((line) => {
        try {
          return JSON.parse(line) as EvolutionProposal;
        } catch {
          return null;
        }
      })
      .filter((proposal): proposal is EvolutionProposal => proposal !== null);
  }

  private appendToDisk(proposals: EvolutionProposal[]): void {
    if (!this.storagePath) return;
    mkdirSync(dirname(this.storagePath), { recursive: true });
    appendFileSync(this.storagePath, proposals.map((proposal) => JSON.stringify(proposal)).join('\n') + '\n', 'utf-8');
  }
}

/** Raised when the deterministic runtime state machine receives an invalid transition. */
export class AgentRunStateError extends Error {
  constructor(from: AgentRuntimeState, to: AgentRuntimeState) {
    super(`Invalid agent runtime state transition: ${from} -> ${to}`);
    this.name = 'AgentRunStateError';
  }
}

const VALID_TRANSITIONS: Record<AgentRuntimeState, AgentRuntimeState[]> = {
  RECEIVED: ['CONTRACTING', 'REJECTED', 'FAILED'],
  CONTRACTING: ['EXECUTING', 'HOLD', 'REJECTED', 'FAILED'],
  EXECUTING: ['VERIFYING', 'HOLD', 'FAILED'],
  VERIFYING: ['LEARNING', 'FAILED'],
  LEARNING: ['ARCHIVED'],
  ARCHIVED: [],
  HOLD: ['EXECUTING', 'FAILED', 'ARCHIVED'],
  REJECTED: [],
  FAILED: [],
};

/** Deterministic per-message runtime wrapper around Mercury's existing AI SDK agent loop. */
export class AgentRuntimeRun {
  state: AgentRuntimeState = 'RECEIVED';
  readonly history: RuntimeTransition[] = [];
  readonly planSteps: RuntimePlanStep[] = createInitialPlanSteps();
  readonly toolCalls: RuntimeToolCall[] = [];

  constructor(
    readonly runId: string,
    readonly contract: GoalContract,
    readonly toolAuthority: ToolAuthoritySummary,
    readonly skillReliability: SkillReliabilitySummary,
    readonly contextQuality: number,
  ) {}

  transition(to: AgentRuntimeState): void {
    const allowed = VALID_TRANSITIONS[this.state].includes(to);
    if (!allowed) {
      throw new AgentRunStateError(this.state, to);
    }

    const from = this.state;
    this.state = to;
    this.history.push({ from, to, timestamp: Date.now() });
    this.updatePlanStepsForTransition(to);
  }

  recordToolCall(name: string, input: Record<string, unknown>, failed: boolean): void {
    this.toolCalls.push({
      name,
      inputPreview: stablePreview(input),
      failed,
      timestamp: Date.now(),
    });
  }

  evaluate(finalText: string, options: { aborted?: boolean } = {}): RuntimeEvaluation {
    const text = finalText.trim();
    const issues: string[] = [];
    const hasBlocker = mentionsBlocker(text);

    if (options.aborted) issues.push('aborted');
    if (!text) issues.push('empty_response');
    if (hasBlocker) issues.push('reported_blocker');
    if (!hasBlocker && mentionsFailure(text)) issues.push('reported_failure');
    if (this.contract.riskTier === 'R4_FORBIDDEN') issues.push('forbidden_request');

    if (this.contract.taskType === 'code' && !hasVerificationEvidence(text) && !hasBlocker) {
      issues.push('missing_verification_evidence');
    }

    if (this.contract.taskType === 'research' && !hasSources(text) && !hasBlocker) {
      issues.push('missing_sources');
    }

    if (this.contract.taskType === 'file_write' && !hasChangeSummary(text) && !hasBlocker) {
      issues.push('missing_change_summary');
    }

    if (this.contract.taskType === 'file_write' && !hasVerificationEvidence(text) && !hasBlocker) {
      issues.push('missing_verification_evidence');
    }

    const goalCompletion = !text
      ? 0
      : issues.includes('reported_failure') ? 0.25
        : issues.includes('reported_blocker') ? 0.65
          : hasBlockingContractIssue(issues) ? 0.35
            : 0.9;
    const safety = this.contract.riskTier === 'R4_FORBIDDEN' ? 0 : 1;
    const format = text ? 0.9 : 0;
    const evidence = hasVerificationEvidence(text) || hasSources(text) || this.toolCalls.length > 0 ? 0.85 : 0.45;
    const overall = average([goalCompletion, safety, format, evidence]);

    return {
      verdict: issues.length === 0
        ? 'PASS'
        : issues.includes('reported_blocker') && !hasBlockingContractIssue(issues)
          ? 'PASS_WITH_WARNINGS'
        : issues.includes('reported_failure') || issues.includes('aborted') || issues.includes('empty_response')
          ? 'FAIL'
          : hasBlockingContractIssue(issues)
            ? 'FAIL'
          : overall >= 0.72 ? 'PASS_WITH_WARNINGS' : 'FAIL',
      score: {
        goalCompletion,
        format,
        safety,
        evidence,
        overall,
      },
      issues,
    };
  }

  createEvolutionFeedback(evaluation: RuntimeEvaluation): EvolutionFeedback {
    const signals = new Set<string>();
    if (this.toolCalls.some((call) => call.failed)) signals.add('tool_failure');
    for (const issue of evaluation.issues) signals.add(issue);
    if (evaluation.score.goalCompletion < 0.7) signals.add('low_goal_completion');

    const signalList = [...signals];
    const proposals = this.createProposals(signalList);
    return {
      proposalType: proposals.length > 0 ? 'IMPROVE_RUNTIME' : 'NONE',
      allowedToModifySystem: false,
      signals: signalList,
      proposals,
      summary: proposals.length > 0
        ? `Runtime created ${proposals.length} data-only evolution proposal(s).`
        : 'Runtime did not collect improvement signals.',
    };
  }

  getCapabilityScore(evaluation?: RuntimeEvaluation): AgentCapabilityScore {
    return calculateAgentCapability({
      goalContract: 0.9,
      contextQuality: this.contextQuality,
      skillReliability: this.skillReliability.score,
      toolAuthority: this.toolAuthority.score,
      evaluationFeedback: evaluation?.score.overall ?? 0.7,
      riskSurface: this.toolAuthority.riskSurface,
    });
  }

  renderPromptContext(): string {
    return [
      'Agent Runtime Contract:',
      `- Goal Contract: ${this.contract.userIntent}`,
      `- Task Type: ${this.contract.taskType}`,
      `- Deliverable: ${this.contract.deliverable}`,
      `- Acceptance: ${this.contract.acceptanceTests.join(' | ')}`,
      `- State Machine: RECEIVED -> CONTRACTING -> EXECUTING -> VERIFYING -> LEARNING -> ARCHIVED`,
      `- Plan Steps: ${this.planSteps.map((step) => `${step.id}:${step.status}`).join(', ')}`,
      `- Risk Tier: ${this.contract.riskTier}`,
      `- Tool Authority: ${this.toolAuthority.availableTools.join(', ') || 'none'}`,
      `- Skill Assets: ${this.skillReliability.availableSkills.map((skill) => skill.name).join(', ') || 'none'}`,
      `- Evaluation Evolution: final answer must state completion evidence or blocker; runtime records feedback only, never self-modifies.`,
    ].join('\n');
  }

  toEvidence(evaluation: RuntimeEvaluation, feedback: EvolutionFeedback): AgentRuntimeEvidence {
    return {
      runId: this.runId,
      state: this.state,
      goalContract: this.contract,
      stateHistory: this.history,
      planSteps: this.planSteps,
      toolAuthority: this.toolAuthority,
      skillReliability: this.skillReliability,
      toolCalls: this.toolCalls,
      evaluation,
      evolutionFeedback: feedback,
      capability: this.getCapabilityScore(evaluation),
    };
  }

  markPlanStep(id: RuntimePlanStepId, status: RuntimePlanStepStatus, evidence?: string, failureReason?: string): void {
    const step = this.planSteps.find((candidate) => candidate.id === id);
    if (!step) return;
    step.status = status;
    if (evidence) step.evidence = evidence;
    if (failureReason) step.failureReason = failureReason;
    if (status === 'in_progress' && !step.startedAt) step.startedAt = Date.now();
    if (status === 'completed' || status === 'failed' || status === 'skipped') {
      step.completedAt = Date.now();
    }
  }

  private updatePlanStepsForTransition(to: AgentRuntimeState): void {
    if (to === 'CONTRACTING') {
      this.markPlanStep('contract', 'in_progress', 'Goal contract created.');
      return;
    }
    if (to === 'EXECUTING') {
      this.markPlanStep('contract', 'completed', 'Goal contract accepted.');
      this.markPlanStep('plan', 'completed', 'Using Mercury AI SDK multi-step execution with the authorized tool set.');
      this.markPlanStep('execute', 'in_progress', 'Tool execution started.');
      return;
    }
    if (to === 'VERIFYING') {
      this.markPlanStep('execute', 'completed', `${this.toolCalls.length} tool call(s) recorded.`);
      this.markPlanStep('verify', 'in_progress', 'Contract-aware evaluator started.');
      return;
    }
    if (to === 'LEARNING') {
      this.markPlanStep('verify', 'completed', 'Evaluation completed.');
      this.markPlanStep('learn', 'in_progress', 'Evolution feedback collection started.');
      return;
    }
    if (to === 'ARCHIVED') {
      this.markPlanStep('learn', 'completed', 'Runtime evidence archived.');
      return;
    }
    if (to === 'REJECTED' || to === 'FAILED') {
      const active = this.planSteps.find((step) => step.status === 'in_progress');
      if (active) {
        this.markPlanStep(active.id, 'failed', active.evidence, to === 'REJECTED' ? 'Runtime rejected the request.' : 'Runtime failed before completion.');
      }
    }
  }

  private createProposals(signals: string[]): EvolutionProposal[] {
    const proposals: EvolutionProposal[] = [];
    const failedTool = this.toolCalls.find((call) => call.failed);
    if (failedTool) {
      proposals.push(createProposal(this.runId, 'tool', failedTool.name, 'Tool failed during execution.', ['tool_failure']));
    }

    const evaluatorSignals = signals.filter((signal) => signal.startsWith('missing_') || signal === 'reported_blocker');
    if (evaluatorSignals.length > 0) {
      proposals.push(createProposal(this.runId, 'evaluator', this.contract.taskType, 'Evaluator found contract evidence gaps.', evaluatorSignals));
    }

    if (signals.includes('low_goal_completion') && proposals.length === 0) {
      proposals.push(createProposal(this.runId, 'runtime', 'goal_completion', 'Goal completion score was low.', ['low_goal_completion']));
    }

    return proposals;
  }
}

/** Builds a runtime run with contract, tool authority, skill reliability, and context scores. */
export function createAgentRuntimeRun(userIntent: string, options: AgentRuntimeOptions): AgentRuntimeRun {
  const toolAuthority = summarizeToolAuthority(options.toolNames, options.permissions, options.toolManifests);
  const skillReliability = summarizeSkillReliability(options.skillSummaries ?? []);
  const contract = createGoalContract(userIntent, options, toolAuthority);
  const contextQuality = estimateContextQuality(userIntent, toolAuthority, skillReliability);
  return new AgentRuntimeRun(options.runId, contract, toolAuthority, skillReliability, contextQuality);
}

/** Converts a user intent into a deterministic, inspectable goal contract. */
export function createGoalContract(
  userIntent: string,
  options: AgentRuntimeOptions,
  toolAuthority: ToolAuthoritySummary,
): GoalContract {
  const trimmed = userIntent.trim();
  const acceptanceTests = ['Answer the user intent directly.'];
  const taskType = inferTaskType(trimmed);
  const deliverable = inferDeliverable(trimmed);

  if (deliverable === 'code_change_with_verification') {
    acceptanceTests.push('Source changes are covered by automated tests or a concrete blocker is reported.');
    acceptanceTests.push('Relevant verification commands are run and reported.');
  }

  if (deliverable === 'written_artifact') {
    acceptanceTests.push('Final artifact has the requested structure and scope.');
  }

  if (taskType === 'research') {
    acceptanceTests.push('Research claims include sources or an explicit blocker.');
  }

  if (taskType === 'file_write') {
    acceptanceTests.push('File write tasks include a change summary and verification evidence or an explicit blocker.');
  }

  acceptanceTests.push('Respect configured tool permissions and risk tier.');

  return {
    id: `${options.runId}:goal`,
    userIntent: trimmed,
    taskType,
    deliverable,
    acceptanceTests,
    constraints: {
      channelType: options.channelType,
      maxToolCalls: options.maxToolCalls,
      language: 'follow_user_context',
    },
    riskTier: classifyRiskTier(trimmed),
    permissions: {
      allowedTools: toolAuthority.availableTools,
      allowedCapabilities: toolAuthority.allowedCapabilities,
    },
    stopCondition: 'Stop when acceptance tests pass, a hard permission boundary blocks progress, or the task is impossible within constraints.',
  };
}

/** Classifies obvious task risk before model execution. */
export function classifyRiskTier(intent: string): RiskTier {
  const text = intent.toLowerCase();

  if (matchesAny(text, [
    '绕过权限',
    'bypass permission',
    '删除所有用户数据',
    'delete all user data',
    '把密钥发出去',
    'exfiltrate',
    'steal secret',
    '泄露密钥',
    'rm -rf /',
  ])) {
    return 'R4_FORBIDDEN';
  }

  if (matchesAny(text, [
    '生产环境',
    '部署到生产',
    'deploy to production',
    'npm publish',
    '发布 npm',
    '删库',
    'drop database',
    '付款',
    '资金',
    'payment',
    '权限变更',
  ])) {
    return 'R3_HIGH_IMPACT';
  }

  if (matchesAny(text, [
    '发送消息',
    '发邮件',
    '通知我',
    '提交表单',
    '创建 github issue',
    'create github issue',
    '创建 pr',
    'pull request',
    'git push',
    'webhook',
    'send message',
    'send email',
  ])) {
    return 'R2_EXTERNAL_ACTION';
  }

  if (matchesAny(text, [
    '修改',
    '新增',
    '写入',
    '创建文件',
    '修复',
    '代码',
    'edit',
    'write',
    'fix',
    'build',
    'implement',
  ])) {
    return 'R1_LOCAL_WRITE';
  }

  return 'R0_READ_ONLY';
}

/** Scores currently registered tools using structured manifests and permission state. */
export function summarizeToolAuthority(
  toolNames: string[],
  permissions: PermissionsManifest,
  toolManifests: ToolManifestEntry[] = listToolManifests(toolNames),
): ToolAuthoritySummary {
  const availableTools = [...new Set(toolNames)].sort();
  const allowedCapabilities: string[] = [];
  const approvalRequiredCapabilities: string[] = [];

  const fs = permissions.capabilities.filesystem;
  if (fs.enabled && fs.scopes.some((scope) => scope.read)) allowedCapabilities.push('filesystem:read');
  if (fs.enabled && fs.scopes.some((scope) => scope.write)) allowedCapabilities.push('filesystem:write');

  const shell = permissions.capabilities.shell;
  if (shell.enabled) allowedCapabilities.push('shell:execute');

  const git = permissions.capabilities.git;
  if (git.enabled && git.autoApproveRead) allowedCapabilities.push('git:read');
  if (git.enabled && git.approveWrite) approvalRequiredCapabilities.push('git:write');

  for (const manifest of toolManifests) {
    if (manifest.requiresApproval) {
      approvalRequiredCapabilities.push(manifest.capability);
    } else {
      allowedCapabilities.push(manifest.capability);
    }
  }

  const uniqueAllowedCapabilities = [...new Set(allowedCapabilities)].sort();
  const uniqueApprovalRequired = [...new Set(approvalRequiredCapabilities)].sort();
  const authorityBreadth = Math.min(1, availableTools.length / 10);
  const permissionBreadth = Math.min(1, uniqueAllowedCapabilities.length / 5);
  const score = clamp((authorityBreadth + permissionBreadth) / 2, 0.1, 1);

  let riskSurface = 1;
  for (const manifest of toolManifests) {
    riskSurface += riskWeight(manifest.riskTier);
    riskSurface += sideEffectWeight(manifest.sideEffect);
    if (manifest.requiresApproval) riskSurface += 0.15;
    if (!manifest.reversible) riskSurface += 0.2;
  }

  return {
    availableTools,
    toolManifests: [...toolManifests].sort((a, b) => a.name.localeCompare(b.name)),
    allowedCapabilities: uniqueAllowedCapabilities,
    approvalRequiredCapabilities: uniqueApprovalRequired,
    score,
    riskSurface: round(riskSurface),
  };
}

/** Scores discovered skills, favoring stable/evaluated skills over draft or blocked skills. */
export function summarizeSkillReliability(skillSummaries: RuntimeSkillSummary[]): SkillReliabilitySummary {
  const availableSkills = [...skillSummaries].sort((a, b) => {
    const status = skillStatusScore(b.status) - skillStatusScore(a.status);
    if (status !== 0) return status;
    return a.name.localeCompare(b.name);
  });
  const usableSkills = availableSkills.filter((skill) => skill.status !== 'blocked' && skill.status !== 'deprecated');
  const bestScore = usableSkills.reduce((max, skill) => Math.max(max, skillStatusScore(skill.status)), 0);
  return {
    availableSkills,
    score: availableSkills.length === 0 ? 0.5 : clamp(0.45 + bestScore * 0.08 + usableSkills.length * 0.04, 0.45, 1),
  };
}

/** Renders runtime evidence for `/runtime` and `/trace`. */
export function formatRuntimeTrace(evidence?: AgentRuntimeEvidence | null): string {
  if (!evidence) {
    return 'No runtime trace is available yet.';
  }

  const contract = evidence.goalContract;
  const lines = [
    'Runtime Trace',
    '',
    'Goal Contract',
    `- Intent: ${contract.userIntent}`,
    `- Task Type: ${contract.taskType}`,
    `- Deliverable: ${contract.deliverable}`,
    `- Risk: ${contract.riskTier}`,
    '',
    'Plan Steps',
    ...evidence.planSteps.map((step) => {
      const detail = step.failureReason ? ` (${step.failureReason})` : step.evidence ? ` - ${step.evidence}` : '';
      return `- ${step.id}: ${step.status}${detail}`;
    }),
    '',
    'Tool Calls',
    ...(evidence.toolCalls.length > 0
      ? evidence.toolCalls.map((call) => `- ${call.name}: ${call.failed ? 'failed' : 'ok'} ${call.inputPreview}`)
      : ['- none']),
    '',
    'Evaluation',
    `- Verdict: ${evidence.evaluation.verdict}`,
    `- Issues: ${evidence.evaluation.issues.length > 0 ? evidence.evaluation.issues.join(', ') : 'none'}`,
    `- Overall: ${evidence.evaluation.score.overall.toFixed(3)}`,
    '',
    'Capability',
    `- Score: ${evidence.capability.score.toFixed(3)}`,
    `- Risk Surface: ${evidence.capability.factors.riskSurface.toFixed(3)}`,
    '',
    'Evolution Proposals',
    ...(evidence.evolutionFeedback.proposals.length > 0
      ? evidence.evolutionFeedback.proposals.map((proposal) => `- ${proposal.targetType}:${proposal.targetId || 'runtime'} - ${proposal.reason}`)
      : ['- none']),
  ];

  return lines.join('\n');
}

/** Applies the Agent Capability formula with risk surface as the denominator. */
export function calculateAgentCapability(factors: RuntimeFactors): AgentCapabilityScore {
  const safeRiskSurface = Math.max(1, factors.riskSurface);
  const product = factors.goalContract
    * factors.contextQuality
    * factors.skillReliability
    * factors.toolAuthority
    * factors.evaluationFeedback;
  return {
    formula: 'Goal Contract x Context Quality x Skill Reliability x Tool Authority x Evaluation Feedback / Risk Surface',
    score: round(clamp(product / safeRiskSurface, 0, 1)),
    factors: {
      goalContract: round(factors.goalContract),
      contextQuality: round(factors.contextQuality),
      skillReliability: round(factors.skillReliability),
      toolAuthority: round(factors.toolAuthority),
      evaluationFeedback: round(factors.evaluationFeedback),
      riskSurface: round(safeRiskSurface),
    },
  };
}

function inferDeliverable(intent: string): GoalContract['deliverable'] {
  const text = intent.toLowerCase();
  if (inferTaskType(intent) === 'file_write') {
    return 'written_artifact';
  }
  if (matchesAny(text, ['修改', '新增', '修复', '代码', '测试', 'implement', 'fix', 'build'])) {
    return 'code_change_with_verification';
  }
  if (matchesAny(text, ['文档', '报告', '设计方案', 'markdown', 'doc', 'report'])) {
    return 'written_artifact';
  }
  return 'direct_answer_or_artifact';
}

function inferTaskType(intent: string): GoalTaskType {
  const text = intent.toLowerCase();
  if (matchesAny(text, ['调研', '研究', '市场', '来源', '引用', 'research', 'source', 'citation'])) {
    return 'research';
  }
  if (matchesAny(text, ['创建文件', '写入文件', '保存到', 'write file', 'create file'])) {
    return 'file_write';
  }
  if (matchesAny(text, ['源码', '代码', '测试', '实现', '修复', 'implement', 'fix', 'test'])) {
    return 'code';
  }
  if (matchesAny(text, ['文档', '报告', '设计方案', 'markdown', 'doc', 'report'])) {
    return 'writing';
  }
  return 'general';
}

function estimateContextQuality(
  userIntent: string,
  toolAuthority: ToolAuthoritySummary,
  skillReliability: SkillReliabilitySummary,
): number {
  const intentScore = userIntent.trim().length >= 8 ? 0.8 : 0.45;
  const toolScore = toolAuthority.availableTools.length > 0 ? 0.8 : 0.4;
  return round(average([intentScore, toolScore, skillReliability.score]));
}

function stablePreview(input: Record<string, unknown>): string {
  try {
    return JSON.stringify(input, Object.keys(input).sort()).slice(0, 240);
  } catch {
    return '[unserializable input]';
  }
}

function mentionsFailure(text: string): boolean {
  const lower = text.toLowerCase();
  return matchesAny(lower, [
    '失败',
    '未通过',
    '不能完成',
    '无法完成',
    'failed',
    'failure',
    'error:',
    'cannot complete',
  ]);
}

function mentionsBlocker(text: string): boolean {
  const lower = text.toLowerCase();
  return matchesAny(lower, [
    '阻断原因',
    '阻塞原因',
    '缺少依赖',
    '权限不足',
    '无法运行',
    'blocked',
    'blocker',
    'cannot run',
    'permission denied',
  ]);
}

function hasVerificationEvidence(text: string): boolean {
  const lower = text.toLowerCase();
  return matchesAny(lower, ['npm test', 'npm run', 'vitest', 'typecheck', 'build', '测试', '验证']);
}

function hasSources(text: string): boolean {
  return /https?:\/\/\S+/.test(text)
    || /(^|\n)\s*(来源|source|sources|参考|references?)\s*[:：]/i.test(text)
    || /\[\d+\]/.test(text);
}

function hasChangeSummary(text: string): boolean {
  const lower = text.toLowerCase();
  return matchesAny(lower, ['已创建', '已修改', '已写入', 'created', 'modified', 'changed', 'wrote'])
    && /[\w./\\-]+\.[A-Za-z0-9]+/.test(text);
}

function hasBlockingContractIssue(issues: string[]): boolean {
  return issues.includes('missing_verification_evidence')
    || issues.includes('missing_sources')
    || issues.includes('missing_change_summary')
    || issues.includes('forbidden_request');
}

function createInitialPlanSteps(): RuntimePlanStep[] {
  return [
    { id: 'contract', label: 'Goal contract', status: 'pending' },
    { id: 'plan', label: 'Minimal execution plan', status: 'pending' },
    { id: 'execute', label: 'Tool execution', status: 'pending' },
    { id: 'verify', label: 'Contract verification', status: 'pending' },
    { id: 'learn', label: 'Evolution feedback', status: 'pending' },
  ];
}

function createProposal(
  runId: string,
  targetType: EvolutionProposal['targetType'],
  targetId: string,
  reason: string,
  signals: string[],
): EvolutionProposal {
  return {
    id: `${runId}:proposal:${targetType}:${targetId}:${Date.now().toString(36)}`,
    runId,
    targetType,
    targetId,
    reason,
    signals,
    allowedToModifySystem: false,
    createdAt: Date.now(),
  };
}

function skillStatusScore(status?: SkillStatus): number {
  switch (status) {
    case 'stable': return 6;
    case 'beta': return 5;
    case 'evaluated': return 4;
    case 'sandboxed': return 3;
    case 'draft': return 2;
    case 'deprecated': return 1;
    case 'blocked': return 0;
    default: return 2;
  }
}

function riskWeight(riskTier: string): number {
  switch (riskTier) {
    case 'R0_READ_ONLY': return 0;
    case 'R1_LOCAL_WRITE': return 0.25;
    case 'R2_EXTERNAL_ACTION': return 0.5;
    case 'R3_HIGH_IMPACT': return 1;
    case 'R4_FORBIDDEN': return 2;
    default: return 0.3;
  }
}

function sideEffectWeight(sideEffect: string): number {
  switch (sideEffect) {
    case 'none':
    case 'local_read':
    case 'memory_read':
    case 'external_read':
      return 0;
    case 'local_write':
    case 'skill_write':
    case 'scheduler_write':
      return 0.25;
    case 'local_delete':
    case 'external_write':
    case 'shell_execute':
      return 0.5;
    default:
      return 0.2;
  }
}

function matchesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
