# Chain of Thought: Teaching LLMs to Reason Step by Step

## TL;DR

**Chain of Thought (CoT)** is a prompting technique that requires an LLM to lay out each reasoning step before delivering a final answer. Instead of asking directly for a result, you ask the model to "think out loud" — this lets it catch and correct logic errors during the reasoning process. The result: noticeably higher accuracy on complex tasks like math, multi-step inference, and causal analysis.

---

## Part 1: The Problem It Solves

In March 2022, an engineer was testing GPT-3 with a simple arithmetic word problem:

> "A store has 5 apples. They buy 12 more and sell 8. How many apples remain?"

GPT-3 answered correctly. But when the problem added a few more dependent steps, the model started failing. Not because it didn't know math — but because it jumped straight to an answer without any "scratch paper" to work on.

The core issue: LLMs process tokens in a linear sequence with no separate working memory. When a question demands multiple interdependent reasoning steps, models tend to compress, skip the middle, and produce a wrong answer.

---

## Part 2: Precise Definition

**Chain of Thought** is a prompting method that instructs an LLM to generate a sequence of intermediate reasoning steps before producing a final answer.

The technique was introduced by Wei et al. in "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models" (NeurIPS 2022). The core idea: instead of using the context window only for the question and answer, you use it to hold the thinking process.

**Distinctions from easily-confused concepts:**
- *Few-shot prompting*: provides input→output examples. CoT is few-shot prompting **with intermediate steps**.
- *Zero-shot CoT*: no examples needed — just append "Let's think step by step." This is the simplest CoT variant.
- *Scratchpad*: the model-side equivalent concept. CoT is the prompt-side technique.

---

## Part 3: How It Works

CoT works because of a specific technical property: **every generated token becomes part of the context** for subsequent tokens. When the model writes out step 1, step 2 is conditioned on step 1. Reasoning becomes a dependent chain instead of a single leap.

```
Without CoT:
[Question] ──────────────────────────→ [Answer]
                                            ↑
                                   (1 step, error-prone)

With CoT:
[Question] → [Step 1] → [Step 2] → [Step 3] → [Answer]
                ↑            ↑           ↑
       each step accumulates context from the step before
```

**Two main forms:**

1. **Few-shot CoT**: Provide 2-3 examples with reasoning steps. The model learns the pattern and applies it.
2. **Zero-shot CoT**: No examples. Just append a trigger phrase to the end of the question.

Common trigger phrases:
- "Let's think step by step."
- "Think carefully before answering."
- "Work through this systematically."

---

## Part 4: Concrete Examples

### Example 1: Zero-shot CoT — simple math

**Without CoT:**
```python
import anthropic

client = anthropic.Anthropic()

# Ask directly for the answer
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=50,
    messages=[{
        "role": "user",
        "content": "A car travels at 60km/h for 2.5 hours, then 80km/h for 1.5 hours. Total distance?"
    }]
)
print(response.content[0].text)
# Output: "270km" — correct but not verifiable
```

**With Zero-shot CoT:**
```python
# Append trigger phrase to force step-by-step reasoning
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=300,
    messages=[{
        "role": "user",
        "content": (
            "A car travels at 60km/h for 2.5 hours, then 80km/h for 1.5 hours. "
            "Total distance?\n\nLet's think step by step."
        )
    }]
)
# Output:
# Step 1: Distance segment 1 = 60 × 2.5 = 150km
# Step 2: Distance segment 2 = 80 × 1.5 = 120km
# Step 3: Total = 150 + 120 = 270km
```

### Example 2: Few-shot CoT — sentiment classification with logic

```python
few_shot_prompt = """Analyze the sentiment of the following review. Reason step by step.

Example 1:
Review: "Product arrived fast but was broken, support refused to exchange it."
Reasoning: Fast delivery → small plus. Broken product → large minus. Refused exchange → critical minus. Minuses outweigh plus.
Result: NEGATIVE

Example 2:
Review: "Pricey but quality matches the cost, exactly as described."
Reasoning: High price → high expectation. Quality matches → expectation met. Accurate description → trustworthy.
Result: POSITIVE

Now analyze:
Review: "Second purchase here, this time quality feels lower than before, but still acceptable."
"""
# CoT surfaces: "lower than before" = unmet expectation → MIXED
```

---

## Part 5: When to Use

**Scenario 1: Multi-step math or logic problems.**
When the correct answer depends on a sequence of ordered calculations, CoT prevents the model from skipping intermediate steps — each step anchors the next.

**Scenario 2: Causal analysis or legal reasoning.**
When you need the model to explain *why* it reached a conclusion, not just *what* the conclusion is. Especially important when results need human verification.

**Scenario 3: Debugging complex prompts.**
When a model returns wrong results and you don't know why, add CoT to see what it "thinks" at each step — this reveals exactly where reasoning goes off track.

---

## Part 6: When NOT to Use

**Anti-pattern 1: Simple questions with direct answers.**
Asking "What is the capital of France?" with CoT just generates wasted tokens and increases latency. Use CoT only when the question requires at least two interdependent reasoning steps.

**Anti-pattern 2: Latency-sensitive production systems.**
CoT generates 50-200 extra tokens for reasoning steps. For token-billed API calls and real-time systems, this cost adds up. Alternative: use CoT in offline batch processing, or cache CoT results for repeated queries.

**Anti-pattern 3: Expecting CoT to fix every type of error.**
CoT improves *reasoning errors*, not *knowledge errors*. If the model doesn't know a fact, CoT just produces "confident wrong reasoning." Alternative: combine with Grounding (RAG) when knowledge gaps are the root cause.

---

## Part 7: Gotchas & Pitfalls

**Gotcha 1: Confident wrong reasoning**
The model can produce a reasoning chain that looks plausible but starts from a wrong premise. Dangerous because readers trust the presented logic. Detection: compare CoT result against a different reasoning path. Fix: use **Self-consistency** — sample multiple times with temperature > 0 and take the majority vote.

**Gotcha 2: Reasoning steps are not "real thinking"**
Tokens in a CoT chain are output, not internal computation. The model isn't actually "computing" there — it's *generating language that describes* a computation. These are different things. Don't treat CoT output as a mathematical proof.

**Gotcha 3: Few-shot examples bias the output**
If your few-shot CoT examples are all POSITIVE sentiment, the model will lean toward POSITIVE. The format and distribution of examples shapes the reasoning pattern. Fix: diversify examples and test with adversarial cases before deployment.

**Gotcha 4: Trigger phrase effectiveness varies by model**
"Let's think step by step" works well across many models, but not all. Claude typically responds better to "Think carefully and systematically." Always benchmark on a sample dataset before fixing a trigger phrase in production.

---

## Part 8: Connections to Other Keywords

→ **In-context Learning** (covered): CoT is a form of in-context learning. You teach the model the "reason step by step" pattern directly in the prompt, without fine-tuning.

→ **Temperature & Sampling** (covered): Self-consistency CoT requires sampling multiple reasoning paths — temperature > 0 is necessary to generate the diversity needed for majority voting.

→ **Hallucination & Grounding** (covered): CoT reduces hallucination from *reasoning errors*, not *knowledge gaps*. Two different error sources require two different tools.

→ **Agent Loop** (covered): The ReAct pattern — an agent cycling through think/act/observe — is Chain of Thought extended with tool-calling capability. CoT is the building block of ReAct.

→ **Tree of Thought** (coming up): Extends CoT from a single linear chain into a tree of parallel reasoning paths, with backtracking.

---

## Part 9: Self-test (5 open questions)

**Q1:** Explain Chain of Thought in your own words — why does writing out intermediate steps technically improve LLM output?

**Q2:** You're building a legal contract analysis tool that needs to explain why a clause is flagged as risky. Is CoT appropriate here? How would you design the prompt?

**Q3:** A real-time chatbot must respond in under 1 second. Would you use CoT directly? If not, how do you still achieve the required accuracy?

**Q4:** CoT and Grounding solve two different LLM problems. Clearly distinguish: what type of error does CoT fix, and what type requires Grounding?

**Q5:** If future LLMs have a genuine "internal scratchpad" (not output tokens), would CoT still be necessary? What would change and what would stay the same?

---

## Part 10: 24h Exercise

**Task:** Build a small "reasoning quality evaluator."

1. Find 10 grade-5 math word problems (Google or write your own).
2. Send each problem twice: once without CoT, once with "Let's think step by step."
3. Record: accuracy (correct/wrong), token count generated, quality score (rate 1-5 based on how clear the reasoning is).
4. Create a comparison table.

**Acceptance criteria:**
- [ ] 10 questions tested under both conditions (20 total API calls)
- [ ] Comparison table: CoT vs non-CoT accuracy
- [ ] At least 1 "confident wrong reasoning" example from CoT documented
- [ ] At least 1 example of CoT being over-verbose (more steps than necessary)
- [ ] Written conclusion: for this problem type, is CoT worth the cost and why?

**Estimated time:** 45-60 minutes

**Hint:** Use `max_tokens=50` for non-CoT calls and `max_tokens=500` for CoT calls to avoid truncation.

---

## Self-test Answers (read after answering on your own)

**Q1:** LLMs generate tokens linearly — each prior token is context for the next. When you force the model to write "Step 1: X, Step 2: Y", step 2 is directly conditioned on step 1 already in context. The model can't skip because each step anchors the next. You're using the context window as scratch paper.

**Q2:** CoT is well-suited here for two reasons: (1) you need interpretability — users must understand *why* a clause is flagged, (2) legal analysis is multi-step reasoning. Sample prompt: "Analyze the following clause. First list potential risk factors, then assess the severity of each, finally state the overall risk level and your reasoning."

**Q3:** Don't use CoT directly in the real-time path. Alternatives: (1) pre-compute CoT for common questions and cache results, (2) use CoT in offline evaluation to tune prompts, then deploy the optimized prompt, (3) use a smaller model fine-tuned on CoT-generated data.

**Q4:** CoT fixes *reasoning errors* — the model knows the facts but reasons incorrectly by skipping intermediate steps. Grounding fixes *knowledge errors* — the model lacks correct information (hallucination or outdated data). Example: computing 60×2.5 wrong → CoT fixes it. Recalling the wrong treaty date → Grounding fixes it.

**Q5:** If LLMs had a real internal scratchpad (like Claude's Extended Thinking), zero-shot CoT would become less necessary since the model handles it automatically. However, few-shot CoT would still have value for shaping *how* the model structures reasoning for a specific domain — the format and structure of output still benefits from worked examples.
