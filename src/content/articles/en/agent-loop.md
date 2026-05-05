---
title: "ReAct Pattern — The Reasoning and Acting Loop of AI Agents"
description: "ReAct (Reasoning + Acting) is a pattern that lets an LLM interleave reasoning and action in a continuous loop. Instead of answering once, the model observes → thinks → acts until the task is complete. Claude Code and most modern AI agents operate on this pattern."
locale: "en"
translationKey: "agent-loop"
publishedAt: 2026-05-05
pillar: "ai"
type: "article"
draft: false
---

## TL;DR

**ReAct** (Reasoning + Acting) is a pattern that lets an LLM interleave reasoning and action in a continuous loop. Instead of answering once, the model observes → thinks → acts until the task is complete. Claude Code and most modern AI agents operate on this pattern.

---

## Part 1: The problem it solves

Before ReAct, an LLM could only respond once based on whatever was in the prompt. Ask "which file is causing the error?" and the model guessed — it had no way to actually read the file system.

Imagine asking Claude to debug a production bug. The model gives a thoughtful response, but it can't run commands to verify. Every "action" went through you: copy the command → run it → paste the output → ask again. Slow, error-prone, and tedious.

ReAct solves this by letting the model take real actions, read actual results, and adjust its reasoning — without needing you as an intermediary after every step.

---

## Part 2: Precise definition

**ReAct** is a framework that integrates two capabilities: *Reasoning* (thinking out loud, writing a chain of thought) and *Acting* (calling tools, performing actions) within the same inference loop. The original paper "ReAct: Synergizing Reasoning and Acting in Language Models" (Yao et al., 2022) showed that combining both outperforms using either in isolation.

How it compares to related concepts:

| Approach | Reasoning | Action | Self-correction |
|---|---|---|---|
| Chain of Thought | ✅ | ❌ | ❌ |
| Single tool call | ❌ | ✅ | ❌ |
| **ReAct** | ✅ | ✅ | ✅ |

ReAct is not a Claude Code-specific term. It's a general pattern that many systems implement in different ways.

---

## Part 3: How it works

ReAct runs in a loop: **Observe → Think → Act → repeat**.

```
┌─────────────────────────────────────┐
│  Initial task (from user)            │
└────────────────┬────────────────────┘
                 ▼
          ┌─────────────┐
          │   OBSERVE   │  ← Receive input (prompt, tool result)
          └──────┬──────┘
                 ▼
          ┌─────────────┐
          │    THINK    │  ← "What do I know? What's next?"
          └──────┬──────┘
                 ▼
          ┌─────────────┐
          │     ACT     │  ← Call a tool OR produce final answer
          └──────┬──────┘
                 │
     ┌───────────┴───────────┐
     ▼                       ▼
[Tool result]         [Final answer]
(back to OBSERVE)     (loop ends)
```

Each THINK step produces explicit reasoning — actual text in the response, not hidden internal state. Each ACT step selects a tool and passes parameters. The tool returns a result, the model reads it (OBSERVE), then thinks again.

The loop stops when:
1. The model decides it has enough information for a final answer.
2. A pre-set step limit is hit (safety stop).
3. A tool returns an unrecoverable error.

---

## Part 4: Concrete examples

### Example 1: ReAct loop with the Anthropic SDK

```python
import anthropic

client = anthropic.Anthropic()

tools = [
    {
        "name": "read_file",
        "description": "Read the contents of a file",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"}
            },
            "required": ["path"]
        }
    }
]

def run_tool(name, inputs):
    if name == "read_file":
        try:
            with open(inputs["path"]) as f:
                return f.read()[:2000]  # cap output length
        except FileNotFoundError:
            return f"Error: File not found: {inputs['path']}"

messages = [{"role": "user", "content": "Read requirements.txt and list the packages"}]

# ReAct loop — max 10 iterations
for i in range(10):
    response = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        tools=tools,
        messages=messages
    )

    if response.stop_reason == "end_turn":
        # [THINK + FINAL ANSWER]
        print(response.content[0].text)
        break

    # [ACT] Model wants to call a tool
    tool_use = next(b for b in response.content if b.type == "tool_use")
    print(f"[ACT] {tool_use.name}({tool_use.input})")

    # [OBSERVE] Actually run the tool
    result = run_tool(tool_use.name, tool_use.input)
    print(f"[OBSERVE] {result[:80]}...")

    # Append results to continue the loop
    messages.append({"role": "assistant", "content": response.content})
    messages.append({
        "role": "user",
        "content": [{"type": "tool_result", "tool_use_id": tool_use.id, "content": result}]
    })
```

### Example 2: Claude Code debugging a failing test

When you type "fix the failing test", Claude Code runs ReAct:

```
[THINK]   I need to see which test is failing first
[ACT]     bash("npm test 2>&1")
[OBSERVE] "Error in auth.test.ts:42 — Cannot read property 'token' of undefined"

[THINK]   Error at line 42, need to read the file to understand context
[ACT]     read("src/auth.test.ts")
[OBSERVE] [file content — mock object is missing the token field]

[THINK]   The mock is missing 'token', I need to fix it
[ACT]     edit("src/auth.test.ts", old="mockUser = {}", new="mockUser = {token: 'test'}")
[OBSERVE] "File saved"

[THINK]   Re-run tests to confirm the fix works
[ACT]     bash("npm test 2>&1")
[OBSERVE] "All tests passed (12/12)"

[FINAL]   "Fixed: mock object in auth.test.ts was missing the token field..."
```

No step involves guessing. Every conclusion is grounded in an actual observation.

---

## Part 5: When to use

**Scenario 1: Task requires information outside the prompt**  
When the answer depends on data you can't know ahead of time — file system state, real-time database queries, external APIs. ReAct lets the model gather information on demand rather than relying on what's in the prompt.

**Scenario 2: Multi-step pipeline with dependencies**  
When each step depends on actual results from the previous one. Example: read logs → identify root cause → patch code → run tests → confirm. You can't plan the full pipeline upfront because you don't know what the logs contain.

**Scenario 3: Task requires self-verification**  
When you want the model to check its own output rather than just assert it's correct. Fix applied → run tests → read results → adjust if needed. The model verifies itself without you doing it after each step.

---

## Part 6: When NOT to use

**Anti-pattern 1: Questions that don't need tools**  
"What is a Python list comprehension?" doesn't need ReAct. Each loop iteration costs tokens and adds latency. Use direct completion — faster and cheaper.

**Anti-pattern 2: Unreliable tools**  
If a tool frequently times out or returns inconsistent data, the ReAct loop will veer off course — the model adjusts reasoning based on bad observations. Stabilize the tool first, then put it in an agent loop.

**Anti-pattern 3: Hard latency constraints**  
Each loop iteration is one API round-trip. Three iterations can take 5-10 seconds. For autocomplete or real-time chat requiring <200ms responses, that's unacceptable. ReAct fits background tasks and autonomous agents, not interactive flows.

---

## Part 7: Gotchas & Pitfalls

**Pitfall 1: Infinite loop**  
Without a `max_iterations` limit, the model loops indefinitely if it can't reach its goal. Token costs pile up fast. Always set a hard limit (typically 10-20 steps) and log when the loop hits it — that's a debugging signal.

**Pitfall 2: Tool output silently truncated**  
A 10,000-line file overflows the context window, and the tail gets cut off. The model reads the first half and draws wrong conclusions about the full content. Truncate at the tool layer and append `"... (truncated, X lines total)"` so the model knows there's more it hasn't seen.

**Pitfall 3: Reasoning anchored to an early wrong hypothesis**  
If the first THINK step produces a wrong hypothesis, subsequent steps tend to defend it rather than disprove it. Add this to your system prompt: *"If an observation contradicts your prior hypothesis, reconsider from the beginning rather than explaining it away."*

**Pitfall 4: Destructive actions without safeguards**  
A model can decide `delete_file("src/main.py")` if reasoning leads there. For any irreversible action, add a confirmation step or a dry-run mode that prints the intended action before executing it.

---

## Part 8: Connections to other keywords

→ **Tool use / Function calling** (already covered): Tool use is the mechanism — how to call a function. ReAct is the strategy — how to orchestrate multiple tool calls with reasoning between each one.

→ **Chain of Thought** (coming up): CoT is the THINK step in ReAct. Pure CoT only reasons internally; ReAct gives CoT the ability to verify reasoning through real-world action.

→ **Hallucination & Grounding** (already covered): ReAct reduces hallucination by grounding reasoning in actual observations. Instead of asserting "the file contains X", the model reads the file and confirms.

→ **Subagents** (coming up): Each subagent is its own ReAct loop. A multi-agent system is multiple ReAct loops coordinating — one orchestrator loop directing several worker loops.

→ **Prompt injection** (coming up): Tool results in a ReAct loop are an attack surface. If a tool reads content from an external source containing adversarial instructions, the model can be manipulated mid-loop.

---

## Part 9: Self-test

**Q1**: Explain ReAct in your own words — without using the words "Reasoning" or "Acting". Why does it outperform using Chain of Thought alone or a single tool call alone?

**Q2**: You're building a customer support chatbot that needs to look up order history from a database. Which part of that workflow is ReAct? Which part doesn't need ReAct?

**Q3**: When would you NOT use ReAct even if the task requires a tool? Give a specific example with a clear technical reason.

**Q4**: Compare ReAct to In-context Learning (already covered). Both use the context window — how do they use it differently?

**Q5**: If a ReAct agent is granted the ability to call `delete_file`, what could go wrong if its first reasoning step is wrong? How would you design safeguards?

---

## Part 10: Exercise (24h challenge)

**Task**: Build a ReAct agent from scratch — no frameworks, just the Anthropic SDK and plain Python.

The agent must:
1. Accept a question about the file system (e.g., "How many .py files are in the current directory?")
2. Decide on its own which tools it needs
3. Call tools for real (using `os` or `subprocess`)
4. Loop until it can answer the question

**Acceptance criteria**:
- Hard limit: maximum 10 iterations
- Print each step clearly: `[THINK]`, `[ACT: tool_name]`, `[OBSERVE: result]`
- Agent stops itself when it has an answer — no manual interruption needed
- Handles at least one type of tool error without crashing the whole loop

**Estimated time**: 45-60 minutes  
**Hint**: Start with two tools: `list_files(path)` and `count_files(extension, path)`.

---

## Self-test Answers (read after answering on your own)

**Q1**: ReAct is a "plan → check reality → adjust" loop. CoT only thinks but never checks — it can't know whether its reasoning is actually correct. A single tool call only acts without reasoning about why. ReAct combines both: each action has explicit reasoning attached, and each result gets integrated into the next round of reasoning.

**Q2**: ReAct: query database → analyze results → decide what to say → verify if needed. Not ReAct: pure FAQ lookup (no tool needed), intent routing (single classifier call, no loop).

**Q3**: Don't use ReAct when latency is a hard constraint. Example: IDE autocomplete needs a response in <100ms. Three ReAct iterations can take 3-8 seconds — completely unacceptable. Use direct completion with enough context in the prompt instead.

**Q4**: In-context learning uses the context window to learn patterns from examples (static, loaded upfront). ReAct uses the context window to accumulate observations at runtime (dynamic, grows with each loop iteration). ICL is fixed input; ReAct is self-expanding input.

**Q5**: With a wrong first reasoning step (e.g., misidentifying which file to delete), the agent can irreversibly delete an important file. Safeguards: (1) require explicit human confirmation before any destructive action, (2) dry-run mode — print the intended action and wait for approval, (3) scope restriction — only allow deletes within a specific sandbox directory, (4) log every action with enough context to reconstruct what happened.
