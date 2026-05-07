---
title: "Multi-turn vs Single-turn — Conversations with and without Memory"
description: "Single-turn means each request is independent — the model remembers nothing from before. Multi-turn is a continuous conversation — the model sees the full history and uses it to respond. Understanding both modes determines how you design API calls, estimate costs, and manage the context window."
locale: "en"
translationKey: "multi-turn"
publishedAt: 2026-05-07
pillar: "ai"
type: "article"
draft: false
---

## TL;DR

**Single-turn** means each request is independent — the model remembers nothing from before. **Multi-turn** is a continuous conversation — the model sees the full history and uses it to respond. Understanding both modes determines how you design API calls, estimate costs, and manage the context window.

---

## Part 1: The Problem It Solves

In 2023, a developer was building a customer support chatbot. He called the API like this:

```python
response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    messages=[{"role": "user", "content": "My name is Minh"}]
)

# Later...
response2 = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    messages=[{"role": "user", "content": "Do you remember my name?"}]
)
```

Result: the model replied "I don't know your name." The customer was frustrated. The code had no bugs — but the developer didn't understand that each API call is completely independent. The model has no automatic memory.

Multi-turn solves this by sending the full conversation history with every request.

---

## Part 2: Precise Definition

**Single-turn**: A request containing only one user message (or a system prompt + one user message). The model responds and that's the end. No context from previous requests.

**Multi-turn**: A request containing a list of alternating `user` and `assistant` messages that reconstruct the full conversation history. The model sees all of it and uses that context to respond.

Distinguishing from easily-confused concepts:

| Concept | Has history? | Server saves state? | Context grows? |
|---|---|---|---|
| Single-turn | ❌ | ❌ | No |
| **Multi-turn** | ✅ | ❌ | ✅ each turn |
| Stateful API | ✅ | ✅ | Depends on impl |

Claude's API (and most LLM APIs) is *stateless*. The server saves nothing. Multi-turn works because the *client* sends back the full history each time.

---

## Part 3: How It Works

### Single-turn

```
Client → [system, user_msg] → API → Response → (done)
```

### Multi-turn

```
Turn 1: Client → [system, user1]                               → API → assistant1
Turn 2: Client → [system, user1, assistant1, user2]            → API → assistant2
Turn 3: Client → [system, user1, assistant1, user2, assistant2, user3] → API → assistant3
```

Each turn, the client appends the new (user, assistant) pair and resends everything. Token count grows linearly with the number of turns.

Implementation with the Claude API:

```python
conversation_history = []

def chat(user_message):
    conversation_history.append({
        "role": "user",
        "content": user_message
    })

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=conversation_history
    )

    assistant_message = response.content[0].text
    conversation_history.append({
        "role": "assistant",
        "content": assistant_message
    })

    return assistant_message
```

---

## Part 4: Concrete Examples

### Example 1: Single-turn — classification pipeline

You need to classify 10,000 customer reviews. Each review is independent — no context needed from previous reviews.

```python
def classify_review(review_text):
    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=10,
        messages=[{
            "role": "user",
            "content": f"Classify as POSITIVE/NEGATIVE/NEUTRAL: {review_text}"
        }]
    )
    return response.content[0].text.strip()
```

Single-turn is correct here: each call is independent, cheap, and scales well.

### Example 2: Multi-turn — coding assistant

A user asks about a piece of code, then follows up with "how do I test it?" — the second question is meaningless without context from the first.

```python
history = []

# Turn 1
history.append({"role": "user", "content": "Write a Python fibonacci function"})
r1 = client.messages.create(model="claude-sonnet-4-6", max_tokens=500, messages=history)
history.append({"role": "assistant", "content": r1.content[0].text})

# Turn 2 — model knows "it" refers to the fibonacci function above
history.append({"role": "user", "content": "How do I test it?"})
r2 = client.messages.create(model="claude-sonnet-4-6", max_tokens=500, messages=history)
# Output: specific test cases for fibonacci, not generic testing advice
```

---

## Part 5: When to Use

**Scenario 1: Batch processing independent items**
Classifying, summarizing, or extracting from documents that have no relation to each other. No context needed between items → single-turn is cheaper and scales better.

**Scenario 2: Conversational UX**
Chatbots, coding assistants, customer support — any flow where users follow up based on previous responses. Multi-turn is required.

**Scenario 3: Iterative refinement**
A user asks to draft an email, then "make it shorter," then "make it more formal." Each refinement needs context from all prior steps.

---

## Part 6: When NOT to Use

**Anti-pattern 1: Multi-turn for independent tasks**
You use multi-turn to classify reviews because it "feels cleaner to manage." Result: context from review #1 bleeds into review #2's classification. Use single-turn instead — keep each call fully isolated.

**Anti-pattern 2: Multi-turn with no turn limit**
A 50-turn conversation fills the context window → the model produces low-quality answers or returns an error. Implement a sliding window (keep the last N turns) or summarize history periodically.

**Anti-pattern 3: Assuming conversation state persists automatically**
You expect that when a user reconnects, the conversation continues. But if you haven't persisted the history to a database, the state is gone. Multi-turn state is the client's responsibility, not the API's.

---

## Part 7: Gotchas & Pitfalls

**Gotcha 1: Token cost grows with every turn**
Turn 1: 100 tokens. Turn 10: potentially 1,000+ tokens just from history. With many concurrent users, costs compound fast. Detect by logging `response.usage.input_tokens` each turn. Fix: truncate history after N turns or summarize.

**Gotcha 2: Context drift**
After 20+ turns, the model may contradict information from early in the conversation. This isn't a bug — it's a limitation of attention when context grows very long. Fix: inject key facts into the system prompt rather than relying solely on conversation history.

**Gotcha 3: Roles must alternate in the correct order**
Claude's API requires messages to alternate `user` → `assistant` → `user`. If you append incorrectly (two `user` messages in a row), the API returns a validation error immediately. Fix: validate role sequence before sending each request.

**Gotcha 4: History is not automatically persisted**
If the server restarts or the user reconnects without a database, the conversation is lost. Multi-turn state must be manually persisted to storage if you need durability.

---

## Part 8: Connections

→ **Context window** (covered): Multi-turn fills the context window faster. Understanding the context window limit helps you decide when to truncate history.

→ **Token / Tokenization** (covered): Input tokens in each multi-turn request include the entire conversation history, not just the latest message. Cost is calculated on the total.

→ **System vs User prompt** (covered): The system prompt appears once but counts toward input tokens on *every* request. A long system prompt is a fixed token overhead per turn.

→ **Prompt caching** (coming up): Multi-turn with long conversation history is the primary use case for prompt caching — caching old history to reduce costs significantly.

→ **Agent loop** (covered): An agent loop is a specialized form of multi-turn where the model generates its own "turns" (tool results) without user input after each step.

---

## Part 9: Self-test

**Q1**: Explain why the Claude API is stateless yet still supports multi-turn conversations. Who is responsible for storing and resending the history?

**Q2**: You're building an automated email summarizer — 500 emails per day, each processed independently. Do you choose single-turn or multi-turn? Explain your reasoning and what you need to watch out for.

**Q3**: When is multi-turn actually a mistake — even when the UX appears to "need a conversation"?

**Q4**: Compare how multi-turn uses the context window versus how an agent loop does. What's similar and what's different?

**Q5**: If the Claude API suddenly supported server-side session memory (the server stores history automatically), what would change technically and cost-wise? What trade-offs would that introduce?

---

## Part 10: Exercise (24h challenge)

**Task**: Build a CLI chatbot with multi-turn support and cost tracking.

**Requirements**:
1. User types a message and receives a response — loop until the user types "quit"
2. After each turn, print the tokens used in that turn and the running total for the conversation
3. Automatically truncate when the conversation exceeds 10 turns (keep the last 5)
4. Persist history to a JSON file — on restart, ask the user if they want to load the previous conversation
5. On exit, print the estimated total cost (assume $3/1M input tokens, $15/1M output tokens)

**Estimated time**: 45–60 minutes

**Hint**: `response.usage` returns `input_tokens` and `output_tokens` for each request.

---

## Self-test Answers (read after answering on your own)

**Q1**: The API is stateless because the server stores nothing between requests. Multi-turn works because the client sends back the full conversation history (the list of messages) with every request. The client — your application — is responsible for storing and resending that history.

**Q2**: Single-turn. Each email is an independent task; it doesn't need context from other emails. Multi-turn would add unnecessary token cost and risk context contamination (information from one email affecting analysis of another). Key thing to watch: ensure each API call is completely isolated with no shared conversation history.

**Q3**: When the "turns" in the conversation are actually independent tasks packaged in dialog format. For example: a user asks 10 different factual questions in a row — each is independent and doesn't need context from the previous one. Using multi-turn here increases cost and can confuse the model.

**Q4**: Both accumulate context over time. Similarity: each step adds to the context window and cost grows accordingly. Difference: multi-turn adds human input, agent loops add tool results and model reasoning. Agent loops tend to be denser (tool outputs can be very long) so the context window fills faster.

**Q5**: Technically: the client no longer needs to send history → each request is smaller → latency drops. Cost-wise: input tokens could decrease if the server handles compression or caching. Trade-offs: vendor lock-in, privacy concerns (the server holds your conversation data), harder to debug (can't inspect the full context), and if the server has issues, history is lost. Many sensitive use cases (healthcare, finance) don't want server-side conversation storage.
