export interface SkillMeta {
  name: string;
  description: string;
  version?: string;
  status?: SkillStatus;
  'risk-tier'?: string;
  'eval-cases'?: string[];
  'success-metrics'?: Record<string, string | number>;
  'allowed-tools'?: string[];
  'disable-model-invocation'?: boolean;
}

export type SkillStatus =
  | 'draft'
  | 'sandboxed'
  | 'evaluated'
  | 'beta'
  | 'stable'
  | 'deprecated'
  | 'blocked';

export interface SkillDiscovery {
  name: string;
  description: string;
  version?: string;
  status?: SkillStatus;
  riskTier?: string;
  evalCases?: string[];
  successMetrics?: Record<string, string | number>;
}

export interface Skill extends SkillMeta {
  instructions: string;
  scriptsDir?: string;
  referencesDir?: string;
}
