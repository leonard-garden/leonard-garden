# Context Window: The Working Memory Limit of LLMs

## TL;DR
A context window is the total number of tokens a model processes in one call — input and output combined. Claude currently supports 200K tokens. When the context fills up, older information is lost — this is a physical constraint, not a bug.

---

## Part 1: The Problem It Solves

In 2020, GPT-3 launched with a 2,048-token context window — roughly 1,500 English words. A developer could ask AI to review a 200-line function: fine. But review a 500-line file? The model got cut off midway. Everything past the limit simply didn't exist for it.

The result: incomplete reviews. Bugs in the latter half of the file went undetected. Developers had to manually split files into chunks, paste each part separately, then stitch the results back together themselves.

This hurt because real code doesn't live in 1,500 words. A single small feature often spans 3–4 files, each several hundred lines long. AI was blind to anything outside its context.

A larger context window solves this by letting the model process entire files, full conversation history, and tool results — in a single call.

---

## Part 2: Precise Definition

**Context window** (also called *context length*) is the maximum number of tokens a model can receive and process in a single inference call. This number covers both input and output.

Easy to confuse with **memory**. Memory in LLMs is a broader concept that includes vector stores, databases, and external storage. The context window is just the immediate working memory — what the model can see right now.

Also easy to confuse with **max output tokens**. Context window = input + output combined. Max output tokens only limits what the model generates. Claude claude-sonnet-4-6 has a 200K token context window. If your input consumes 180K tokens, only 20K tokens remain for output.

---

## Part 3: How It Works

Each inference call, the entire context is fed to the model in linear order:

```
[System Prompt] → [Message 1] → [Tool Result 1] → [Message 2] → ... → [Current Input]
```

The model uses transformer attention to "see" all these tokens simultaneously. There's no sequential reading — the attention mechanism lets tokens at the end attend to tokens at the beginning.

In a Claude Code session, context accumulates like this:

```
┌─────────────────────────────────────────┐
│ System prompt (CLAUDE.md, rules...)     │ ~5K–20K tokens
│ Tool definitions (all built-in tools)  │ ~10K–30K tokens
│ Conversation history                   │ grows throughout session
│ Tool results (Read files, Bash output) │ each call adds several K
│ Response currently being generated     │
└─────────────────────────────────────────┘
              Total must be ≤ 200K
```

When the total exceeds the limit, Claude Code automatically triggers **context compaction** — summarizing old history while preserving key information. But a summary is never as good as the original.

---

## Part 4: Concrete Examples

**Example 1: Viewing token usage with verbose mode**

```bash
claude --verbose "Review file src/auth.ts"
```

The output includes token statistics — input token count, output token count, and cache hits. This is the simplest way to see how much context your session is consuming.

**Example 2: Context filling up in a real session**

You're debugging a complex feature. During the session, Claude has read 20 files, each about 500 lines:

```
20 files × 500 lines × ~12 tokens/line = ~120K tokens (file content)
Conversation messages:                    ~15K tokens
System prompt + tool definitions:         ~20K tokens
──────────────────────────────────────────────────────
Total used:                              ~155K / 200K
```

Roughly 45K tokens remain. If you keep reading 4–5 more large files, context compaction will kick in. Claude will "forget" what happened at the start of the session.

---

## Part 5: When to Think About Context Window

**Situation 1: Reviewing large modules or many related files**
When analyzing a feature spanning 10+ files, budget your context upfront. Every file read costs tokens. Without being selective, context fills up before the task is complete.

**Situation 2: Long debugging sessions**
After hours of debugging with many tool calls, context has accumulated significantly. If Claude starts re-asking about things already discussed, context compaction has likely occurred. At this point, `/clear` and start fresh with a distilled context.

**Situation 3: Processing large documents or log files**
Need to summarize a 500-page PDF or process a 100K-line log? Split it up rather than dumping everything in at once. Rule of thumb: 1 page of text ≈ 500–700 tokens, 1 line of code ≈ 10–15 tokens.

---

## Part 6: When NOT to "Just Stuff Everything Into Context"

**Anti-pattern 1: Dumping the entire codebase into context**
The logic: "Model has 200K, my project is 80K tokens, it fits." Wrong. You haven't accounted for system prompt (~15K), tool definitions (~20K), conversation (~10K), and responses (~5K+). In practice, maybe 150K is available for code — before you've done anything at all.

Instead: read selectively — only load files actually relevant to the current task.

**Anti-pattern 2: Letting context fill up and relying on compaction**
Context compaction loses information. If Claude "forgets" an important design decision from early in the session, bugs can resurface with no obvious cause.

Instead: start a fresh session when beginning a new task, don't drag old session state into different work.

**Anti-pattern 3: Using context as unstructured backup memory**
Stuffing everything into context hoping the model will find what it needs. Large context ≠ better processing — the "lost in the middle" phenomenon means information in the middle of a long context gets processed less effectively.

---

## Part 7: Gotchas & Pitfalls

**Gotcha 1: Overhead is larger than you expect**
In Claude Code, tool definitions for all built-in tools can consume 10–30K tokens before you type a single character. A long CLAUDE.md plus rules files adds to this. Enable verbose mode to see the real numbers.

**Gotcha 2: "Lost in the middle"**
With long contexts, attention tends to be stronger at the beginning and end, weaker in the middle. Important information sitting at tokens 50K–150K gets less attention than the same information at the start or end. Place important instructions near the end, not buried in the middle.

**Gotcha 3: Compaction happens without clear warning**
Claude Code compacts automatically as context nears the limit. You usually don't know until the model re-asks about something already discussed, or re-reads a file it already read. There's no pop-up or explicit notification.

**Gotcha 4: Cost scales with context size**
Every API call is priced based on input + output token count. Long sessions = large context = each subsequent call costs more. Prompt caching can reduce cost for the system prompt, but conversation history is still billed in full.

**Gotcha 5: Output is limited by remaining context**
If your input uses 170K of 200K context, output is capped at 30K tokens. For tasks requiring long generated output, you need to account for input + output together, not just input alone.

---

## Part 8: Connections to Other Keywords

→ **Token / Tokenization** (already covered): Context window is measured in tokens, not words. 200K tokens ≈ 150K English words, and less for code due to symbols and whitespace.

→ **Context Compaction** (coming — #22): The automatic mechanism that summarizes old context when approaching the limit. It's how Claude Code extends working sessions past the hard limit — with a trade-off in information fidelity.

→ **Prompt Caching** (coming — #24): A technique to cache the beginning of context (typically the system prompt) to reduce cost and latency. Directly related to managing the context window efficiently from a cost perspective.

→ **RAG Basics** (coming — #23): Instead of stuffing all knowledge into context, RAG retrieves exactly what's needed when needed. This is the solution when your knowledge base is larger than what the context window allows.

---

## Part 9: Self-test

Do this WITHOUT looking at the article. Write your answers on paper.

1. Explain context window in one sentence for someone who knows nothing about LLMs. Don't use the words "token" or "transformer."

2. You need to write a Claude Code script to analyze an entire project with 500 files, averaging 300 lines each. Context window is 200K tokens. How do you approach this?

3. Why is "stuff the whole codebase into context" an anti-pattern even when the context window is technically large enough token-count-wise?

4. How are context window and tokens (from the previous article) related? If you read a 100-line Python file, what percentage of a 200K context window does it consume?

5. If context windows grow to 1 million tokens in the future, will the "lost in the middle" problem disappear? Why or why not?

---

## Part 10: 24h Challenge

**Task**: Audit context usage in a real Claude Code session.

**Steps**:
1. Enable verbose mode when running Claude Code (`claude --verbose`)
2. Work on a real task — reviewing a module or debugging a bug
3. After every 5 tool calls, estimate the tokens used based on files read and messages exchanged
4. When the session ends, analyze: which part consumed the most context?

**Acceptance criteria**:
- [ ] Ran at least 1 session with verbose mode and observed token output
- [ ] Can estimate the overhead of system prompt + tool definitions in that session
- [ ] Identified the point in the session where context grew fastest
- [ ] Can estimate context budget before starting a complex task
- [ ] Wrote down 1 personal rule for context management (e.g., "Don't read more than X files per session")

**Estimated time**: 45–60 minutes (including running an actual session)

**Hint**: Rule of thumb — 1 line of code ≈ 10–15 tokens, 1 page of text ≈ 500–700 tokens. Use these numbers to estimate before running.

---

## Self-test Answers (read only after answering yourself)

**Q1**: A context window is the AI's working memory limit — everything it can hold in mind and process in one response. Think of it like RAM: when it's full, something has to be dropped to continue.

**Q2**: You can't read 500 files at once. 500 × 300 × 12 tokens ≈ 1.8M tokens — nine times the context window. You need a strategy: use grep/find to identify files relevant to the specific task, then only read those. Or use RAG to retrieve relevant code chunks instead of loading everything.

**Q3**: Because overhead is large — system prompt + tool definitions consume 30–50K tokens before you read a single line of code. Add "lost in the middle" — the model processes the middle of long contexts less effectively. More context doesn't mean better results.

**Q4**: Tokens are the unit that context window is measured in. 100 lines of Python ≈ 1,000–1,500 tokens ≈ 0.5–0.75% of 200K. Not much on its own — but 100 such files = 50–75% of context just for file content, before any overhead.

**Q5**: It won't disappear. "Lost in the middle" is about how attention mechanisms distribute weight across positions, not just about length. With a 1M token context, the "middle zone" becomes even larger, and information at positions 300K–700K may be handled even worse. The real fix requires architectural improvements to attention, not just increasing context size.
