# Self-consistency: Majority Voting for Better Accuracy

## TL;DR

**Self-consistency** is a prompting technique that runs the same question multiple times, collects diverse reasoning chains, then picks the most frequent answer. It builds on Chain of Thought and works especially well for math, logic, and multi-step reasoning tasks. Instead of trusting a single output, you let the model "vote" to surface the most reliable answer.

---

## Part 1: The problem it solves

In 2022, a Google engineer was using GPT-3 to solve GSM8K problems — grade-school math word problems. Even with Chain of Thought prompting, the model was wrong about 40% of the time. The frustrating part: asking the same question again sometimes produced the correct answer.

The question became: if the model can generate the right answer, why not aggregate multiple attempts and pick the best one?

The root problem is *greedy decoding*: the model infers once with no self-checking mechanism. A small error early in the reasoning chain pulls the entire path in the wrong direction.

---

## Part 2: Precise definition

**Self-consistency** is a method that samples N independent reasoning paths from the same question, then selects the most frequent answer using *majority voting*.

Compared to related techniques:

| Technique | Inference count | Selection method |
|---|---|---|
| Single CoT | 1 | Take first output |
| Self-consistency | N (typically 10–40) | Majority vote |
| Best-of-N | N | Verifier/reranker selects |

This technique requires no model changes or fine-tuning — only a change in sampling strategy.

---

## Part 3: How it works

Four steps:

```
Question (Q)
    │
    ▼
┌──────────────────────────────────────────┐
│  Sample N reasoning paths                │
│  (temperature > 0, e.g. 0.7)            │
│                                          │
│  Path 1: "A → B → C → Answer: 42"      │
│  Path 2: "A → D → E → Answer: 42"      │
│  Path 3: "A → F → G → Answer: 37"      │
│  Path 4: "A → B → H → Answer: 42"      │
│  Path 5: "A → I → J → Answer: 37"      │
└──────────────────────────────────────────┘
    │
    ▼
Majority Vote: 42 (appears 3 out of 5)
    │
    ▼
Final answer: 42
```

**Step 1**: Write a CoT prompt with a few few-shot examples (or zero-shot CoT).

**Step 2**: Sample N times with temperature 0.5–0.8 to generate diversity across paths.

**Step 3**: Extract the final answer from each reasoning path.

**Step 4**: Majority vote — the answer that appears most often is the result.

Wang et al. (2022) used N=40 and reported a 17.9% accuracy improvement on GSM8K over single CoT.

---

## Part 4: Concrete examples

### Example 1: Math word problem

```python
import anthropic
from collections import Counter

client = anthropic.Anthropic()

def self_consistency(question: str, n_samples: int = 7) -> str:
    prompt = f"""Solve step by step, then write the final answer as "Answer: <number>".

Question: {question}"""

    answers = []
    for _ in range(n_samples):
        response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=300,
            temperature=0.7,  # > 0 to generate path diversity
            messages=[{"role": "user", "content": prompt}]
        )
        text = response.content[0].text
        # Extract answer from the "Answer:" line
        for line in text.split("\n"):
            if "Answer:" in line:
                answers.append(line.split("Answer:")[-1].strip())
                break

    if not answers:
        return "Could not extract answer"

    winner, count = Counter(answers).most_common(1)[0]
    print(f"Distribution: {dict(Counter(answers))}")
    print(f"Confidence: {count}/{len(answers)}")
    return winner

result = self_consistency(
    "Lan has 15 books. She gives away 1/3 to a friend, then buys 4 more. How many does she have?"
)
print(f"Answer: {result}")
# Distribution: {'14': 5, '19': 1, '14 books': 1}
# Confidence: 5/7
# Answer: 14
```

### Example 2: Sentiment classification with confidence score

```python
def classify_with_consistency(review: str, n_samples: int = 7) -> dict:
    prompt = f"""Analyze the following review step by step, then conclude with exactly one of: POSITIVE / NEGATIVE / NEUTRAL.

Review: "{review}"

Conclusion: <POSITIVE/NEGATIVE/NEUTRAL>"""

    labels = []
    for _ in range(n_samples):
        response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=200,
            temperature=0.6,
            messages=[{"role": "user", "content": prompt}]
        )
        text = response.content[0].text
        for label in ["POSITIVE", "NEGATIVE", "NEUTRAL"]:
            if f"Conclusion: {label}" in text:
                labels.append(label)
                break

    counter = Counter(labels)
    winner, count = counter.most_common(1)[0]
    return {
        "label": winner,
        "confidence": round(count / len(labels), 2),
        "distribution": dict(counter)
    }

result = classify_with_consistency("Good product but shipping was slower than expected.")
print(result)
# {'label': 'NEUTRAL', 'confidence': 0.71, 'distribution': {'NEUTRAL': 5, 'POSITIVE': 2}}
```

---

## Part 5: When to use

**Scenario 1: Problems with a clear, verifiable answer (math, logic, classification)**
Self-consistency works best when answers can be compared and counted. Majority vote is meaningful with "14" or "NEGATIVE", not with "write me a poem".

**Scenario 2: High-stakes decisions where errors are costly**
When a wrong answer has serious consequences — fraud detection, medical triage, risk assessment — self-consistency adds a layer of robustness. If 8/10 paths agree, you have stronger evidence for the result.

**Scenario 3: Debugging model behavior**
When the model produces a strange answer, run self-consistency to see where the majority of paths land. If 9/10 paths are consistent but 1 is an outlier — the problem is a prompt edge case, not missing model knowledge.

---

## Part 6: When NOT to use

**Anti-pattern 1: Open-ended, creative questions with no single correct answer**
Majority vote is meaningless for "Write a tagline for our product". Each path produces something different, and no path is more "correct" than another. Self-consistency will surface the most generic option, not the most creative one. Use a single pass with appropriate temperature and let a human choose.

**Anti-pattern 2: Latency-sensitive applications**
N=10 means 10x cost and 10x latency if run sequentially. For real-time applications requiring sub-second responses, self-consistency is not viable. Alternative: use Claude with extended thinking, or run a single verification call after the initial response.

**Anti-pattern 3: Simple factual questions**
"What is the capital of France?" needs no 10 samples. Self-consistency has value only when the question is complex enough that the model can fail in multiple different ways.

---

## Part 7: Gotchas & Pitfalls

**Gotcha 1: Temperature too low → all paths are identical**
With temperature = 0 or below 0.3, paths are nearly identical — no real diversity. Majority vote at that point is just one inference pretending to be many. How to detect: print all N responses and read them. Fix: increase temperature to 0.5–0.8.

**Gotcha 2: Parse errors skew results**
If the model sometimes writes "Answer: 14 books" and sometimes "14", your extraction code may drop some paths. Three dropped paths due to parse errors will distort the confidence score. Fix: use a more flexible regex, or add explicit format instructions to the prompt.

**Gotcha 3: N too small → unstable results**
With N=3, one wrong path accounts for 33%. With N=10, one wrong path is only 10%. The original paper recommends N≥10 for complex reasoning tasks. For simpler problems, N=5 is usually sufficient.

**Gotcha 4: Majority vote does not guarantee correctness**
If the question exceeds the model's capabilities, the majority can still vote for a wrong answer. Self-consistency improves robustness — it does not guarantee accuracy. When confidence is low (e.g. 3/10 vs 4/10 vs 3/10), treat it as a signal to add more context or escalate.

---

## Part 8: Connections to other keywords

→ **Chain of Thought** *(already covered)*: self-consistency is a direct extension of CoT. Without a CoT prompt, there are no diverse reasoning paths to aggregate.

→ **Temperature & Top-p** *(already covered)*: temperature controls the diversity level between paths. It is the single most critical parameter for self-consistency — temperature = 0 breaks the entire technique.

→ **Hallucination & Grounding** *(already covered)*: self-consistency reduces hallucination by filtering anomalous reasoning paths through majority vote. A hallucination appearing in 1 out of 10 paths won't affect the final result.

→ **In-context Learning** *(already covered)*: the quality of few-shot examples in the CoT prompt directly affects path quality. Better examples → better paths → more accurate majority vote.

→ **Prompt Optimization** *(coming up)*: when optimizing prompts, you can use the consistency score as a metric — a better prompt produces higher consistency across paths on the same test set.

---

## Part 9: Self-test

**Q1**: Explain self-consistency in your own words without using the terms "majority vote" or "reasoning path".

**Q2**: You're building a spam/not-spam classifier for a business. In what situations would you apply self-consistency, and what N would you choose?

**Q3**: Your manager wants to use self-consistency to generate marketing taglines for a new product. How do you explain why this isn't the right use case?

**Q4**: Compare self-consistency with single-pass Chain of Thought: when is single CoT enough, and when do you need self-consistency on top?

**Q5**: Suppose a technique called "weighted self-consistency" assigns each path a weight based on reasoning length instead of doing a simple majority vote. In what situations would this be better or worse?

---

## Part 10: Exercise (24h challenge)

**Task**: Build a math problem solver for grade-6 problems using self-consistency.

**Requirements**:
- Input: 5 grade-6 word problems (your choice or from a textbook)
- Run self-consistency with N=7, temperature=0.7
- Print: majority vote answer, vote ratio (e.g. 5/7), and distribution of all distinct answers
- Compare against the correct answer

**Acceptance criteria**:
- [ ] Code runs correctly on at least 5 problems
- [ ] Displays a confidence score (vote ratio) for each problem
- [ ] At least 3 of 5 problems have confidence ≥ 5/7
- [ ] At least 1 problem where self-consistency is correct but single-pass CoT (one run) is wrong

**Estimated time**: 45 minutes

**Hint**: Use Claude Haiku to keep costs low. 5 problems × 7 samples = 35 calls — Haiku makes this very cheap.

---

## Self-test Answers (read after answering on your own)

**Q1**: Self-consistency runs the same question multiple times, collects different solution approaches, then picks the answer that appears most often. Like asking 10 friends the same math question and trusting the answer most of them agree on.

**Q2**: Spam classification has a clear answer (spam/not spam) — a good use case. Use N=7–10 for borderline emails, especially when the cost of false positives (blocking important email) or false negatives (spam getting through) is high. For obviously spam emails, N=3 is enough.

**Q3**: Marketing taglines have no single "correct" answer — each can be good in a different way. Majority vote surfaces the most generic option, not the most creative. Instead, use a single pass with high temperature to generate multiple options, then let a human choose.

**Q4**: Single CoT is enough when: the question is simple, latency matters, budget is limited, or the question is open-ended without a unique correct answer. You need self-consistency when: the question involves multiple complex steps, the cost of being wrong is high, you need a confidence estimate, or you're debugging model behavior.

**Q5**: Weighted self-consistency by reasoning length could be better for complex multi-step problems where longer reasoning suggests the model considered more carefully. But it would be worse if the model tends to overthink and produce long but incorrect reasoning chains. There is no clear evidence that longer reasoning equals higher accuracy.
