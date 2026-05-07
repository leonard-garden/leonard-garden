# Reflection / Self-critique: LLMs Evaluating Their Own Output

## TL;DR

**Reflection** is a prompting technique that asks a model to evaluate its own output against specific criteria, then rewrite based on that critique. Instead of accepting the first answer, you add a "critique" step where the model shifts from author to reviewer. This works especially well for code generation, writing, and tasks with clear quality criteria.

---

## Part 1: The problem it solves

An engineer uses an LLM to generate Python code that reads a CSV file. The model returns working code — but it doesn't handle missing files, missing columns, or non-numeric values. The engineer reads through every line, spots the issues, then prompts again: "Add error handling." The model fixes that. Then another problem appears.

The question: why didn't the model catch these issues in the first place?

The model generates output in one direction — there's no structured "look back" step. When you add a critique step, the model switches from "author" to "reviewer". Reviewers consistently catch what authors miss.

---

## Part 2: Precise definition

**Reflection** is a process where: (1) the model generates an initial output, (2) the model critiques that output against specific criteria, (3) the model rewrites based on the critique.

Compared to related techniques:

| Technique | Improvement mechanism | Inference count |
|---|---|---|
| Self-consistency | Majority vote across N parallel paths | N |
| Reflection | Critique → revise, sequential | 2+ |
| Chain of Thought | Step-by-step reasoning, single pass | 1 |

This technique appears in "Self-Refine" (Madaan et al., 2023) and "Reflexion" (Shinn et al., 2023). Anthropic's Constitutional AI also uses a critique/revision loop.

Distinction: *self-critique* (same model critiques its own output) vs *cross-critique* (model A critiques model B's output).

---

## Part 3: How it works

```
Initial prompt
    │
    ▼
┌──────────────────┐
│  Generate (G)    │  ← produce output v1
└──────────────────┘
    │
    ▼
┌──────────────────┐
│  Critique (C)    │  ← evaluate against specific criteria
│  "v1 is missing  │
│   X, doesn't     │
│   handle Y"      │
└──────────────────┘
    │
    ▼
┌──────────────────┐
│  Refine (R)      │  ← rewrite based on critique
│  Output v2       │
└──────────────────┘
    │
    ▼
Quality sufficient? ──No──→ Repeat C→R (max 2-3 rounds)
    │
   Yes
    ▼
Final output
```

**Step 1 — Generate**: Standard prompt, get output v1.

**Step 2 — Critique**: Separate prompt: "Find issues in the output above based on criteria: [A, B, C]. If no issues, write PASS."

**Step 3 — Refine**: "Based on the critique below, rewrite to address the identified problems."

Loop for at most 2-3 rounds. Diminishing returns become obvious after round 3.

---

## Part 4: Concrete examples

### Example 1: Code generation with self-critique

```python
import anthropic

client = anthropic.Anthropic()

def generate_with_reflection(task: str, criteria: list[str], max_rounds: int = 2) -> str:
    # Step 1: Generate
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        messages=[{"role": "user", "content": task}]
    )
    output = response.content[0].text

    for round_num in range(max_rounds):
        criteria_str = "\n".join(f"- {c}" for c in criteria)

        # Step 2: Critique
        critique = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=400,
            messages=[
                {"role": "user", "content": task},
                {"role": "assistant", "content": output},
                {"role": "user", "content": f"Find issues in the output above based on:\n{criteria_str}\n\nIf no issues, write PASS."}
            ]
        ).content[0].text

        if "PASS" in critique:
            break

        # Step 3: Refine
        output = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            messages=[
                {"role": "user", "content": task},
                {"role": "assistant", "content": output},
                {"role": "user", "content": f"Critique:\n{critique}\n\nRewrite to fix the identified issues."}
            ]
        ).content[0].text
        print(f"Round {round_num + 1}: refined")

    return output

result = generate_with_reflection(
    task="Write a Python function that reads a CSV file and sums the 'price' column.",
    criteria=[
        "Handle file not found",
        "Handle missing 'price' column",
        "Handle non-numeric values in price",
        "Include type hints and docstring"
    ]
)
print(result)
```

### Example 2: Email draft critique

```python
def critique_and_refine_email(draft: str) -> dict:
    critique_prompt = f"""Email draft:
---
{draft}
---
Evaluate against 3 criteria:
1. Does the subject line clearly state the purpose?
2. Is the call-to-action specific?
3. Is the tone appropriate (professional but not overly formal)?

For each criterion: PASS or identify the specific problem."""

    critique = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=300,
        messages=[{"role": "user", "content": critique_prompt}]
    ).content[0].text

    refined = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=500,
        messages=[{"role": "user", "content": f"Original email:\n{draft}\n\nCritique:\n{critique}\n\nRewrite the email to fix the weak points."}]
    ).content[0].text

    return {"critique": critique, "refined": refined}
```

---

## Part 5: When to use

**Scenario 1: Code generation with high quality requirements**
Code needs edge case handling, correct error handling, and coding standards compliance. A single generate pass usually misses things. A critique pass with a specific checklist (error handling, typing, tests) catches most gaps without the engineer reading every line.

**Scenario 2: Writing with tone and style requirements**
Professional emails, technical documentation, marketing copy — tasks with clear evaluation criteria that are hard to embed in one prompt. Reflection separates "generate" and "review" into two passes, each focused on a single role.

**Scenario 3: Quality gate inside an agent loop**
An agent completes an action (API call, file write) then asks "does this output match the original goal?" before proceeding to the next step. Prevents errors from compounding across multiple steps.

---

## Part 6: When NOT to use

**Anti-pattern 1: Tasks with no clear evaluation criteria**
If you can't write a specific critique prompt, reflection produces only verbose revisions with no real improvement. "Make it better" is not a critique — it's wishful thinking. Before using reflection, ask: "Can I list 3-5 specific criteria?" If not, don't use it.

**Anti-pattern 2: Unacceptable latency**
Each reflection round adds 2 API calls (critique + refine). 3 rounds = 7 total calls. For real-time applications, this is too expensive. Alternative: optimize the original prompt so the first-pass output is already good, or pre-generate and cache.

**Anti-pattern 3: Short factual questions**
"What is the capital of France?" — critique adds no value. Reflection shines with long, multi-dimensional outputs, not simple lookups with a clear correct answer.

---

## Part 7: Gotchas & Pitfalls

**Gotcha 1: The model agrees with itself too easily**
Self-critique has bias: the model tends to PASS its own output unless you prompt adversarially. "Find issues in the output below" outperforms "Review the output below". Framing that assumes problems exist produces better critiques.

**Gotcha 2: Sycophantic refinement**
The model receives a critique then "fixes" it by adding text without actually resolving the underlying problem. Output v2 is longer than v1 but the root issue remains. Fix: after each refine, run another critique pass to verify the problem was genuinely resolved.

**Gotcha 3: No exit condition → infinite loop**
Without max_rounds, the model critiques indefinitely on complex tasks with no perfect answer. Set a maximum of 2-3 rounds and use a "PASS" signal like the example above.

**Gotcha 4: Vague criteria dilute focus**
"Check for any issues" → the model surfaces 10 minor irrelevant points. "Check: (1) error handling, (2) type hints, (3) docstring" → the model focuses on what matters. The more specific the criteria, the more useful the critique.

---

## Part 8: Connections to other keywords

→ **Chain of Thought** *(already covered)*: CoT improves reasoning within a single pass. Reflection adds a "look back" pass after you already have output. Combine them: CoT in the generate pass, criteria-based critique in the review pass.

→ **Self-consistency** *(already covered)*: self-consistency picks the best answer from multiple parallel paths. Reflection improves a single path through sequential rounds. They complement each other: use self-consistency for confidence, reflection for quality.

→ **Agent Loop** *(already covered)*: reflection is a natural quality gate inside an agent loop. Agent generates → critiques → refines → continues task. Prevents errors from accumulating across steps.

→ **Hallucination & Grounding** *(already covered)*: the critique pass can fact-check: "Which claims in this output need a source? Which might be wrong?" Adversarial critique reduces hallucination effectively.

→ **Prompt Optimization** *(coming up)*: the critique criteria in reflection are exactly the quality criteria used to evaluate a good prompt. Optimizing a prompt is essentially hardcoding those criteria into the prompt itself — the same underlying idea.

---

## Part 9: Self-test

**Q1**: Explain the difference between reflection and simply prompting the model again with "Please improve this output."

**Q2**: You use reflection to improve code generation. After 3 rounds, the output still fails the error handling critique. Where might the problem lie, and how would you debug it?

**Q3**: In what situations is self-consistency more appropriate than reflection, and vice versa?

**Q4**: Why is "Find issues in the code below" more effective than "Review the code below" as a critique prompt?

**Q5**: If you use a different model for the critique pass instead of self-critique, when is that better and when is it unnecessary?

---

## Part 10: Exercise (24h challenge)

**Task**: Build a "writing coach" that uses reflection to improve English paragraphs.

**Requirements**:
- Input: an English paragraph of 100-200 words (write your own or use an old email)
- Critique against 3 criteria: (1) clarity, (2) conciseness, (3) active voice ratio
- Refine based on the critique
- Print: original paragraph, critique, improved version, and word count comparison

**Acceptance criteria**:
- [ ] Critique identifies at least 1 specific issue (not all PASS)
- [ ] Refined version is not longer than the original
- [ ] Refined version uses active voice more than the original
- [ ] Code runs on at least 2 different paragraphs

**Estimated time**: 45 minutes

**Hint**: Use Claude Haiku for the critique pass (lightweight, sufficient to check 3 simple criteria). Use Claude Sonnet for the refine pass (needs to produce quality writing).

---

## Self-test Answers (read after answering on your own)

**Q1**: A simple "please improve" prompt has no specific criteria — the model picks what to fix, usually the easiest things rather than the most important. Reflection has a separate critique prompt with explicit criteria, forcing the model to "switch roles" from author to reviewer before rewriting. That role separation is the core mechanism.

**Q2**: The problem could be: (1) the critique prompt isn't specific enough about which type of error handling to check, (2) the model lacks knowledge about the specific edge cases for that use case, (3) conflicting requirements in the task description. Debug: print the critique from each round to see exactly what the model flags, then adjust criteria or add concrete examples to the prompt.

**Q3**: Self-consistency is more appropriate when: the question has a clear correct answer, you need a confidence estimate, or tasks can be parallelized. Reflection is more appropriate when: the output needs to improve along specific quality dimensions, the task is writing or code (not selecting the right answer), or you need stronger reasoning in the final output.

**Q4**: "Find issues" is adversarial framing — the model is pushed into the critic role with the assumption that problems exist. "Review" leaves the door open for the model to conclude "looks fine" without effort. Good framing assumes a problem exists and asks the model to find it, rather than asking whether a problem exists.

**Q5**: Using a different model is better when: you want to avoid self-serving bias, the critique requires domain expertise the generating model lacks (e.g. a security-review fine-tuned model), or you want to simulate different perspectives. It's unnecessary when: the task is simple enough that self-critique works well, or budget and latency don't allow an additional call.
