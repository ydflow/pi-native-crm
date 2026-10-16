# 贡献说明（Contributions）

Pi Native CRM 由团队开发。本仓库发布该项目源代码，本文档说明本人在其中的负责范围。

## 我的角色

团队核心开发者之一。负责 **Agent 受控执行链路**——即"让 Agent 能够被信任地读写真实 CRM 业务数据"这条从工具契约到执行、故障恢复再到结果核验的完整链路。对应生产代码约 55,754 行。

## 我负责的模块

### 1. CRM 工具契约与统一授权

- `lib/mcp/server.ts`、`lib/mcp/auth.ts`（Bearer 令牌校验与 `deriveActor`，用 `role:` / `actor:ai_agent` / `agent_run:` 等 scope 装配受限身份）
- `lib/mcp/tools/**`（按域切分的工具目录，共 64 个 `McpToolDefinition`）
- `lib/mcp/tools/selecao-por-pacote.ts`：工具按授权范围装配，`critico` 风险能力永不随工具包一键启用；单 Agent 能力上限 `TETO_TOOLS_POR_AGENTE = 25`，与 `lib/ai/agents/validation.ts` 共用同一常量，界面显示与服务端拒绝同源
- `lib/agent-engine/edge/crm/mcp-tools.ts`、`lib/ai/runtime/tools.ts`：把工具契约装配进运行循环

### 2. 执行内核、Harness 与持久 Worker 分层

- `lib/agent-runtime/pi/**`：Pi 执行内核适配（模型与工具循环）
- `lib/agent-engine/agent/**`（含 `inbound-turn.ts`）、`lib/agent-engine/edge/llm/run-model-call.ts`、`lib/agent-engine/guardrails/**`：业务 Harness，承担客户作用域、权限与工具副作用治理
- `workers/agent-worker/main.ts`：持久 Worker 与队列租约、恢复
- `lib/agent-engine/queue/**`：任务领取、结算与租约身份

### 3. 取消与未知写入的故障语义

- `lib/ai/agents/workbench-job-lease.ts`：写入前 fail-closed 校验租约、运行状态与 Mission 状态，避免产生无法对账的孤儿写入
- `lib/agent-engine/queue/claim.ts`：保留微秒级 `acquired_at`，确保租约身份判断精确
- `lib/ai/integrations/mem0.ts`：外置记忆写入的三态对账（`write_outcome`: never_started / in_flight / confirmed / unknown；`sync_state`: pending / sending / synced / reconcile / deleted），墓碑与删除请求同语句提交，超时写入按内容 hash 对账而非重放

### 4. 外置知识（WeKnora）的双重授权与来源版本复核

- `lib/ai/integrations/weknora.ts`：只读页面接口的严格校验（`version`、`status: published`、`source_refs`、`deleted_at`），访问范围按知识库白名单 × Agent 授权范围双重限定
- `lib/ai/knowledge/**`：引用证据的规范化与命名空间白名单（`organization_wiki` / `organization_memory`）

### 5. 来源核验与版本化语义评测

- `lib/ai/agents/evidence-claims.ts`：核对工具观察所支持的来源与字段断言
- `lib/ai/evals/evidence-provenance.ts`：来源溯源审计
- `lib/ai/evals/semantic-judge.ts`：独立语义 Judge（`WORKBENCH_SEMANTIC_RUBRIC_REVISION = 2`，四个 rubric 维度）
- `lib/ai/evals/evaluate-run.ts`、`lib/ai/evals/saved-semantic-review.ts`：评测执行与基于材料指纹 + rubric 版本的评审复用

## 非本人负责范围（继承代码）

CRM 产品层（联系人、Inbox、Kanban、日程、财务、LGPD、i18n、渠道接入）、数据库基线与迁移、部署与运维脚本等，属于团队其他成员的工作与项目继承代码。

## 许可与版权

- 原版权与许可：见 [`LICENSE`](LICENSE)（MIT，Copyright (c) 2026 Rafael Melgaço）
- 本人修改部分：Copyright (c) 2026 ydflow
