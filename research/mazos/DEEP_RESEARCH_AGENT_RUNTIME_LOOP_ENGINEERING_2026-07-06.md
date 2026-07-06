# Deep Research: Agent Runtime And Loop Engineering

Date: 2026-07-06
Project: MAZos

## Question

What is the best loop architecture for MAZos using current agent-runtime and loop-engineering practice?

## Live GitHub Signals

| Repo | Stars | Forks | Last pushed UTC | Signal |
|---|---:|---:|---|---|
| microsoft/autogen | 59535 | 8961 | 2026-04-15T11:59:09Z | Multi-agent orchestration is widely adopted, though push recency is weaker than newer tools. |
| langchain-ai/langgraph | 36639 | 6143 | 2026-07-06T20:17:45Z | Durable state and graph orchestration are strong production patterns. |
| crewAIInc/crewAI | 55025 | 7729 | 2026-07-06T19:11:46Z | Role-based crews are easy for users to understand. |
| mastra-ai/mastra | 25871 | 2371 | 2026-07-06T20:29:40Z | TypeScript-native agents/workflows matter for MAZos. |
| openai/openai-agents-python | 27695 | 4262 | 2026-07-06T06:41:40Z | Handoffs, guardrails, tracing, and tool execution are baseline expectations. |
| cobusgreyling/loop-engineering | 6177 | 794 | 2026-07-06T15:05:21Z | Loop audit/init/cost primitives are becoming a named practice. |
| clawplays/ospec | 559 | 35 | 2026-06-25T07:15:12Z | Spec -> plan -> act -> verify -> evidence is a useful durable loop protocol. |

## Best-Practice Synthesis

### 1. A loop is a governed state machine, not a prompt

Loop engineering writing now frames the job as designing systems that prompt agents. The common ingredients are:

- Automation or trigger.
- Worktree/isolation.
- Skills/project memory.
- Plugins/connectors.
- Sub-agents or reviewer roles.
- Durable external state.

MAZos implication:

- `LoopDef` is a good v1 but too small for the product line.
- It needs source policy, trigger policy, verifier, receipt schema, latest-GitHub policy, cost/risk budget, and decision states.

### 2. Human-in-the-loop is not an exception

LangGraph interrupts explicitly pause execution, persist state, and resume later. The important product idea is not the Python API. It is the user state model:

- Waiting for approval.
- Waiting for missing context.
- Waiting for budget increase.
- Waiting for risky source confirmation.
- Waiting for external credential/API decision.

MAZos implication:

- Decision Inbox should be a loop state engine, not a side panel.
- Loop Factory should generate "ask points" by default.

### 3. Durable execution teaches receipts

Temporal describes durable execution as crash-proof execution where state can resume after failures. MAZos does not need Temporal right now, but it should copy the audit idea:

- Every loop should leave an append-only receipt.
- Every run should be resumable from sources, state, evidence, and stop reason.
- If MAZos cannot prove a step happened, Flight Recorder should say "not verified."

### 4. Production agents need tracing

OpenAI Agents SDK tracing collects LLM generations, tool calls, handoffs, guardrails, and custom events.

MAZos implication:

- Loop Receipts should be a local equivalent: source reads, generated prompts, user approvals, commands, tests, decisions, and next action.
- Flight Recorder should become the receipt viewer.

### 5. Framework choice is less important than runtime contract

LangChain's framework guide emphasizes production reliability, observability, debugging, ecosystem integrations, and pricing transparency. MAZos does not need to pick LangGraph vs CrewAI vs Agents SDK today.

MAZos implication:

- Define a runtime-independent loop contract.
- Let Codex, Claude, OpenCode, or future runtimes consume the same loop spec.

## Recommended MAZos Loop Contract V2

```ts
type LoopSpecV2 = {
  id: string;
  name: string;
  product: string;
  goal: string;
  trigger: 'manual' | 'schedule-suggested' | 'repo-event' | 'inbox-event' | 'source-watch';
  safetyLevel: 'L1' | 'L2' | 'L3';
  sourcePolicy: {
    allowed: string[];
    blocked: string[];
    requireLatestGitHub: boolean;
    maxSources: number;
    trustRules: string[];
  };
  roles: {
    actor: string;
    verifier: string;
    approver: 'human';
  };
  budget: {
    maxIterations: number;
    maxMinutes: number;
    maxFilesTouched: number;
    maxExternalCalls: number;
  };
  evidenceRequired: string[];
  receiptSchema: string[];
  stopConditions: string[];
  humanGates: string[];
};
```

## Product Features To Build

1. Loop Doctor
   - Audits LoopSpecV2 and existing `LoopDef` values.
   - Produces readiness, uselessness risk, and missing evidence fields.

2. Loop Receipts
   - Append-only JSON/Markdown records.
   - Connect to Flight Recorder.

3. Loop Simulator
   - Before running a loop, shows sources, commands, likely files, approval points, cost/risk, and stop conditions.

4. Runtime Adapter Prompts
   - Same loop spec exports to Codex, Claude, OpenCode, or plain CLI.

5. Loop Graduation
   - L1 report-only by default.
   - L2 assisted local writes only after receipts work.
   - L3 PR-only only after Task Gate and build/test gates are connected.

## Sources

- Addy Osmani, Loop Engineering: https://addyosmani.com/blog/loop-engineering/
- LangChain, best AI agent frameworks in 2026: https://www.langchain.com/resources/ai-agent-frameworks
- LangGraph overview: https://docs.langchain.com/oss/python/langgraph/overview
- LangGraph interrupts: https://docs.langchain.com/oss/python/langgraph/interrupts
- Temporal durable execution: https://temporal.io/blog/what-is-durable-execution
- OpenAI Codex automations: https://developers.openai.com/codex/app/automations
- OpenAI Agents SDK tracing: https://openai.github.io/openai-agents-python/tracing/
- OSpec repository: https://github.com/clawplays/ospec
- loop-engineering repository: https://github.com/cobusgreyling/loop-engineering

