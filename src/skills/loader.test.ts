import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SkillLoader } from './loader.js';

const tempDirs: string[] = [];

function makeSkillsDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mercury-skills-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('SkillLoader metadata', () => {
  it('discovers reliability metadata and renders stable skills first', () => {
    const skillsDir = makeSkillsDir();

    mkdirSync(join(skillsDir, 'draft-skill'));
    writeFileSync(join(skillsDir, 'draft-skill', 'SKILL.md'), `---
name: draft-skill
description: Draft workflow.
version: 0.1.0
status: draft
risk-tier: R1_LOCAL_WRITE
eval-cases:
  - evals/draft.yaml
success-metrics:
  pass_rate: ">= 0.7"
---

# Draft Skill

Draft instructions.
`);

    mkdirSync(join(skillsDir, 'stable-skill'));
    writeFileSync(join(skillsDir, 'stable-skill', 'SKILL.md'), `---
name: stable-skill
description: Stable workflow.
version: 1.2.0
status: stable
risk-tier: R0_READ_ONLY
eval-cases:
  - evals/stable.yaml
success-metrics:
  pass_rate: ">= 0.9"
---

# Stable Skill

Stable instructions.
`);

    const loader = new SkillLoader(skillsDir);
    const discovered = loader.discover();

    expect(discovered.map((skill) => skill.name)).toEqual(['stable-skill', 'draft-skill']);
    expect(discovered[0]).toMatchObject({
      name: 'stable-skill',
      version: '1.2.0',
      status: 'stable',
      riskTier: 'R0_READ_ONLY',
    });
    expect(discovered[0].evalCases).toEqual(['evals/stable.yaml']);
    expect(discovered[0].successMetrics).toEqual({ pass_rate: '>= 0.9' });
    expect(loader.getSkillSummariesText()).toContain('stable-skill [stable v1.2.0]');
  });
});
