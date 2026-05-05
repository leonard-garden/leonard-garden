# Temperature & Top-p — How You Control LLM Randomness

## TL;DR

**Temperature** and **Top-p** are two parameters that control how an LLM selects the next token when generating text. Temperature scales the entire probability distribution, while Top-p limits the sampling pool to tokens whose cumulative probability meets a threshold. Understanding these two parameters lets you deliberately shift output from "creative and diverse" to "consistent and precise."

---

## Part 1: The Problem They Solve

Thang was building an internal tool that used Claude to generate code snippets. He left the defaults as-is. First run with the prompt "Write a Python function to validate email" — clean, solid output. Second run, same prompt — extra comments nobody asked for, a different function name, a different error handling style.

He restarted the app, ran it again — different again. Thang assumed the model was broken.

It wasn't broken. LLMs aren't deterministic functions. Every time you run one, the model is *sampling* a token from a probability distribution — like rolling a weighted die, not running a calculator. The issue was that Thang didn't know he could adjust that die.

Temperature and Top-p are the tools for doing exactly that.

---

## Part 2: Precise Definitions

**Temperature** is a scalar applied to the logits before the softmax step:

```
P(token) = softmax(logits / temperature)
```

- `temperature = 0`: always pick the highest-probability token (greedy decoding)
- `temperature = 1`: sample from the model's original distribution (default)
- `temperature < 1`: "sharpen" the distribution — high-probability tokens get even more weight
- `temperature > 1`: "flatten" the distribution — lower-probability tokens get more of a chance

For Claude, the range is **0 to 1**. Some other models (e.g., GPT-4) allow up to 2.

**Top-p (nucleus sampling)** filters the sampling pool before selecting a token. Instead of sampling from the full vocabulary (~50k–100k tokens), Top-p keeps only the smallest set of tokens whose cumulative probability ≥ p.

- `top_p = 1.0`: use the full vocabulary (no filtering)
- `top_p = 0.9`: sample only from the top tokens that together account for 90% of the probability mass

Easy to confuse: **Top-p vs Top-k**. Top-k fixes the *number* of tokens (always take the top k by probability). Top-p fixes the *probability ratio*, so pool size varies with context: when the model is confident (concentrated distribution), the pool is small; when uncertain (flat distribution), the pool is large. Top-p is more adaptive than Top-k for this reason.

---

## Part 3: How It Works

Each time the model generates a token, it runs through this pipeline:

```
[Step 1] Compute logits
         Model outputs a real-valued score for every token in the vocabulary
         Example: "Paris"=3.2, "London"=2.1, "banana"=-1.5, ...

[Step 2] Apply Temperature
         logits_scaled = logits / temperature
         temperature=0.5 → sharpen (Paris=6.4, London=4.2, banana=-3.0)
         temperature=2.0 → flatten (Paris=1.6, London=1.05, banana=-0.75)

[Step 3] Softmax → Probabilities
         Convert logits to probabilities (sum = 1.0)

[Step 4] Top-p Filter (if set)
         Sort tokens by probability descending
         Keep tokens until cumsum ≥ p
         Discard the rest

[Step 5] Sample
         Randomly select 1 token from the remaining pool
```

Result: one token is chosen, appended to the context, and the process repeats from Step 1.

---

## Part 4: Concrete Examples

### Example 1: Code generation requiring consistency

```python
import anthropic

client = anthropic.Anthropic()

# low temperature → more deterministic output
response = client.messages.create(
    model="claude-opus-4-5",
    max_tokens=1024,
    temperature=0.0,  # greedy decoding
    messages=[{
        "role": "user",
        "content": "Write a Python function to validate email address"
    }]
)

print(response.content[0].text)
# Output will be consistent across multiple calls
```

### Example 2: Brainstorming taglines that need variety

```python
# high temperature → creative, diverse
responses = []
for _ in range(3):
    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=256,
        temperature=1.0,  # max for Claude
        messages=[{
            "role": "user",
            "content": "Write 1 tagline for an AI startup that helps developers code faster"
        }]
    )
    responses.append(response.content[0].text)

# Three runs will produce three different taglines
for i, r in enumerate(responses, 1):
    print(f"Attempt {i}: {r}")
```

### Example 3: Using top_p

```python
# Use top_p only (leave temperature at default)
response = client.messages.create(
    model="claude-opus-4-5",
    max_tokens=512,
    top_p=0.8,  # sample only from top 80% probability mass
    messages=[{
        "role": "user",
        "content": "Explain quantum entanglement to someone with no physics background"
    }]
)
```

---

## Part 5: When to Use Them

**Situation 1: Tasks requiring precision and consistency**

Code generation, fact extraction, classification, structured data parsing. Set `temperature=0.0` or very low (0.1–0.3). Output becomes nearly deterministic, easy to test, easy to debug. Ideal for production pipelines where reproducibility matters.

**Situation 2: Creative tasks requiring diversity**

Brainstorming, copywriting, story generation, idea exploration. Set `temperature=0.7–1.0`. Each call produces a different angle — this is behavior you *want*, not a bug. Run multiple times and pick the best.

**Situation 3: Conversational chatbot**

Natural conversation needs a balance between consistency and variety. `temperature=0.5–0.7` is usually the sweet spot. Not too robotic (temperature=0) and not too unpredictable (temperature=1).

---

## Part 6: When NOT to Use Them

**Anti-pattern 1: Adjusting both temperature and top_p at the same time**

Anthropic is explicit: *"We recommend altering this or temperature but not both."* Both parameters affect sampling. Combining them creates behavior that's hard to predict and debug. Pick one to adjust; leave the other at its default.

**Anti-pattern 2: Using temperature=0 for creative tasks**

Temperature=0 always picks the highest-probability token. For a brainstorming prompt, you'll get the exact same output every single time. Ask 10 times, receive 10 identical answers — completely defeating the point of brainstorming.

**Anti-pattern 3: Thinking higher temperature = smarter output**

Temperature has no effect on the model's *knowledge quality*. It only changes how sampling works. Higher temperature = more random = higher risk of hallucination. For factual accuracy tasks, high temperature is counterproductive.

---

## Part 7: Gotchas & Pitfalls

**Gotcha 1: temperature=0 is not 100% reproducible**

Due to floating-point arithmetic across different hardware (GPU vs CPU, CUDA versions), output can still vary slightly even at temperature=0. Don't assume absolute determinism in distributed systems.

**Gotcha 2: Claude's range is 0–1, not 0–2**

If you copy code from a tutorial written for GPT (which allows temperature up to 2), setting `temperature=1.5` with Claude will throw a validation error. Claude's range is 0 to 1 — check the docs for whichever model you're using.

**Gotcha 3: Extended Thinking mode requires temperature=1**

When using Claude with extended thinking (enabling `thinking` in the API), the model requires `temperature=1` and doesn't support `top_p` or `top_k`. Attempting to set temperature to anything other than 1 will be rejected. This is an Anthropic constraint, not a bug.

**Gotcha 4: top_p too low degrades output**

`top_p=0.3` means using only the top tokens that make up 30% of the probability mass — an extremely small pool. With a diverse vocabulary, this can produce repetitive or stilted output. Values below 0.5 are rarely useful unless you know exactly what you're doing.

**Gotcha 5: Temperature applies token-by-token, not to the whole response**

Temperature doesn't set a "creativity level" for the entire response. It applies to *each individual token*. A long response at temperature=1.0 can start coherent and drift toward incoherence near the end — because each token "rolls the dice" independently.

---

## Part 8: Connections to Other Keywords

→ **Token & Tokenization** (already covered): Temperature acts directly on the probability of each token. No tokenization, no logits, no temperature.

→ **Context Window** (already covered): Context window determines the *input* the model sees. Temperature determines how *output* is sampled. The two mechanisms are independent.

→ **Attention / Lost in the Middle** (already covered): The attention mechanism computes logits for each token. Temperature receives those logits and scales them before softmax. Attention and Temperature/Top-p operate at different steps in the pipeline.

→ **Hallucination** (coming soon): Higher temperature increases hallucination risk by letting the model sample less probable tokens — including ones that "invent" information.

→ **Prompt Engineering** (coming soon): A system prompt shapes *what* the model will say. Temperature/Top-p controls *how* the model samples when saying it. Getting both right is a core skill for building LLM applications.

---

## Part 9: Self-test

**Q1**: Without looking back at the article, explain in your own words: why do temperature=0.0 and temperature=1.0 produce different levels of "diversity"?

**Q2**: You're building a customer support chatbot that answers questions about a fixed refund policy (static facts). What temperature do you set and why?

**Q3**: Anthropic recommends not adjusting both temperature and top_p at the same time. What is the technical reason behind this recommendation?

**Q4**: Explain the difference between top_p=0.9 and top_k=50 when the model is very confident about the next token (concentrated distribution). Which one produces a smaller pool?

**Q5**: A team is using Claude with extended thinking enabled and wants to increase output "creativity." They can't adjust temperature. What other approaches might they try to get more diverse outputs?

---

## Part 10: 24h Challenge

**Task**: Write a Python script that calls the Claude API 9 times (3 prompts × 3 temperature levels), logs all outputs, and compares the results.

```python
# Suggested structure
prompts = [
    "Write a one-sentence description of machine learning",  # factual
    "Write a catchy tagline for a coffee shop",              # creative
    "What is 15 + 27?",                                      # deterministic
]
temperatures = [0.0, 0.5, 1.0]

# Call each combination, save results
# Compare: does the factual prompt vary much across temperatures?
# Does the creative prompt vary?
# What about the math prompt?
```

**Acceptance criteria**:
1. Script runs successfully and calls the real API (no mocks)
2. Output is saved or printed with clear formatting for easy comparison
3. You write at least 3 specific observations about differences across temperatures
4. You identify which prompt type is most "sensitive" to temperature changes
5. Bonus: add one experiment with top_p=0.5 and compare it to temperature=0.5

**Estimated time**: 45–60 minutes.

---

## Self-test Answers (read only after answering yourself)

**Q1**: Temperature scales logits before softmax. temperature=0 always picks the highest-probability token (deterministic). temperature=1 keeps the model's original distribution and samples from it directly. Lower temperature concentrates probability onto the top token — output becomes repetitive, consistent. Higher temperature spreads probability across more tokens — less probable tokens get a chance, output becomes more diverse and unpredictable.

**Q2**: temperature=0.0 or very low (0.1). A support chatbot answering policy questions needs accurate, consistent answers — this is a factual task with no need for creativity. Higher temperature risks the model "creatively" adding policy details that don't exist.

**Q3**: Both affect the sampling step. Temperature changes the shape of the distribution; Top-p filters the pool. Combining both modifies the distribution at two separate layers — the resulting behavior is complex, hard to predict, and when something goes wrong, it's difficult to know which parameter caused it.

**Q4**: When the model is confident, the distribution is concentrated — the top 1–2 tokens might account for 80%+ of the probability mass. `top_p=0.9` will keep very few tokens (maybe 2–3) because just a handful are needed to reach 90% cumulative probability. `top_k=50` always keeps exactly 50 tokens regardless of probability. When the model is confident, Top-p produces a much smaller pool — this is why Top-p is considered more adaptive than Top-k.

**Q5**: A few options: (1) Use prompt instructions asking the model to generate multiple distinct alternatives, (2) Run multiple calls and select the best, (3) Use multi-turn conversation to steer toward different directions. Extended thinking with temperature=1 still has randomness — there are just no additional levers beyond prompt engineering.
