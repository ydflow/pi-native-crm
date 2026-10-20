# M8ven 扫描复核与最小安全修复（2026-10-20）

本次审计针对当前工作树，以修改前 HEAD `6ae1723906fe2470ed6125471c06d0e1d34a96f6` 为基线。用户提供的 M8ven 结果为 2026-10-17 的 52/100、D 级；未提供原始完整报告，也未调用 M8ven 重新扫描，所以不宣称新的分数或等级。未提交、推送、创建 PR 或部署；另一份学习目录未修改。这里的结论是本地源码审查、依赖解析与验证结果，不是对部署实例已被入侵或不存在其他漏洞的证明。

## 1. 三项公告：版本命中与实际可达性分别判断

| 公告 | 官方受影响范围 / 最低修复版 | 本项目修复前证据及利用条件 | 结论 |
| --- | --- | --- | --- |
| [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) | next >=16.2.0、<16.3.6；修复版 16.3.6 | 实际安装与锁文件为 16.3.5。`app/icon.tsx` 调用 Node `next/og ImageResponse`，但 SVG 的属性、路径、颜色来自 `lib/branding/desenho.ts` 常量和固定尺寸。自定义品牌名称/色值用于另一个 div 分支，未流入 SVG。公告要求攻击者控制 Node ImageResponse 中的 SVG 内容、属性或样式。 | 版本告警真实；当前源码未发现完整可利用链。不能把“装有该包”直接写成“任意请求可 RCE”。升级至 16.3.8。 |
| [GHSA-cjq9-62q9-8jv4](https://github.com/advisories/GHSA-cjq9-62q9-8jv4) | next >=16.0.0、<16.3.8；修复版 16.3.8 | `next.config.ts` 有 Supabase remotePatterns，但同时 `images.unoptimized: true`。核对安装包 `next/dist/server/next-server.js`，该配置使优化入口返回 404。公告利用条件为启用图片优化且允许的远程 URL 可被攻击者操纵，例如 DNS 指向私网。 | 版本告警真实；当前配置阻断该入口，不能只看到 remotePatterns 就认定存在 SSRF。仍升级至 16.3.8。 |
| [GHSA-6qxp-vccf-f47h](https://github.com/advisories/GHSA-6qxp-vccf-f47h) | sdk >=1.12.0、<1.31.0；修复版 1.31.0 | 锁文件、直接安装及 Google GenAI/Pi 的依赖关联命中 1.30.0。项目只导入 SDK 的 McpServer 和 WebStandardStreamableHTTPServerTransport；未发现 HTTP OAuth 客户端 authProvider/withOAuth/auth/fetchToken 调用。公告需要持有已有 OAuth 凭据的客户端连接不可信 MCP 服务端。 | SDK 服务端不是此公告的受影响角色；当前应用可利用结论可能是角色误判，版本命中仍属事实。升级至 1.31.0。 |

以上属于依赖层命中、应用层利用条件未见成立；不是否认公告或把它们加入忽略列表。未来若增加 OAuth 客户端，还需按公告绑定 issuer/expectedIssuer，迁移或清除旧的无 issuer 凭据；单升级包并不覆盖所有迁移条件。本项目当前没有这条 OAuth 凭据路径。

新发现的严重公告也已处理：proxy-addr 通过 SDK 的 Express 子树进入，但应用没有 Express trust proxy 配置或 Express 服务入口；seroval 来自 Query Devtools，而 `app/providers.tsx` 将 Devtools 限制在 development，源码没有 seroval 反序列化调用。它们的包版本命中真实，不能据此认定生产已经具备对应 RCE/IP 伪造入口；仍在兼容版本内修复。

## 2. 依赖改动与最小范围

| 包 | 修改前锁定版本 | 修改后锁定版本 |
| --- | --- | --- |
| `next` | 16.3.5 | 16.3.8 |
| `@modelcontextprotocol/sdk` | 1.30.0 | 1.31.0 |
| `sharp` | 0.35.4 | 0.35.5 |
| `hono` | 4.13.1 | 4.13.13 |
| `js-yaml` | 4.3.1 | 4.3.2 |
| `brace-expansion` | 1.1.18, 5.0.9 | 1.1.21, 5.0.12 |
| `fast-uri` | 3.1.7 | 3.1.9 |
| `proxy-addr` | 2.0.7 | 2.0.8 |
| `seroval` | 1.5.6 | 1.6.11 |
| `source-map-js` | 1.2.1 | 1.2.2 |
| `undici` | 7.29.1, 8.9.0 | 7.29.1, 8.12.3 |
| `ip-address` | 10.4.0 | 10.7.4 |

直接依赖范围只修改 `next: ^16.3.8` 和 `@modelcontextprotocol/sdk: ^1.31.0`，实际安装分别为 16.3.8 和 1.31.0。其余为已命中公告的传递依赖安全下限；brace-expansion 的 1.x/5.x 和 undici 的 7.x/8.x 保持分树，原有 PDF hyphenate 补丁保留。没有执行 audit fix、全量 update，未修改 React、Pi 或 AI SDK 的直接版本。

pnpm 定向解析曾刷新无关 Webpack 子树并产生 peer 不匹配；最终锁文件保留原有不相关快照，并按新 SDK 的官方 dependencies 范围复核保留的旧子依赖，再由 pnpm 正规化和冻结安装验证。没有手造完整性哈希或替换为自编造的修复包。仅有两个直接依赖的版本号改变，其余直接依赖变化只涉及 Next/SDK 的 peer 关联。

检查器为项目指定 pnpm 9.15.9，Node v24.19.0、Windows。系统 pnpm 11 会忽略本项目 package.json 中的 overrides/patchedDependencies，因此未用它安装或修改锁文件。当前环境验证不等于 Node 22/Linux 镜像验证。

`pnpm outdated --prod` 返回 41 个过期条目。例如 ai 7.0.103、Anthropic adapter 4.0.16、OpenAI adapter 4.0.68、Supabase JS 2.116.0、React 19.3.0 有更新；“有更新”不等于“有漏洞”，这些未命中本轮公告的直接依赖保持原样，建议另做兼容性维护。

## 3. 63 个 MCP 工具的实际行为与注解

采用 [MCP ToolAnnotations 规范](https://modelcontextprotocol.io/specification/2025-06-18/schema#toolannotations)。R=readOnlyHint，D=destructiveHint，I=idempotentHint，O=openWorldHint，T/F 为 true/false。D 包括覆盖、移除、取消和关闭已有状态，不局限于 SQL DELETE。O 计入直接外部调用和已存在的后台发送链，也计入面向外部事件的公开入口；固定的组织数据库仍是封闭的数据域。通用调用审计不改变只读工具的业务分类。I 表示重复调用无新增业务效果，不表示查询结果永远相同。

逐项检查 handler 及其委托服务。33 项只读、30 项可能写入，23 项可能与外部系统交互；值没有从工具名或 category 自动推断。提案和记忆写入不能标成只读；可选去重键、有时限的去重和活跃实例唯一不能冒充无条件幂等。恢复 AI 的描述虽然写了“幂等”，实现仍重新写入时间/检查点并发出事件，因此注解保守设为 false，未修改原业务行为或既有说明。

| 工具 | R | D | I | O | 实际行为依据 |
| --- | --- | --- | --- | --- | --- |
| `crm_list_event_types` | T | F | T | F | 读取本组织服务类型。 [源码](../../lib/mcp/tools/agendamento.ts) |
| `crm_find_free_slots` | T | F | T | F | 读取本地可用时段及已同步的 Google 占用缓存。 [源码](../../lib/mcp/tools/agendamento.ts) |
| `crm_list_appointments` | T | F | T | F | 读取本地预约，不主动同步外部日历。 [源码](../../lib/mcp/tools/agendamento.ts) |
| `crm_book_appointment` | F | F | F | T | 创建预约；可触发 Google/Meet、提醒和后台流程。 [源码](../../lib/mcp/tools/agendamento.ts) |
| `crm_find_and_book_appointment` | F | F | F | T | 查空闲后调用同一预约处理器；没有通用重放凭证。 [源码](../../lib/mcp/tools/agendamento.ts) |
| `crm_reschedule_appointment` | F | T | F | T | 替换预约时间或备注；可同步日历并触发流程。 [源码](../../lib/mcp/tools/agendamento.ts) |
| `crm_cancel_appointment` | F | T | T | T | 取消并释放时段；已取消时不重复转换。 [源码](../../lib/mcp/tools/agendamento.ts) |
| `crm_confirm_appointment` | F | T | F | T | 改变预约状态或备注；携带备注重试仍会写入修订。 [源码](../../lib/mcp/tools/agendamento.ts) |
| `crm_set_appointment_outcome` | F | T | F | T | 由人确认出席或缺席；可触发后续恢复流程。 [源码](../../lib/mcp/tools/agendamento.ts) |
| `crm_list_contact_orders` | T | F | T | F | 读取已入库订单，不调用外部商店。 [源码](../../lib/mcp/tools/comercio.ts) |
| `crm_search_products` | T | F | T | F | 查询及排序本地商品，不调用外部商店。 [源码](../../lib/mcp/tools/comercio.ts) |
| `crm_search_contacts` | T | F | T | F | 按组织查询联系人。 [源码](../../lib/mcp/tools/contacts.ts) |
| `crm_get_contact` | T | F | T | T | 读取本地联系人事实；可调用已启用的 Mem0 排序。 [源码](../../lib/mcp/tools/contacts.ts) |
| `crm_propose_contact_field` | F | F | F | F | 持久化待人工确认的提案；不直接修改联系人；提案可过期。 [源码](../../lib/mcp/tools/contacts.ts) |
| `crm_list_conversations` | T | F | T | F | 读取会话、负责人和排队位置。 [源码](../../lib/mcp/tools/conversations.ts) |
| `crm_get_conversation` | T | F | T | F | 读取会话详情和队列位置。 [源码](../../lib/mcp/tools/conversations.ts) |
| `crm_get_conversation_history` | T | F | T | T | 读取消息和检查点；其已确认记忆读取可间接调用 Mem0。 [源码](../../lib/mcp/tools/conversations.ts) |
| `crm_list_available_attendants` | T | F | T | F | 读取排班、容量和在线状态。 [源码](../../lib/mcp/tools/escalacao.ts) |
| `crm_list_human_cases` | T | F | T | F | 读取人工工单和未结数量。 [源码](../../lib/mcp/tools/escalacao.ts) |
| `crm_get_human_case` | T | F | T | F | 读取工单、时间线和人工处理摘要。 [源码](../../lib/mcp/tools/escalacao.ts) |
| `crm_add_case_note` | F | F | F | F | 每次追加工单事件，没有去重键。 [源码](../../lib/mcp/tools/escalacao.ts) |
| `crm_close_human_case` | F | T | F | T | 关闭工单并发出被跟进流程消费的事件；不承诺通用重放。 [源码](../../lib/mcp/tools/escalacao.ts) |
| `crm_resume_ai_attendance` | F | T | F | T | 重新启用 AI；已经恢复时仍更新时间、检查点及事件。 [源码](../../lib/mcp/tools/escalacao.ts) |
| `crm_search_knowledge` | T | F | T | T | 可查询外部 Wiki，且把问题发送到嵌入服务。 [源码](../../lib/mcp/tools/evolucao.ts) |
| `crm_list_knowledge_sources` | T | F | T | F | 读取本地来源，不进行导入或重建索引。 [源码](../../lib/mcp/tools/evolucao.ts) |
| `crm_list_improvement_proposals` | T | F | T | F | 只读改进提案，不批准或发布。 [源码](../../lib/mcp/tools/evolucao.ts) |
| `crm_get_org_memory` | T | F | T | F | 读取组织文档和记忆条目。 [源码](../../lib/mcp/tools/evolucao.ts) |
| `crm_save_org_memory` | F | F | F | F | 每次插入新的组织记忆条目。 [源码](../../lib/mcp/tools/evolucao.ts) |
| `crm_assign_conversation` | F | T | T | F | 以状态比较和原子 RPC 分配或释放负责人；同目标重放不重复分配。 [源码](../../lib/mcp/tools/governance.ts) |
| `crm_manage_tags` | F | T | F | F | 可以新增或移除标签，并重新写入行和审计。 [源码](../../lib/mcp/tools/governance.ts) |
| `crm_get_queue_status` | T | F | T | F | 读取队列快照。 [源码](../../lib/mcp/tools/governance.ts) |
| `crm_request_human_handoff` | F | T | F | T | 静音 AI、改变分配并通知客户；只有五秒去重窗口。 [源码](../../lib/mcp/tools/handoff.ts) |
| `crm_list_leads` | T | F | T | F | 读取商机、负责人和阶段。 [源码](../../lib/mcp/tools/leads.ts) |
| `crm_get_lead` | T | F | T | F | 读取本组织商机。 [源码](../../lib/mcp/tools/leads.ts) |
| `crm_create_lead` | F | F | F | T | 插入商机并发出 lead.created；后台自动化可对外发送。 [源码](../../lib/mcp/tools/leads.ts) |
| `crm_update_lead` | F | T | F | T | 覆盖字段并发出更新或标签事件；可触发自动化。 [源码](../../lib/mcp/tools/leads.ts) |
| `crm_move_lead_stage` | F | T | F | T | 修改阶段和位置、追加活动；可触发自动化与跟进。 [源码](../../lib/mcp/tools/leads.ts) |
| `crm_send_whatsapp_message` | F | T | F | T | 发送消息并清零会话未读等状态；去重键可选且有有效期。 [源码](../../lib/mcp/tools/messages.ts) |
| `crm_list_stages` | T | F | T | F | 读取阶段。 [源码](../../lib/mcp/tools/operacao.ts) |
| `crm_create_stage` | F | F | F | F | 新增阶段；同名校验不是长期重放凭证。 [源码](../../lib/mcp/tools/operacao.ts) |
| `crm_update_stage` | F | T | F | F | 修改名称、顺序或终结属性，可能撤销其他阶段的终结属性。 [源码](../../lib/mcp/tools/operacao.ts) |
| `crm_archive_stage` | F | T | F | F | 归档阶段并可能迁移其商机，改变已有业务状态。 [源码](../../lib/mcp/tools/operacao.ts) |
| `crm_list_tags` | T | F | T | F | 读取标签词表和计数。 [源码](../../lib/mcp/tools/operacao.ts) |
| `crm_list_message_templates` | T | F | T | F | 读取模板，不发送。 [源码](../../lib/mcp/tools/operacao.ts) |
| `crm_render_message_template` | T | F | T | F | 读取本地数据并渲染文本，不发送。 [源码](../../lib/mcp/tools/operacao.ts) |
| `crm_list_webhook_sources` | T | F | T | F | 读取入口元数据，不返回签名秘密。 [源码](../../lib/mcp/tools/operacao.ts) |
| `crm_list_webhook_source_events` | T | F | T | F | 读取接收记录，不重放摄取。 [源码](../../lib/mcp/tools/operacao.ts) |
| `crm_create_webhook_source` | F | F | F | T | 创建立即启用的公开摄取入口，允许后续外部事件进入。 [源码](../../lib/mcp/tools/operacao.ts) |
| `crm_set_webhook_source_active` | F | T | F | T | 启停公开摄取入口；同值仍写入时间和作者。 [源码](../../lib/mcp/tools/operacao.ts) |
| `crm_list_automation_rules` | T | F | T | F | 读取规则摘要，不执行动作。 [源码](../../lib/mcp/tools/operacao.ts) |
| `crm_list_automation_runs` | T | F | T | F | 读取运行历史，不重放动作。 [源码](../../lib/mcp/tools/operacao.ts) |
| `crm_set_automation_rule_active` | F | T | F | T | 启停可发送消息或 Webhook 的规则；同值仍写入时间和作者。 [源码](../../lib/mcp/tools/operacao.ts) |
| `crm_list_team_members` | T | F | T | F | 读取成员，不改变角色。 [源码](../../lib/mcp/tools/operacao.ts) |
| `crm_list_pipelines` | T | F | T | F | 读取本地销售管线和阶段。 [源码](../../lib/mcp/tools/pipelines.ts) |
| `crm_list_privacy_requests` | T | F | T | F | 读取隐私请求，不执行导出或匿名化。 [源码](../../lib/mcp/tools/privacidade.ts) |
| `crm_schedule_followup` | F | F | F | T | 创建可能稍后发送的任务；相对小时依赖每次调用时刻。 [源码](../../lib/mcp/tools/retencao.ts) |
| `crm_cancel_followup` | F | T | T | F | 取消尚未执行的内部任务；重复调用不再取消或新增任务。 [源码](../../lib/mcp/tools/retencao.ts) |
| `crm_list_followups` | T | F | T | F | 读取内部跟进任务，不执行。 [源码](../../lib/mcp/tools/retencao.ts) |
| `crm_list_at_risk_leads` | T | F | T | F | 读取本地风险数据，不创建提案或发送。 [源码](../../lib/mcp/tools/retencao.ts) |
| `crm_close_demand` | F | T | T | T | 关闭商机；相同结果不重复转换；事件可触发推送和转化发送。 [源码](../../lib/mcp/tools/retencao.ts) |
| `crm_propose_reactivation` | F | F | F | F | 创建会过期的本地提案；发送另需人工批准。 [源码](../../lib/mcp/tools/retencao.ts) |
| `crm_enroll_followup_flow` | F | F | F | T | 创建后续可对外发送的跟进；仅活跃实例唯一，不是永久去重。 [源码](../../lib/mcp/tools/retencao.ts) |
| `crm_start_conversation_and_send` | F | T | F | T | 可能重开会话并发送消息；可选去重键不保证无条件幂等。 [源码](../../lib/mcp/tools/start-conversation.ts) |

`lib/mcp/types.ts` 将四项布尔注解设为必填并引用 SDK 类型；`lib/mcp/server.ts` 在 registerTool 时透传到 tools/list。角色、scope、tenant、输入校验和处理器均保留。独立 TypeScript AST 比较确认 15 个工具模块去除 annotations 和注释后，业务语法与基线一致；注解只是提示，不授予权限。

新增 `lib/mcp/server-annotations.test.ts` 用真实 SDK 的 InMemoryTransport/Client 获取 tools/list，检查完整清单、四项注解与不同风险行为，并确认缺少 mcp:write 的调用仍拒绝。新测试在补丁前两项均失败（缺注解），补丁后包含在定向测试中通过；没有为此提交代码或弱化断言。

## 4. CRON_SECRET / FEISHU_TENANT_KEY 数据流

- `process.env.CRON_SECRET` 只在 `lib/env.ts` 的 production 分支读取和 trim，再赋给 `env.INTERNAL_CRON_SECRET`，由 `lib/auth/cron-auth.ts` 和 Cron 入口校验 Bearer/x-cron-secret；未发现读取该值后发送给第三方的应用路径。`scripts/qa-wave-13-07.ts` 中同名局部常量读取的是 INTERNAL_CRON_SECRET，并非另一处 process.env.CRON_SECRET 读取。
- 开发 Cron/QA 脚本确会将 INTERNAL_CRON_SECRET 或 INTERNAL_SECRET 作为认证头发给配置的 CRM/QA URL；这是必要的内部调用，不是任意用户输入目标。生产 scheduler 发送的是 INTERNAL_SECRET。配置者仍需保证目标域名可信，且认证头不被反向代理写入明文日志；本轮未修改这些运行语义。
- `FEISHU_TENANT_KEY` 是租户标识，不能和 app_secret/tenant_access_token 等同。`internal-question-tools.ts`、recipients 路由只把它放进参数化 SQL 的组织/租户筛选；返回 CRM 用户 ID/姓名，不返回该环境值。
- binding/events 路由与 `feishu-binding.ts` 在服务端核对租户与组织、存储绑定并验证事件；`feishu-question.ts` 将租户标识放入本地 outbox 与加密 AAD；`feishu-question-job.ts` 发送前再次匹配配置租户和组织权限。调用 `feishu-send.ts` 时只传应用凭据、接收者、正文和去重 UUID，没有传 tenant key。
- 飞书必要外发是发往固定 open.feishu.cn 的应用鉴权和经授权的业务消息。租户标识未被加入模型输入、公开响应或该发送载荷。参考 [飞书访问凭据说明](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/authentication-management/access-token/tenant_access_token)。
- private 环境值没有放到 NEXT_PUBLIC_* 或 Next 的 env 注入配置。构建静态包对两个变量名的检索：修改前无命中；修改后 无命中。Sentry 的 `lib/sentry/scrub.ts` 会去除 authorization/cookie/token/secret 等请求头；未据此假设任意日志内容都能自动脱敏。

结论：在已审查的源码与本地产物中未发现这两个值泄漏或无关外发，无需修改它们的读取/传递业务。没有读取另一份目录的真实 .env，也没有将真实凭据写入报告。部署服务器、外部代理日志、数据库实际权限和 Git 历史中的泄漏均未在本轮证明不存在。

## 5. 修复前后检查

所有 pnpm 命令使用 9.15.9；测试/构建设置 SENTRY_DSN=off、NEXT_TELEMETRY_DISABLED=1；没有启动实际 Cron、向飞书发信或调用付费模型。完整命令输出在本机 `D:\crm\security-audit-2026-10-20\`，不把外部文件当作公共 CI 证据。

| 检查 | 修复前 | 修复后 |
| --- | --- | --- |
| install --frozen-lockfile | exit 0 | exit 0 |
| typecheck | exit 0 | exit 0 |
| build | exit 0 | exit 0 |
| lint | exit 0，0 errors / 474 warnings | exit 0，0 errors / 474 warnings，无新增 |
| test:unit --reporter=verbose（完整现有单测） | exit 1；Test Files  29 failed  /  1295 passed (1324)；Tests  117 failed  /  12828 passed  /  1 expected fail  /  14 skipped (12960)；Errors  1 error；Duration  983.91s (transform 45.83s, setup 435.15s, import 965.04s, tests 819.77s, environment 1387.21s) | exit 1；Test Files  29 failed  /  1296 passed (1325)；Tests  117 failed  /  12831 passed  /  1 expected fail  /  14 skipped (12963)；Errors  1 error；Duration  870.38s (transform 39.58s, setup 379.92s, import 817.57s, tests 763.02s, environment 1217.36s) |
| 新协议回归测试 | 2 failed（修复前负对照） | 最终源码单独重跑：Test Files  1 passed (1)；Tests  2 passed (2)；Duration  7.39s (transform 2.39s, setup 373ms, import 5.69s, tests 70ms, environment 1.03s)；也包含在最终全量单测中 |
| MCP / 相关边界定向测试 | 未单独采集 | Test Files  11 passed (11)；Tests  31 passed (31)；Duration  10.25s (transform 3.99s, setup 5.41s, import 7.31s, tests 595ms, environment 20.75s)，exit 0 |
| audit --json | 3 critical / 13 high / 20 moderate / 4 low，exit 1 | 0 critical / 1 high / 0 moderate / 0 low，exit 1 |
| audit --prod --json | 3 critical / 7 high / 14 moderate / 1 low，exit 1 | 0 条公告，exit 0 |
| lint:channels / lint:role-rank | 未单独采集 | exit 0 / 0 |
| release:conferir / git diff --check | 不适用 | exit 0 / exit 0 |

完整单测失败文件比较：新增 0 个，消失 0 个；失败用例比较：新增 0 项，消失 0 项。比较详情在 test-comparison.json。

最终完整单测比基线增加 1 个文件、3 个通过用例：新增协议测试 2 项，以及新增 .changes 片段触发的既有参数化校验 1 项。基线原有的通过用例没有消失；117 项失败名称、29 个失败文件以及 14 项跳过均与基线一致。两次均另有 1 项 expected fail 和 1 个 spawn bash ENOENT 未处理异常，不能把 exit 1 写成全绿。详细比较在 final-test-detail-comparison.json。

修复前已经失败的文件包括：
- `components/agenda/DiasBloqueados.test.tsx`
- `tests/unit/catalogo-de-ensaio-espelha-o-vocabulario.test.ts`
- `tests/unit/cercas-sao-selecionadas-pelo-import.test.ts`
- `tests/unit/confianca-do-handoff-nao-e-similaridade.test.ts`
- `tests/unit/e2e-cria-o-dono-que-a-spec-exige.test.ts`
- `tests/unit/e2e-parte-4-fala-com-os-servicos-do-runner.test.ts`
- `tests/unit/e2e-so-aceita-pulo-declarado.test.ts`
- `tests/unit/executor-proprio-so-roda-o-que-e-nosso.test.ts`
- `tests/unit/followups-de-demonstracao-sao-possiveis.test.ts`
- `tests/unit/gerar-env-e2e-extensoes.test.ts`
- `tests/unit/guarda-da-release-confere-identidade.test.ts`
- `tests/unit/guarda-da-release-reconhece-o-corte.test.ts`
- `tests/unit/imagens-ok-so-aceita-pulo-declarado.test.ts`
- `tests/unit/indice-de-contato-ignora-ficha-mesclada.test.ts`
- `tests/unit/invariants-so-aceita-o-piso-declarado.test.ts`
- `tests/unit/lgpd-pdf-meet.test.ts`
- `tests/unit/lgpd-pdf-replies.test.ts`
- `tests/unit/main-sem-migration-duplicada.test.ts`
- `tests/unit/namespace-das-imagens.test.ts`
- `tests/unit/painel-nao-promete-o-que-nao-cumpre.test.ts`
- `tests/unit/passagem-motivo-em-portugues.test.ts`
- `tests/unit/performed-at-um-relogio-so.test.ts`
- `tests/unit/pi-runtime-architecture.test.ts`
- `tests/unit/pr-alcanca-o-e2e.test.ts`
- `tests/unit/pr-mexe-na-imagem.test.ts`
- `tests/unit/pr-mexe-no-piso-do-postgres.test.ts`
- `tests/unit/rascunho-superado-nao-e-regravado.test.ts`
- `tests/unit/release-chega-na-lp.test.ts`
- `tests/unit/tailwind-tokens.test.ts`

中间轮 unit-after.log 保留了一次运行中修改注解造成的新旧模块缓存混用失败；它不作为最终验收结果。最终轮使用 unit-final.log，开始时记录的 20 个源码、测试和依赖文件哈希在结束后全部一致（final-source-hash-check.json）。最终构建后的 232 个 .next/static 文件也已逐一检索，两个环境变量名无命中（final-evidence-summary.json）；变量名检索仅是源码审查的补充，不等同于对真实历史凭据进行泄漏扫描。

失败不能全部归因于系统环境：其中有 Bash/子进程不可用、Windows 路径分隔符假设，以及原有 UI/fixture 断言失败。它们在修改产品代码之前已经出现。未弱化测试、延长超时、跳过失败用例或修改无关功能。

没有执行 test:db、test:e2e 或单独的 test:shell：当前未准备 Docker/数据库/完整应用环境，PATH 未找到 docker/bash（另发现 Git 自带的 bash.exe 存在，未通过更改 PATH 重跑基线）；本补丁未触及 schema、UI、安装脚本、Dockerfile 或 compose。完整单测不能代替这些验证，也不能代替真实 OAuth/飞书/生产验证。

## 6. 修改文件与原因

- `package.json`、`pnpm-lock.yaml`：两个直接依赖的兼容修复，以及已命中公告的传递依赖安全下限与解析图。
- `lib/mcp/types.ts`：四项注解必填，防止新增工具遗漏。
- `lib/mcp/server.ts`：将真实注解传递给 MCP 客户端；保留权限校验。
- 15 个 `lib/mcp/tools/*.ts` 模块：63 项逐项注解及依据，具体文件见上表；不改变输入、处理器、scope/role/category。
- `lib/mcp/server-annotations.test.ts`：协议层验证注解实际可见、区分真实行为，并保留拒绝未授权写入的证明。
- `.changes/seguranca-dependencias-e-anotacoes-mcp.md`：按仓库规则记录依赖安全修复和 MCP 元数据变化；不改 CHANGELOG。
- 本报告：保存审计范围、版本、调用条件、工具矩阵、验证和未覆盖项。

## 7. 剩余风险与 PR 建议

1. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)：braces 3.0.3 的高危递归耗尽公告没有修复版。仅在 @types/jest→expect→jest-message-util→micromatch 和 eslint-config-next→fast-glob→micromatch 的开发依赖路径；生产依赖 audit 为零。没有删除工具链、虚构替代版本、加入 ignore 或宣称总体安全检查全绿。
2. 现有完整单测并非全绿；应按失败清单在 Linux/Node 22 CI 中复核，区分环境假设和真实既有缺陷。没有生产镜像、数据库、浏览器端到端或真实第三方联调证明。
3. 注解是客户端提示；它们不是运行时访问控制，也不会阻止不可信 MCP 客户端忽略风险信息。原有角色、scope、tenant 校验继续负责授权。
4. 依赖审计覆盖已公布且被 registry 记录的包版本公告，不覆盖所有业务漏洞，也不能证明过往无泄漏。CRON/飞书配置域名和外围日志仍由部署环境保证。

建议将本补丁作为聚焦的安全修复 PR 供审核，但当前不能标记“全绿、可直接合并”：保留未修复 braces 和基线测试失败的说明，先取得 Linux CI/所需验证结果。未自动提交、推送或创建 PR，等待用户审核。

## 8. 审核后进入 PR 阶段（2026-10-20）

前述“未提交、推送或创建 PR”描述的是本地审计交付时点。用户随后明确授权创建独立分支、提交、推送和创建 PR，并要求等待 CI；合并前仍须等待用户再次确认。

- PR 基线更新到 `origin/main` 的 `0d3ce10e27c2a34cc6bbcb130d1dfad70b92ee79`。它比原审计基线仅增加 README clone 地址与 package.json 作者、贡献者和许可证信息；这些现有更改完整保留，不纳入本安全 PR 的 diff。业务源码及依赖图未因同步基线变化。
- 分支为 `fix/security-m8ven-dependencies-mcp`，目标为 `ydflow/pi-native-crm:main`，活动 GitHub 账号为 `ydflow`。重新核对 63 项注解及原审核文件哈希；除 package.json 合并上述已有元数据外，产品源码、回归测试和锁文件均与本地最终验收一致。15 个工具模块的独立 AST 比较再次确认输入、处理器、角色、scope 和 category 不变。
- 新增及改动内容的秘密模式检查无命中，未纳入 .env、凭据、构建产物或审计临时脚本。该模式检查不能替代所有形式的秘密检测。
- 现有 `.github/actions/preparar-node` 已提供 Linux / Node 22、pnpm 9.15.9 和冻结安装；现有 `perf.yml` 的 `build-and-size` 提供生产构建。`ci.yml` 在结构测试失败后会跳过类型检查，因此在现有 `perf.yml` 增加独立 `security-regression` job，运行类型检查、MCP 注解/授权与 Cron/飞书边界定向测试、生产依赖审计，不削弱原 CI gate。继承只读 contents 权限，不访问部署秘密，不发布镜像。
- PR 准备阶段冻结安装再次通过；定向测试及现有工作流守卫测试共 16 文件、88 用例通过；生产依赖审计仍为零。原完整单测的 117 项失败名称及 29 个失败文件与修复前基线完全一致，详情仍保存在本地 test-comparison.json。
- 远端主分支已有 Linux 失败：CI run `39395704786` 的结构测试失败及 `spawnSync rg ENOENT`，E2E run `39395704694` 也失败；主分支 perf run `39395704775` 成功。这些不是本 PR 的通过证明。PR 精确 head 的 Linux / Node 22 结果待 GitHub Actions 运行，最终以 PR checks 和正文补充为准。发现新增失败或安全回归时停止后续修改与合并。

本阶段未部署、未修改业务/UI、未删除功能；不会自动合并。

## 9. CI 登记补齐与合并授权（2026-10-20）

用户随后明确授权完成后合并；本授权不意味着忽略失败检查、删除测试或绕过 CI。第 8 节记录的是当时尚待合并确认的阶段状态。

- 首个 PR head `058d15b371c172ab59278355be9c8518bb2cf11d` 的完整本地单测为 1,325 文件、12,963 用例：118 失败 / 12,830 通过 / 1 expected fail / 14 skipped，另有原有 `spawn bash ENOENT`。逐项比较原基线：原有 117 个失败名称全部保留，唯一新增失败是新 CI job 未登记在 `GATILHO_ESPERADO`。检测后已停止并报告，用户确认继续后才修复。
- 最小修复只在 `tests/unit/gatilho-dos-jobs-de-entrega.test.ts` 登记 `perf.yml::security-regression`，真实声明 `condicao: null` 及其类型、MCP 授权/注解、Cron/飞书边界和生产依赖审计职责。断言、workflow 条件、权限、产品代码和 UI 不变。修复前失败用例是负对照；补齐后该文件全部 23 项通过，含新增 job 的参数化条件校验。
- 登记守卫与全部安全定向用例独立复验：14 文件 / 81 用例通过。扩展的 17 文件 / 102 用例在原 PATH 下仍有 7 项既有 Bash 相关失败；仅为诊断加入 Git Bash 后为 101 通过 / 1 失败，剩余既有 executor 守卫断言未改。环境不同的两次运行不用于替换原 117 项基线。
- Linux / Node 22.23.3、pnpm 9.15.9：head `058d15b` 的 perf run `39407381790` 已通过冻结安装、类型检查、13 文件 / 58 项安全测试、生产依赖审计（零公告）和构建。相同 head 的数据库 invariants 已通过。登记修复提交后的精确 head 须重新以 PR checks 验证。
- 首轮远端仍红：`verify-parte (1)` 有上述新增登记失败及 main 已有的 2 项 knobs 失败；`verify-parte (2)` 为 main 同样存在的 `spawnSync rg ENOENT`。E2E part 4 的 `vps-fresh-onboarding.spec.ts:438` 在 main run `39395704694` 和 PR run `39407381984` 同样于第 440 行等待 `/app/` 超时。镜像 smoke 失败源于既有工作流构建标签 `pi-native-crm-smoke:pr` 与运行标签 `pi-native-smoke:pr` 不一致，容器尚未启动；不能据此宣称镜像 boot 验证通过。未改动这些原有业务断言或扩大本安全补丁范围。

完整单测及远端检查都必须按精确提交报告；旧 head 的通过不能当作新 head 已通过。若最终 CI 仍失败或出现新增回归，不执行合并，不把已授权合并写成已经合并。未部署生产环境。
