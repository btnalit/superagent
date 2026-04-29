我读完了。我的判断是：Claude 这份方案是一个很好的“哲学级设计稿”，但还不是“生产级系统规格”。它最强的地方是抓住了三条主线：**职责清晰、唯一信任边界、Skills 是长期资产**；它也明确提出了 `self-evolution-governor → 用户批准 → ops-gate → 执行` 这条唯一边界，以及“Proposal 是纯数据、ops-gate 是代码硬边界”的思想。  

但它还缺四个生产级关键件：**目标契约、状态机、权限模型、评估体系**。Claude 方案说“目标达成才终止”，这个方向对，但工程上必须把“目标达成”变成可检查的验收条件；它说“LLM 自由推理”，这个方向也对，但执行层必须是确定性的状态机，而不是纯 while loop；它说“Skills 持续进化”，也对，但进化不能只靠经验总结，必须有测试集、回归集、A/B、灰度和回滚。 

下面是我给你的完整设计方案。我会把它设计成一个真正能落地的 **Agent Operating System，简称 AgentOS**。

---

# AgentOS：完整 AI Agent 设计方案

## 0. 总纲：Agent 不是聊天机器人，而是有边界的行动系统

我的核心定义是：

> **AI Agent = 目标契约 + 状态机执行 + 技能资产 + 工具权限 + 评估进化。**

Claude 方案里的能力公式是：`Tools × Skills × Evolution Loop ÷ Constraints`，我认可这个方向，但我会改成更工程化的一版：

> **Agent Capability = Goal Contract × Context Quality × Skill Reliability × Tool Authority × Evaluation Feedback ÷ Risk Surface**

也就是说，Agent 的能力不只来自“模型聪明”或“工具多”，而来自五个东西同时成立：

| 模块                  | 含义                           |
| ------------------- | ---------------------------- |
| Goal Contract       | 目标被翻译成可验收的任务契约               |
| Context Quality     | 上下文、记忆、文件、外部信息可靠             |
| Skill Reliability   | 技能不是 prompt，而是可测试、可版本化的工作流资产 |
| Tool Authority      | 工具不是随便调用，而是带权限、风险等级、审计和回滚    |
| Evaluation Feedback | 每次任务都会变成评估数据和改进信号            |
| Risk Surface        | 风险面越大，能力实际可用性越低              |

当前主流工程生态也在往这个方向走：OpenAI 官方把 agents 定义为能计划、调用工具、与专家协作、保持足够状态以完成多步工作的应用，并强调当应用自己拥有 orchestration、tool execution、approvals 和 state 时才适合使用 Agents SDK；MCP 则把工具、资源、提示模板标准化为可组合的集成协议，但它本身不是安全边界。([OpenAI Developers][1])

---

# 1. 设计原则

## 原则一：目标必须契约化

用户说“帮我做一个市场调研”，这不是目标，只是意图。AgentOS 必须先生成一个 **Goal Contract**：

```json
{
  "goal_id": "g_20260427_001",
  "user_intent": "完成某行业市场调研",
  "deliverable": "一份 3000 字中文报告 + 数据来源列表",
  "acceptance_tests": [
    "包含市场规模、主要玩家、趋势、风险、结论",
    "每个关键事实至少有来源",
    "输出格式为 Markdown"
  ],
  "constraints": {
    "language": "zh-CN",
    "deadline": "same_session",
    "budget_tokens": 120000,
    "max_tool_calls": 80
  },
  "risk_tier": "R0_READ_ONLY",
  "requires_approval": false
}
```

没有 Goal Contract，就不要进入执行。否则 Agent 会“看起来很忙”，但无法判断是否真的完成。

---

## 原则二：LLM 负责自由推理，Kernel 负责确定执行

Claude 方案强调“最大化 LLM 自由度”，我同意，但要补一句：

> **自由只能发生在推理层，不能发生在执行层。**

LLM 可以自由提出计划、修改计划、解释失败、选择技能；但执行必须由 Agent Kernel 驱动，所有动作都要经过状态机和 ops-gate。

这也是为什么不能只靠 prompt 或普通 guardrail。即使是官方 Agents SDK 的工具 guardrails，也有适用范围限制，例如 handoff 和 hosted tools 不走同一套 function-tool guardrail pipeline；所以生产系统必须把安全边界放在框架外部的独立代码层。([OpenAI GitHub][2])

---

## 原则三：工具是能力入口，不是信任入口

MCP、HTTP、数据库、文件系统、浏览器、代码沙箱都只是 **capability provider**。真正的信任边界只有一个：

> **LLM / Skill / Tool Request → ops-gate → Execution Runtime**

MCP 官方文档也明确把 MCP 定位为让应用共享上下文、暴露工具和构建可组合 workflow 的协议，并提醒这种能力涉及任意数据访问和代码执行路径，必须处理用户同意、控制和隐私。([Model Context Protocol][3])

---

## 原则四：Skills 是软件资产，不是提示词资产

Claude 方案里“Skills ≠ 工具调用”的判断非常关键：Skill 应该封装某类问题的完整解决流程，包括何时用什么工具、异常怎么处理、输出格式是什么、如何判断成功。

我会进一步规定：**每个 Skill 都必须像软件包一样管理**，有版本、测试、依赖、权限、指标和回滚方案。

---

## 原则五：进化是变更管理，不是自我修改

self-evolution-governor 可以大胆想，但不能直接改生产系统。它只能生成 Proposal。Proposal 进入评估、审批、测试、灰度、回滚链路。

这和 Reflexion、Voyager 这类研究给出的方向一致：Reflexion 强调通过语言反馈和情节记忆改进行为，而不是直接改模型权重；Voyager 则把持续学习沉淀为可检索、可组合的技能库，并利用环境反馈和自验证改进技能。([arXiv][4])

---

# 2. 总体架构：11 层 AgentOS

| 层级  | 名称                       | 回答的问题           | 产物                             |
| --- | ------------------------ | --------------- | ------------------------------ |
| L0  | User Interface           | 用户到底想要什么？       | 原始请求、澄清信息                      |
| L1  | Goal Contract Layer      | 什么才算完成？         | 目标契约、验收条件                      |
| L2  | Context & Memory Layer   | 当前知道什么？哪些可信？    | 上下文包、记忆召回                      |
| L3  | Planner Layer            | 应该怎么做？          | 计划 DAG、风险分析                    |
| L4  | Agent Kernel             | 当前状态是什么？下一步合法吗？ | 状态转移、checkpoint                |
| L5  | Skill Runtime            | 有没有已验证的工作流？     | Skill 调用、Skill DAG             |
| L6  | Tool Gateway / MCP Layer | 具体连接哪个系统？       | Tool request                   |
| L7  | Ops-Gate                 | 这个动作能不能执行？      | allow / hold / reject          |
| L8  | Execution Runtime        | 如何执行、记录、回滚？     | stdout、artifact、evidence       |
| L9  | Evaluator / Verifier     | 是否通过验收？         | score、verdict、failure reason   |
| L10 | Evolution Governor       | 哪些东西该改进？        | proposal、eval case、skill patch |
| L11 | Observability Console    | 人如何审计和接管？       | traces、metrics、audit log       |

Claude 方案是 6 层架构：Goal、Plan、LLM Core、Skill+Tool、Evolution、Hard Boundary。这个分层适合表达理念，但生产上需要把 **状态持久化、评估器、可观测性、权限网关** 拆出来，否则实现时会混在一起。

---

# 3. 执行闭环：从 while loop 改成状态机

Claude 方案里的执行循环是 Perceive → Think → Plan → Act → Observe → Evaluate，未达目标则继续。这个逻辑是对的，但生产环境不能只靠“继续循环”。应该设计为确定状态机。

## 3.1 状态机

```text
RECEIVED
  ↓
CONTRACTING
  ↓
PLANNING
  ↓
RISK_ASSESSING
  ↓
SKILL_MATCHING
  ↓
APPROVAL_REQUIRED? ── yes ──> WAITING_APPROVAL
  ↓ no                         ↓
EXECUTING <────────────── APPROVED
  ↓
OBSERVING
  ↓
VERIFYING
  ↓
GOAL_MET? ── no ──> REPLANNING
  ↓ yes
DELIVERING
  ↓
LEARNING
  ↓
ARCHIVED
```

异常状态：

```text
HOLD        条件不满足，等待人或系统补充
REJECTED    ops-gate 拒绝
FAILED      执行失败且无法自动恢复
ROLLBACK    执行失败后回滚
ESCALATED   需要人工接管
ABORTED     超预算、超时、超风险
```

## 3.2 核心执行伪代码

```ts
async function runAgent(goalInput: UserInput) {
  const run = await kernel.createRun(goalInput);

  while (!run.isTerminal()) {
    const state = await checkpoint.load(run.id);

    const transition = await kernel.next(state);

    switch (transition.type) {
      case "CONTRACT":
        await contractLayer.buildOrRefine(state);
        break;

      case "PLAN":
        await planner.generatePlanDAG(state);
        break;

      case "EXECUTE_ACTION":
        const decision = await opsGate.authorize(transition.action, state);
        if (decision.status !== "ALLOW") {
          await kernel.moveTo(decision.toState, decision.reason);
          break;
        }
        await executor.execute(transition.action);
        break;

      case "VERIFY":
        await evaluator.verifyAgainstGoalContract(state);
        break;

      case "LEARN":
        await evolutionGovernor.consolidate(state);
        break;
    }

    await checkpoint.save(run.id, state);
  }

  return await deliverable.render(run.id);
}
```

这里的重点是：LLM 不直接控制循环。LLM 只提供候选计划、候选动作、候选解释。Kernel 决定状态转移是否合法。

LangGraph 这类框架的 checkpoint 思路很适合借鉴：它会在每一步保存 graph state，从而支持 human-in-the-loop、记忆、time travel debugging 和故障恢复。([LangChain Docs][5])

---

# 4. Goal Contract：目标层设计

Goal Contract 是 AgentOS 的第一核心。

## 4.1 Contract 字段

| 字段                  | 作用           |
| ------------------- | ------------ |
| `intent`            | 用户原始意图       |
| `deliverable`       | 最终交付物        |
| `acceptance_tests`  | 验收条件         |
| `constraints`       | 时间、语言、格式、预算  |
| `risk_tier`         | 风险等级         |
| `permissions`       | 允许使用的工具和范围   |
| `data_scope`        | 可读取/可写入的数据边界 |
| `stop_condition`    | 终止条件         |
| `escalation_policy` | 何时问用户、何时停止   |
| `success_score`     | 量化评分函数       |

## 4.2 风险等级

| 风险 | 含义                  | 是否需要审批      |
| -- | ------------------- | ----------- |
| R0 | 只读任务：搜索、总结、分析       | 否           |
| R1 | 可逆写入：草稿、临时文件、内部备注   | 可选          |
| R2 | 外部可见动作：发邮件、发消息、提交表单 | 是           |
| R3 | 生产系统、资金、权限、删除、配置变更  | 强制审批 + 双重验证 |
| R4 | 不允许的动作              | 直接拒绝        |

OWASP 2025 的 LLM 应用风险里专门列出了 prompt injection、sensitive information disclosure、supply chain、improper output handling、excessive agency、vector/embedding weaknesses、unbounded consumption 等问题，所以风险等级不能只看“工具名字”，还要看数据来源、权限范围、输出流向和资源消耗。([OWASP Gen AI Security Project][6])

---

# 5. Planner：混合规划，而不是单一 ReAct

ReAct 的价值是把 reasoning 和 acting 交替起来，让模型边思考边调用外部环境；但生产 Agent 不能只用 ReAct，因为 ReAct 容易变成局部最优和长循环。([arXiv][7])

我的设计是：

> **高层 Plan-then-Execute，低层 ReAct。**

也就是说：

1. 高层先生成任务 DAG。
2. 每个节点内部可以用 ReAct 做局部探索。
3. 每轮执行后由 Evaluator 判断是否继续、重试、回滚或重规划。
4. 超预算、超风险、连续失败时必须中止或升级。

## 5.1 Plan DAG 示例

```json
{
  "plan_id": "p_001",
  "nodes": [
    {
      "id": "n1",
      "type": "research",
      "goal": "收集市场规模数据",
      "skill": "web.research_with_citations",
      "risk_tier": "R0"
    },
    {
      "id": "n2",
      "type": "analysis",
      "goal": "提炼竞争格局",
      "depends_on": ["n1"],
      "skill": "market.competitor_analysis",
      "risk_tier": "R0"
    },
    {
      "id": "n3",
      "type": "artifact",
      "goal": "生成最终报告",
      "depends_on": ["n1", "n2"],
      "skill": "writing.report_synthesis",
      "risk_tier": "R1"
    }
  ]
}
```

---

# 6. Skill System：AgentOS 的真正护城河

## 6.1 Skill 的定义

Skill 不是“怎么调用一个 API”，而是：

> **针对某类任务的可验证 SOP。**

一个 Skill 包应该长这样：

```yaml
id: market.web_research_report
version: 2.1.0
status: stable
owner: agentos-core

trigger:
  intents:
    - 市场调研
    - 行业分析
    - 竞品分析
  embedding_query_examples:
    - "帮我研究一个行业"
    - "给我写一份竞品分析"

input_schema:
  topic: string
  region: string
  depth: enum[basic, standard, deep]

output_schema:
  report_markdown: string
  sources: array
  confidence: number

preconditions:
  - internet_access_enabled
  - citation_required

tool_capabilities:
  - search.fetch
  - file.write
  - memory.read

workflow:
  - collect_sources
  - rank_sources
  - extract_facts
  - synthesize_report
  - verify_citations

risk_tier: R0_READ_ONLY

eval:
  golden_cases:
    - evals/market_research/basic_cn.yaml
  success_metrics:
    citation_coverage: ">= 0.85"
    factual_consistency: ">= 0.8"
    user_revision_rate: "<= 0.25"

rollback:
  strategy: no_external_side_effect
```

## 6.2 Skill 生命周期

| 状态         | 含义        | 是否可生产使用 |
| ---------- | --------- | ------- |
| draft      | LLM 或人刚生成 | 否       |
| sandboxed  | 沙箱跑通      | 否       |
| evaluated  | 通过测试集     | 小流量     |
| beta       | 灰度中       | 可选      |
| stable     | 稳定版本      | 是       |
| deprecated | 被新版本替代    | 否       |
| blocked    | 有安全或质量问题  | 否       |

## 6.3 Skill Forge

Skill Forge 负责自动发现和生成 Skill，但不能自动上线。

触发条件：

* 同类任务出现 3 次以上；
* 某类任务连续失败；
* 某个工具链反复被临时组合；
* 人工修改同一类输出超过阈值；
* 某个任务耗时超过基准 2 倍。

产物不是代码直接落地，而是 Skill Proposal：

```json
{
  "proposal_type": "CREATE_SKILL",
  "target": "market.web_research_report",
  "reason": "过去 7 天出现 12 次市场调研任务，平均耗时较高",
  "expected_gain": {
    "latency_reduction": "30%",
    "tool_call_reduction": "25%"
  },
  "skill_manifest": "...",
  "test_plan": ["golden_case_001", "adversarial_case_003"],
  "rollback_plan": "disable skill version 2.1.0"
}
```

这比 Claude 方案里的“沙箱执行 3–5 次，成功率 >80% 入库”更稳。3–5 次可以作为初筛，但不能作为稳定上线标准。生产级 Skill 至少要经过：**沙箱测试、回归测试、对抗测试、灰度测试、线上监控**。

---

# 7. Tool Gateway：工具不是越多越好，而是权限越清越好

Claude 方案提出 10 个通用工具：Code Runner、HTTP Caller、Search + Fetch、File System、Memory R/W、Sub-Agent、Database、Notify Hub、Vision + OCR、Skill Forge。这个分类整体合理，但我会把它从“工具列表”升级成“能力提供商”。  

## 7.1 AgentOS 的 12 类 Capability Provider

| 能力                | 用途                       | 默认风险  |
| ----------------- | ------------------------ | ----- |
| `search.fetch`    | 搜索、抓取、网页读取               | R0    |
| `http.api`        | REST / GraphQL / Webhook | R1-R3 |
| `mcp.server`      | MCP 工具、资源、提示模板           | R1-R3 |
| `code.sandbox`    | Python/JS/Bash 沙箱        | R1-R3 |
| `file.artifact`   | 文件读写、文档生成                | R0-R2 |
| `data.query`      | SQL/NoSQL 查询             | R1-R3 |
| `memory.rw`       | 长短期记忆读写                  | R0-R2 |
| `vision.doc`      | OCR、图像、截图理解              | R0-R1 |
| `notify.approval` | 邮件、Slack、钉钉、审批           | R2    |
| `browser.ui`      | 浏览器或 GUI 操作              | R2-R3 |
| `scheduler.event` | 定时任务、事件触发                | R2-R3 |
| `agent.handoff`   | 子 Agent、专家 Agent         | R1-R3 |

OpenAI Agents SDK 里的 handoff 也是把任务转交给专门 Agent，适合不同专家处理不同子任务；但在 AgentOS 中，handoff 也必须继承父任务的权限边界和预算。([OpenAI GitHub][8])

## 7.2 每个 Tool 都必须声明元数据

```yaml
tool: http.api
name: salesforce.patch_lead
risk_tier: R3
reversible: false
requires_approval: true
allowed_methods: ["PATCH"]
scope:
  tenant: acme
  resource: leads
rate_limit:
  per_run: 10
  per_day: 100
precheck:
  - approval_token_present
  - payload_schema_valid
  - target_resource_exists
postcheck:
  - read_back_and_verify
audit:
  evidence_required: true
  store_stdout: true
  store_response: true
```

核心思想：

> **LLM 看到的不是“万能 HTTP 工具”，而是经过裁剪的 capability。**

---

# 8. Memory：记忆必须可追溯、可撤销、可过期

Claude 方案把 Memory R/W 放在核心工具里，这是对的。但我会加一个强规则：

> **Memory write 比 Memory read 危险。**

因为写错的记忆会污染未来所有任务。

## 8.1 五类记忆

| 类型                | 内容               | 生命周期   |
| ----------------- | ---------------- | ------ |
| Working Memory    | 当前任务状态           | 单次 run |
| Episodic Memory   | 历史任务轨迹、失败复盘      | 中长期    |
| Semantic Memory   | 稳定事实、实体关系        | 长期     |
| Procedural Memory | Skills、SOP、工具链经验 | 长期     |
| Preference Memory | 用户偏好、约束、禁忌       | 长期但需审批 |

## 8.2 记忆写入规则

每条记忆都必须有：

```json
{
  "memory_id": "m_001",
  "type": "preference",
  "content": "用户偏好中文输出，结构化回答",
  "source_run_id": "run_123",
  "confidence": 0.92,
  "sensitivity": "low",
  "ttl": "180d",
  "write_policy": "requires_user_confirmation",
  "created_at": "2026-04-27T10:00:00Z"
}
```

记忆的关键不是“存进去”，而是：

* 从哪来；
* 可信度多高；
* 会影响哪些任务；
* 什么时候过期；
* 用户能不能看见和删除；
* 冲突时听谁的。

---

# 9. Ops-Gate：唯一硬边界

这是整个系统最重要的安全结构。

Claude 方案已经提出 ops-gate 独立于 LLM，并强调“LLM 永远无法说服规则，因为规则不经过 LLM”。我完全同意，并且会把 ops-gate 设计成一个独立服务，而不是 Agent 内部函数。

## 9.1 ops-gate 输入

```json
{
  "run_id": "run_001",
  "actor": "agent:research_agent",
  "requested_action": {
    "capability": "http.api",
    "operation": "PATCH",
    "target": "crm.leads.123",
    "payload_hash": "sha256:..."
  },
  "goal_contract_id": "goal_001",
  "risk_tier": "R3",
  "approval_token": "approval_abc",
  "precheck_evidence": {
    "schema_valid": true,
    "rollback_plan": "not_available",
    "dry_run_result": "pass"
  }
}
```

## 9.2 ops-gate 决策

```json
{
  "decision": "HOLD",
  "reason": "irreversible_action_requires_human_approval",
  "required_next_step": "request_approval",
  "expires_at": "2026-04-27T11:00:00Z"
}
```

可能结果：

| 决策                    | 含义          |
| --------------------- | ----------- |
| ALLOW                 | 允许执行        |
| HOLD                  | 暂停，等待补充条件   |
| REJECT                | 拒绝执行        |
| REQUIRE_APPROVAL      | 需要人工审批      |
| REQUIRE_DRY_RUN       | 必须先 dry-run |
| REQUIRE_ROLLBACK_PLAN | 必须提供回滚方案    |
| ESCALATE              | 升级给人工接管     |

## 9.3 Evidence Bundle

每个高风险动作都要生成证据包：

```text
evidence/
  run.json
  goal_contract.json
  plan.json
  approval.json
  precheck.md
  main_stdout.txt
  main_stderr.txt
  postcheck.md
  artifacts/
  audit_hash.txt
```

Claude 方案里提到 append-only audit log，我会进一步加 hash chain：

```text
audit_event_hash = sha256(previous_hash + current_event_json)
```

这样任何人事后改日志都会被发现。

---

# 10. Evaluator：验收器，而不是“模型自我感觉完成了”

Evaluator 是 Claude 方案里最缺的一层。

AgentOS 必须把“完成了吗？”变成多种检查器组合：

| 检查器                  | 作用                 |
| -------------------- | ------------------ |
| Contract Verifier    | 是否满足 Goal Contract |
| Format Verifier      | 格式是否正确             |
| Source Verifier      | 引用、证据、来源是否齐全       |
| Tool Result Verifier | 工具调用结果是否可信         |
| Safety Verifier      | 是否越权、泄露、超范围        |
| Regression Verifier  | 是否破坏已有能力           |
| Human Review         | 高风险或低置信任务的人审       |

## 10.1 任务评分

```json
{
  "run_id": "run_001",
  "score": {
    "goal_completion": 0.92,
    "factuality": 0.86,
    "format": 1.0,
    "safety": 1.0,
    "cost_efficiency": 0.74,
    "latency": 0.68
  },
  "verdict": "PASS_WITH_MINOR_ISSUES",
  "issues": [
    "market_size_source_confidence_medium"
  ]
}
```

Evaluator 不一定是一个模型，可以是规则、测试、代码、模型评审、人审的组合。

---

# 11. Evolution Governor：自进化闭环

Claude 方案的 `self-evolution-governor` 是好想法，但要严格限制它的输出。它不能“改系统”，只能“提出变更”。

## 11.1 进化触发条件

* 连续失败；
* 用户多次手动纠正；
* 某 Skill 成功率下降；
* 工具错误率上升；
* 同类任务重复出现；
* 成本超过基准；
* 延迟超过基准；
* 安全 HOLD 频率异常；
* 记忆召回错误；
* 新工具出现但没有 Skill 适配。

## 11.2 Proposal Schema

```json
{
  "proposal_id": "prop_001",
  "target_type": "skill",
  "target_id": "market.web_research_report",
  "change_type": "upgrade",
  "summary": "增加来源可信度排序步骤",
  "evidence": {
    "failed_runs": ["run_11", "run_19", "run_23"],
    "pattern": "低可信来源被引用"
  },
  "expected_improvement": {
    "factuality": "+0.08",
    "user_revision_rate": "-0.15"
  },
  "risk": "R1",
  "test_plan": [
    "golden_market_001",
    "adversarial_fake_source_002"
  ],
  "rollback": "restore skill version 2.0.1"
}
```

## 11.3 进化流程

```text
Episode Trace
  ↓
Failure / Success Pattern Mining
  ↓
Proposal Generation
  ↓
Sandbox Test
  ↓
Regression Test
  ↓
A/B or Shadow Mode
  ↓
Canary Rollout
  ↓
Stable Promotion
  ↓
Old Version Retired
```

不能有“生成后直接覆盖”。Claude 方案也强调新策略不能直接覆盖旧策略，必须 A/B 验证；这一点必须保留。

---

# 12. Observability：没有可观测性，就没有可信 Agent

Agent 每一步都要可追踪。

OpenTelemetry 的 GenAI semantic conventions 已经覆盖 GenAI operations、events、metrics、model spans、agent spans 等信号，但目前仍标注为 Development，所以生产实现时要锁定版本并保留兼容层。([OpenTelemetry][9])

## 12.1 必须记录的事件

| 事件                 | 内容           |
| ------------------ | ------------ |
| `goal.created`     | 用户目标、约束、风险   |
| `plan.generated`   | 计划 DAG       |
| `skill.selected`   | 为什么选这个 Skill |
| `tool.requested`   | 工具请求         |
| `gate.decided`     | ops-gate 决策  |
| `tool.executed`    | 执行结果         |
| `verifier.scored`  | 验收评分         |
| `memory.written`   | 记忆写入         |
| `proposal.created` | 进化提案         |
| `approval.granted` | 人工批准         |

## 12.2 核心指标

| 指标                       | 说明             |
| ------------------------ | -------------- |
| Task Success Rate        | 任务成功率          |
| Contract Pass Rate       | 验收通过率          |
| Tool Error Rate          | 工具错误率          |
| Gate Hold Rate           | 被 gate 暂停比例    |
| Human Intervention Rate  | 人工介入率          |
| Skill Hit Rate           | 命中已有 Skill 的比例 |
| Replan Count             | 平均重规划次数        |
| Cost per Successful Task | 单成功任务成本        |
| P95 Latency              | 95 分位耗时        |
| Memory Correction Rate   | 记忆纠错率          |
| Rollback Rate            | 回滚率            |

---

# 13. 多 Agent 设计：少用“多角色扮演”，多用“职责分离”

我不会把多 Agent 设计成一堆人格角色，而是设计成专家服务：

| Agent              | 职责             |
| ------------------ | -------------- |
| Orchestrator Agent | 总控、拆任务、合并结果    |
| Research Agent     | 搜索、资料抽取、事实核验   |
| Coding Agent       | 写代码、跑测试、修 bug  |
| Data Agent         | SQL、报表、结构化分析   |
| Writing Agent      | 报告、邮件、文档       |
| Ops Agent          | 部署、监控、运维动作     |
| Critic Agent       | 评审、找漏洞、打分      |
| Security Agent     | 风险识别、权限审查      |
| Evolution Agent    | 复盘、生成 Proposal |

关键规则：

```text
子 Agent 不能继承全部权限。
子 Agent 不能绕过父级 Goal Contract。
子 Agent 的工具调用仍经过 ops-gate。
子 Agent 的输出必须回到 Orchestrator 汇总。
```

---

# 14. 技术实现栈

Claude 方案给了 GPT-4o、Claude 3.7、Gemini 2.0、LangGraph、AutoGen、Docker、pgvector、Neo4j、Redis、PostgreSQL、ClickHouse、Loki 等选项。这个方向可以保留，但我的实现会更偏“内核自研 + 框架可替换”。

## 14.1 推荐栈

| 模块            | 推荐                                       |
| ------------- | ---------------------------------------- |
| Agent Kernel  | 自研 TypeScript / Python 状态机               |
| Graph Runtime | LangGraph 或自研 DAG runner                 |
| LLM Provider  | 模型路由器，支持多模型                              |
| Tool Protocol | MCP + 内部 Tool Gateway                    |
| Policy Engine | OPA/Rego 或自研 policy DSL                  |
| State Store   | PostgreSQL                               |
| Checkpoint    | PostgreSQL / Redis                       |
| Vector Store  | pgvector                                 |
| Object Store  | S3 / MinIO                               |
| Audit Log     | ClickHouse / Loki / append-only Postgres |
| Sandbox       | Docker / Firecracker / E2B               |
| Queue         | Redis Streams / Temporal                 |
| Observability | OpenTelemetry + Grafana                  |
| Secret        | Vault / KMS                              |
| UI            | Next.js + workflow console               |

## 14.2 目录结构

```text
agentos/
  apps/
    console/                 # 人审、追踪、回滚、Skill 管理
  services/
    orchestrator/            # Agent Kernel
    ops-gate/                # 权限与安全边界
    evaluator/               # 验收与评分
    evolution-governor/      # 进化提案
    tool-gateway/            # MCP / HTTP / DB / File 适配
  packages/
    goal-contract/
    state-machine/
    skill-runtime/
    memory-store/
    policy-engine/
    telemetry/
  skills/
    research/
    writing/
    coding/
    ops/
    data/
  evals/
    golden/
    regression/
    adversarial/
  evidence/
  docs/
```

---

# 15. 数据模型

最少需要这些表：

| 表                | 用途          |
| ---------------- | ----------- |
| `runs`           | 每次任务        |
| `goal_contracts` | 目标契约        |
| `plans`          | 计划 DAG      |
| `steps`          | 状态机步骤       |
| `tool_calls`     | 工具调用        |
| `gate_decisions` | ops-gate 决策 |
| `approvals`      | 人工审批        |
| `artifacts`      | 产物          |
| `memories`       | 记忆          |
| `skills`         | Skill 主表    |
| `skill_versions` | Skill 版本    |
| `eval_cases`     | 测试集         |
| `eval_results`   | 测试结果        |
| `proposals`      | 进化提案        |
| `audit_events`   | 审计事件        |

---

# 16. 安全设计

AgentOS 的安全不是“让模型听话”，而是：

> **让模型即使不听话，也无法越权。**

## 16.1 必须防的风险

| 风险                       | 防法                                |
| ------------------------ | --------------------------------- |
| Prompt Injection         | 外部内容隔离、工具调用不信任模型文本                |
| Indirect Injection       | 网页/文件内容标记为 untrusted context      |
| Excessive Agency         | 最小权限、风险分级、审批                      |
| Insecure Output Handling | 输出进入下游前做 schema 校验                |
| Tool Abuse               | tool allowlist、rate limit、scope   |
| Memory Poisoning         | 记忆写入审批、来源和置信度                     |
| Cost Explosion           | token/tool/budget hard limit      |
| Supply Chain             | MCP server allowlist、签名、沙箱        |
| Data Leakage             | 数据分类、脱敏、访问日志                      |
| Irreversible Action      | 强制 human approval + rollback plan |

OWASP 也明确指出 prompt injection 可以导致敏感信息泄露、未授权访问、执行连接系统中的命令、影响关键决策等后果；这就是为什么 ops-gate 必须独立于模型。([OWASP Gen AI Security Project][10])

---

# 17. 产品界面设计

AgentOS 需要一个控制台，而不是只在聊天框里运行。

## 17.1 Console 页面

| 页面             | 功能            |
| -------------- | ------------- |
| Runs           | 查看所有任务        |
| Trace          | 查看某次任务每一步     |
| Plan DAG       | 可视化计划图        |
| Approvals      | 审批队列          |
| Evidence       | 查看证据包         |
| Skills         | Skill 库、版本、指标 |
| Memory         | 用户记忆、事实、偏好    |
| Proposals      | 进化提案          |
| Eval Dashboard | 测试集、通过率、回归    |
| Policy         | 权限规则          |
| Cost           | 成本和资源消耗       |

## 17.2 用户看到的不是“思维链”，而是“行动账本”

不要给用户展示内部链式推理。展示这些更有价值：

```text
我理解的目标：
我准备做的步骤：
我会使用的工具：
哪些步骤需要你批准：
当前进度：
已产出的证据：
最终结果是否通过验收：
```

---

# 18. MVP 路线图

## Phase 1：只读 Agent

目标：先做一个可靠的研究/分析/写作 Agent。

能力：

* Goal Contract；
* Search + Fetch；
* File Artifact；
* Memory read；
* Evaluator；
* 基础 trace。

不做：

* 外部写入；
* 自动发消息；
* 自动改系统；
* 自进化上线。

验收：

```text
20 个研究任务中，至少 16 个通过验收；
所有关键事实都有来源；
所有任务都有 trace；
无外部副作用。
```

---

## Phase 2：带审批的行动 Agent

新增：

* HTTP/API；
* Notify/Approval；
* ops-gate；
* evidence bundle；
* R1/R2/R3 风险分级；
* human-in-the-loop。

验收：

```text
所有 R2/R3 动作必须进入审批；
无审批 token 时无法执行；
每次执行都有 precheck/postcheck/evidence；
失败动作可定位原因。
```

---

## Phase 3：Skill Runtime

新增：

* Skill registry；
* Skill version；
* Skill test cases；
* Skill metrics；
* Skill selection；
* Skill rollback。

验收：

```text
高频任务能命中 Skill；
Skill 有版本和测试；
新 Skill 不能直接进入 stable；
失败 Skill 可自动降级或禁用。
```

---

## Phase 4：Evolution Governor

新增：

* Episode mining；
* failure clustering；
* proposal generation；
* regression eval；
* A/B；
* canary；
* promotion/rollback。

验收：

```text
进化只产生 Proposal；
Proposal 必须有 evidence、expected_gain、test_plan、rollback；
没有测试结果不得上线；
上线后指标变差自动回滚。
```

---

## Phase 5：多 Agent 与组织级权限

新增：

* specialist agents；
* sub-agent scoped permissions；
* org/team/project policy；
* secrets isolation；
* enterprise audit。

验收：

```text
子 Agent 不能越权；
不同项目数据隔离；
跨系统动作全部可审计；
高风险任务支持人工接管。
```

---

# 19. 和 Claude 方案的关键差异

| 维度            | Claude 方案     | 我的方案                                  |
| ------------- | ------------- | ------------------------------------- |
| 哲学            | 很强            | 保留                                    |
| 架构            | 6 层，偏概念       | 11 层，偏工程                              |
| 执行循环          | 目标未达成就循环      | 状态机 + checkpoint + budget             |
| Goal          | 目标驱动          | Goal Contract + acceptance tests      |
| Skills        | 动态资产          | 软件包化、测试化、版本化                          |
| Tools         | 10 个通用工具      | capability provider + 权限元数据           |
| ops-gate      | 硬边界           | 独立服务 + policy + evidence + hash audit |
| Memory        | Memory R/W    | 写入审批、TTL、来源、置信度                       |
| Evolution     | governor 生成提案 | Proposal → eval → canary → rollback   |
| Observability | 提到可观测         | 标准事件、指标、trace、console                 |
| 安全            | 边界清晰          | 加入风险分级、最小权限、注入防护                      |
| 评估            | 较弱            | Evaluator 成为核心层                       |

---

# 20. 最终版本一句话

Claude 方案的核心是：

> **完美不是功能多，而是职责清。**

我的最终版是：

> **真正可用的 AI Agent，不是“会想很多”，而是“目标可验收、动作可授权、过程可追踪、结果可评估、失败可进化”。**

[1]: https://developers.openai.com/api/docs/guides/agents "Agents SDK | OpenAI API"
[2]: https://openai.github.io/openai-agents-python/guardrails/ "Guardrails - OpenAI Agents SDK"
[3]: https://modelcontextprotocol.io/specification/2025-11-25 "Specification - Model Context Protocol"
[4]: https://arxiv.org/abs/2303.11366?utm_source=chatgpt.com "Reflexion: Language Agents with Verbal Reinforcement Learning"
[5]: https://docs.langchain.com/oss/python/langgraph/persistence "Persistence - Docs by LangChain"
[6]: https://genai.owasp.org/llm-top-10/ "LLMRisks Archive - OWASP Gen AI Security Project"
[7]: https://arxiv.org/abs/2210.03629 "[2210.03629] ReAct: Synergizing Reasoning and Acting in Language Models"
[8]: https://openai.github.io/openai-agents-python/handoffs/ "Handoffs - OpenAI Agents SDK"
[9]: https://opentelemetry.io/docs/specs/semconv/gen-ai/ "Semantic conventions for generative AI systems | OpenTelemetry"
[10]: https://genai.owasp.org/llmrisk/llm01-prompt-injection/ "LLM01:2025 Prompt Injection - OWASP Gen AI Security Project"
