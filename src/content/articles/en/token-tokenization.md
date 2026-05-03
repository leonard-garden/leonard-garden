---
title: "Token & Tokenization — The Atomic Unit LLMs Actually See"
description: "A token is the smallest unit an LLM processes — not a character, not a word. Tokenization converts text into a token sequence before feeding it into a model. Understanding tokens helps you debug context limit errors, optimize API costs, and explain why models read English cheaper than Vietnamese."
locale: "en"
translationKey: "token-tokenization"
publishedAt: 2026-05-02
pillar: "ai"
type: "article"
draft: false
---

## TL;DR

A token is the smallest unit an LLM processes — not a character, not a word. Tokenization is the process of converting text into a sequence of tokens before feeding it into a model. Understanding tokens helps you debug context limit errors, optimize API costs, and explain why models "read" English cheaper than Vietnamese.

---

## 1. The Problem It Solves

A developer used GPT-3 to analyze Japanese resumes. The model returned wrong results consistently. After extensive debugging, the root cause emerged: the model wasn't "reading" Japanese character by character — it was reading in chunks, and those chunks didn't align with Japanese semantic boundaries.

The core problem: neural networks need processing units that carry meaning, but characters are too small (26 letters carry little information), and words are too many (English has 170,000+ dictionary entries — an unmanageable vocabulary). Tokenization solves this by finding the middle ground: sub-word units that balance vocabulary size against semantic representation.

---

## 2. Precise Definition

**Token** is the unit of text an LLM processes. A token can be:
- A complete word: `"hello"` → 1 token
- Part of a word: `"unbelievable"` → `"un"` + `"believ"` + `"able"` → 3 tokens
- A special character or punctuation: `"!"` → 1 token
- Whitespace plus a word: `" hello"` (leading space) → a different token than `"hello"`

**Tokenization** is the process of converting a text string into a sequence of token IDs (integers) for the model to consume.

Common confusions to avoid:
- Token ≠ Word: "ChatGPT" is one word but may be 2+ tokens
- Token ≠ Character: 1 token typically equals 3–4 characters (for English)
- Token ≠ Syllable: token boundaries are learned from corpus statistics, not phonetics

*BPE* (Byte Pair Encoding) is the most widely used tokenization algorithm. The name "Byte Pair" comes from how it originally merged the most frequent byte pairs — now applied to character pairs.

---

## 3. How It Works

BPE operates in two phases:

**Training (offline — building the vocabulary):**
```
1. Start with vocabulary = set of individual characters
2. Count frequency of every adjacent token pair in the corpus
3. Merge the most frequent pair into one new token
4. Repeat until reaching the target vocabulary size (e.g., 50,000 tokens)
```

**Inference (online — encoding new text):**
```
Input text → split into characters → apply learned merge rules in order → sequence of token IDs
```

Example: encoding `"lower"`:
```
"lower"
→ [l, o, w, e, r]        # start from individual characters
→ [lo, w, e, r]          # merge "l"+"o" — frequent pair
→ [low, e, r]            # merge "lo"+"w"
→ [lower]                # merge "low"+"er" — "-er" suffix is very common
→ [1234]                 # token ID in vocabulary
```

For Vietnamese, because it appears less in training corpora, many words get split into smaller pieces:
```
"tokenization" → ~4 tokens  (English, common technical term)
"mã hóa token" → 7+ tokens  (Vietnamese, less represented in corpus)
```

---

## 4. Concrete Examples

**Example 1: Counting tokens with tiktoken**

```python
import tiktoken

# cl100k_base is GPT-4's encoding — used here to illustrate the concept
# Claude uses its own tokenizer, but behavior is similar
enc = tiktoken.get_encoding("cl100k_base")

texts = [
    "Hello, world!",
    "Xin chào thế giới!",
    "1234567890",
    "unbelievable",
]

for text in texts:
    tokens = enc.encode(text)
    print(f"{repr(text):30} → {len(tokens):2} tokens")
```

Output (illustrative — actual IDs depend on version):
```
'Hello, world!'                →  4 tokens
'Xin chào thế giới!'          →  9 tokens   # ~2x compared to English translation
'1234567890'                   →  5 tokens   # long numbers get split
'unbelievable'                 →  4 tokens   # sub-word pieces
```

**Example 2: Whitespace affects token boundaries**

```python
import tiktoken

enc = tiktoken.get_encoding("cl100k_base")

# Leading space creates a different token
print(enc.encode("hello"))   # e.g.: [15339]
print(enc.encode(" hello"))  # e.g.: [24748]  ← different token ID!
print(enc.encode("Hello"))   # e.g.: [9906]   ← capitalization also creates a different token!
```

This is why models can be inconsistent with casing and punctuation — they are distinct tokens in the vocabulary.

---

## 5. When You Need to Understand Tokenization

**Situation 1: Debugging "context too long" errors**

You paste a 500-line file into Claude and hit a context limit error. If you understand tokenization, you can estimate: 500 lines of code ≈ 5,000–8,000 tokens — close to the limit in some configs. Instead of retrying randomly, you decide to split the file or switch to a model with a larger context window.

**Situation 2: Optimizing API costs**

The Claude API charges by token. If your system prompt uses heavily formatted numbers like `1,234,567.89`, each number may cost 4–6 tokens. Rewriting as `1234567.89` saves tokens without losing information.

**Situation 3: Explaining output inconsistency**

Why does the model frequently misspell rare words? Rare words get split into many tokens, forcing the model to reconstruct them piece by piece — a much weaker training signal than common words represented as a single intact token.

---

## 6. When NOT to Think in Tokens

**Anti-pattern 1: Manually counting tokens while writing prompts**

Writing a prompt while constantly worrying "how many tokens is this sentence, will it fit?" is premature optimization. Write naturally first, then measure with a tool if you actually need to optimize.

**Anti-pattern 2: Assuming English is always cheaper**

Code (heavy on special characters), large numbers, and long technical terms still cost many tokens even in English. Measure rather than assume all English text costs 1 token per word.

**Anti-pattern 3: Writing terse prompts to "save tokens"**

An ambiguous 100-token prompt plus 3 retries costs more than a clear 200-token prompt that answers correctly on the first try. Full context is an investment, not waste.

---

## 7. Gotchas & Pitfalls

**Gotcha 1: Numbers and date formats tokenize differently than you expect**

`"2024"` may be 1 token. `"2,024"` is 2–3 tokens. `"2024-01-01"` is different again. The format of numbers and dates affects token count — and sometimes affects how the model reasons about them.

**Gotcha 2: Vocabulary differs across models**

Claude, GPT-4, and Llama use different tokenizers. Token counts from tiktoken don't apply precisely to Claude. To measure accurately for Claude, use the Anthropic API `count_tokens` endpoint or estimate with an adjustment factor.

**Gotcha 3: Emojis and Unicode cost more tokens than they look**

An emoji like 🚀 takes 2–3 tokens because it's multi-byte UTF-8. Production system prompts full of emojis are a real token drain.

**Gotcha 4: Token boundaries can affect code generation**

Special characters in code like `__init__` can sometimes be split into `__` + `init` + `__`. The model must reconstruct it — uncommon but it happens, especially with unusual syntax.

**Gotcha 5: "1 token ≈ 4 chars" is a rule of thumb, not a law**

True for English prose. Code is typically 3–4 chars/token. Vietnamese/Chinese/Japanese is typically 1–2 chars/token because each syllable becomes its own token. Mental math will be wrong if you don't account for this.

---

## 8. Connections to Other Keywords

→ **Context window** (coming up): Context windows are measured in tokens, not characters or words. Without understanding tokenization, context limits are just meaningless numbers.

→ **Prompt caching** (coming up): Caching operates at the token level — the prefix token sequence must be identical for a cache hit. Designing prompts for caching requires thinking in terms of token boundaries.

→ **Hallucination & Grounding** (coming up): Models hallucinate rare words partly because those words are split into many small tokens with weaker training signal.

→ **Determinism in LLMs** (coming up): Temperature sampling happens at the token level — each step the model picks one token from a probability distribution. This is the source of non-determinism.

→ **Observability** (coming up): Monitoring cost and performance of an LLM app requires tracking input tokens, output tokens, and cached tokens separately — all measured in tokens.

---

## 9. Self-test

Answer these **without looking at the article** — write your answers down before checking:

**Q1:** Explain tokenization to someone non-technical: why doesn't an LLM read text character by character, and why not word by word either?

**Q2:** You're building a Vietnamese-language chatbot. API costs are running 40% higher than expected. Could tokenization be the cause? Explain specifically.

**Q3:** When should you NOT try to write short prompts to "save tokens"?

**Q4:** A context window of 200,000 tokens roughly equals how many pages of English text? How many pages of Vietnamese? (Estimate, using the rule of thumb.)

**Q5:** Why do token boundaries affect whether a model can spell certain words correctly?

---

## 10. 24h Exercise

**Task:** Analyze the real token cost of text you use regularly.

**Description:** Take a system prompt or prompt template you use frequently and analyze its token composition to find optimization opportunities.

**Steps:**
1. Install tiktoken: `pip install tiktoken`
2. Encode your text using `cl100k_base` — print each token and its ID
3. Calculate the chars/token ratio — compare against the 4 chars/token rule of thumb
4. Identify the 3 sections that cost the most tokens
5. Write an optimized version that reduces token count by ≥10% without losing key information

**Acceptance criteria:**
- [ ] Python script runs successfully and outputs the token list
- [ ] Identified 3 high-cost sections with explanation of *why* they're expensive (not just "they have many tokens")
- [ ] Optimized version achieves ≥10% token reduction
- [ ] Noted 1 thing that surprised you during the exercise

**Estimated time:** 45–60 minutes

---

## Self-test Answers (read only after writing your own answers)

**Q1:** Individual characters are too small to carry meaning — the model would need too many steps to understand one word. Full words make the vocabulary too large (hundreds of thousands of entries), making it unlearnable. Tokens are the middle ground: sub-word units small enough to keep vocabulary manageable (~50k tokens), large enough to carry semantic signal.

**Q2:** Yes. Vietnamese appears less frequently in most tokenizers' training corpora, so many words get split into more tokens. The same meaning can cost 1.5–2x as many tokens in Vietnamese versus English. To verify: measure with Anthropic's `count_tokens` API rather than estimating.

**Q3:** When cutting context causes the model to answer incorrectly, leading to retries that cost more tokens than a complete prompt would have. A clear 200-token prompt is typically cheaper than an ambiguous 100-token prompt plus 3 retries.

**Q4:** Rule of thumb: 1 A4 page of English (~250–300 words) ≈ 350–400 tokens. 200k tokens ≈ 500–570 pages of English. Vietnamese costs more tokens per page → 200k tokens ≈ 300–400 pages of Vietnamese (estimate, varies by content type).

**Q5:** Common words are represented as a single intact token — the model has strong training signal to reproduce them. Rare words get split into 3–4 tokens, and the model must predict each piece sequentially with fewer training examples — like assembling a puzzle with sparse data, making errors more likely.
