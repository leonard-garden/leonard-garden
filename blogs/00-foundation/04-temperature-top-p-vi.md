# Temperature & Top-p — Bạn điều khiển độ ngẫu nhiên của LLM như thế nào

## TL;DR

**Temperature** và **Top-p** là hai tham số điều khiển cách LLM chọn token tiếp theo khi sinh text. Temperature scale toàn bộ phân phối xác suất, Top-p giới hạn pool sampling chỉ còn các token có cumulative probability cao nhất. Hiểu đúng hai tham số này giúp bạn kiểm soát output từ "sáng tạo, đa dạng" sang "nhất quán, chính xác" một cách có chủ ý.

---

## Phần 1: Vấn đề nó giải quyết

Thắng đang build một internal tool dùng Claude để generate code snippet. Anh dùng mặc định, không set gì cả. Lần đầu chạy với prompt "Write a Python function to validate email", ra một bài sạch đẹp. Lần hai, cùng prompt đó, output có thêm một đống comment không ai yêu cầu, function name khác, error handling style cũng khác.

Anh restart app, chạy lại — lại khác. Thắng nghĩ model bị lỗi.

Không phải lỗi. LLM không phải một function deterministic. Mỗi lần chạy, model đang *sample* một token từ phân phối xác suất — như tung xúc xắc lệch, không phải máy tính bình thường. Vấn đề là Thắng không biết mình có thể điều chỉnh cái xúc xắc đó.

Temperature và Top-p chính là công cụ để làm điều đó.

---

## Phần 2: Định nghĩa chính xác

**Temperature** là scalar áp dụng vào logits trước bước softmax:

```
P(token) = softmax(logits / temperature)
```

- `temperature = 0`: luôn chọn token có xác suất cao nhất (greedy decoding)
- `temperature = 1`: sample theo phân phối gốc của model (default)
- `temperature < 1`: "sharpen" phân phối — token xác suất cao càng được ưu tiên hơn
- `temperature > 1`: "flatten" phân phối — các token ít probable hơn có cơ hội được chọn nhiều hơn

Với Claude, range là **0 đến 1**. Một số model khác (GPT-4) cho phép lên đến 2.

**Top-p (nucleus sampling)** là cơ chế lọc pool trước khi sample. Thay vì sample từ toàn bộ vocabulary (~50k-100k tokens), Top-p chỉ giữ lại tập token nhỏ nhất sao cho cumulative probability của chúng ≥ p.

- `top_p = 1.0`: dùng toàn bộ vocabulary (không lọc gì)
- `top_p = 0.9`: chỉ sample từ top tokens tạo thành 90% probability mass

Dễ nhầm: **Top-p vs Top-k**. Top-k fix *số lượng* token (luôn lấy đúng k tokens cao nhất). Top-p fix *tỷ lệ xác suất*, nên pool size thay đổi tùy context: khi model confident (phân phối concentrated), pool nhỏ; khi model uncertain (phân phối flat), pool lớn. Top-p linh hoạt hơn Top-k ở điểm này.

---

## Phần 3: Cơ chế hoạt động

Mỗi bước sinh token, model trải qua pipeline sau:

```
[Step 1] Tính logits
         Model output một vector số thực cho mỗi token trong vocabulary
         Ví dụ: "Paris"=3.2, "London"=2.1, "banana"=-1.5, ...

[Step 2] Apply Temperature
         logits_scaled = logits / temperature
         temperature=0.5 → sharpen (Paris=6.4, London=4.2, banana=-3.0)
         temperature=2.0 → flatten (Paris=1.6, London=1.05, banana=-0.75)

[Step 3] Softmax → Probabilities
         Chuyển logits thành xác suất (tổng = 1.0)

[Step 4] Top-p Filter (nếu set)
         Sort tokens theo probability giảm dần
         Giữ tokens đến khi cumsum ≥ p
         Loại bỏ phần còn lại

[Step 5] Sample
         Random chọn 1 token từ pool còn lại
```

Kết quả: một token được chọn, append vào context, lặp lại từ Step 1.

---

## Phần 4: Ví dụ cụ thể

### Ví dụ 1: Code generation cần nhất quán

```python
import anthropic

client = anthropic.Anthropic()

# temperature thấp → output deterministic hơn
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
# Output sẽ nhất quán qua nhiều lần gọi
```

### Ví dụ 2: Brainstorm tagline cần đa dạng

```python
# temperature cao → creative, diverse
responses = []
for _ in range(3):
    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=256,
        temperature=1.0,  # max của Claude
        messages=[{
            "role": "user",
            "content": "Viết 1 tagline cho startup AI giúp developer viết code nhanh hơn"
        }]
    )
    responses.append(response.content[0].text)

# Ba lần chạy sẽ cho 3 tagline khác nhau
for i, r in enumerate(responses, 1):
    print(f"Attempt {i}: {r}")
```

### Ví dụ 3: Kết hợp top_p

```python
# Chỉ dùng top_p (không đổi temperature)
response = client.messages.create(
    model="claude-opus-4-5",
    max_tokens=512,
    top_p=0.8,  # chỉ sample từ top 80% probability mass
    messages=[{
        "role": "user",
        "content": "Giải thích quantum entanglement cho người không học vật lý"
    }]
)
```

---

## Phần 5: Khi nào dùng

**Tình huống 1: Tasks cần chính xác, nhất quán**

Code generation, fact extraction, classification, structured data parsing. Set `temperature=0.0` hoặc rất thấp (0.1-0.3). Output gần như deterministic, dễ test, dễ debug. Phù hợp cho production pipelines nơi reproducibility quan trọng.

**Tình huống 2: Creative tasks cần đa dạng**

Brainstorming, copywriting, story generation, idea exploration. Set `temperature=0.7-1.0`. Mỗi lần gọi cho ra góc nhìn khác nhau — đây là behavior bạn *muốn*, không phải bug. Chạy nhiều lần rồi pick best.

**Tình huống 3: Conversational chatbot**

Hội thoại tự nhiên cần cân bằng giữa nhất quán và đa dạng. `temperature=0.5-0.7` thường là sweet spot. Không quá robotic (temperature=0) cũng không quá unpredictable (temperature=1).

---

## Phần 6: Khi nào KHÔNG dùng

**Anti-pattern 1: Chỉnh cả temperature lẫn top_p cùng lúc**

Anthropic khuyên rõ: *"We recommend altering this or temperature but not both."* Hai tham số này đều ảnh hưởng sampling, kết hợp chúng tạo ra behavior khó predict và debug. Chọn một cái để điều chỉnh, để cái kia ở default.

**Anti-pattern 2: Dùng temperature=0 cho creative tasks**

Temperature=0 luôn chọn token có probability cao nhất. Với một prompt brainstorm, bạn sẽ nhận được cùng một output mỗi lần. Hỏi 10 lần, nhận 10 câu trả lời giống hệt nhau — mất hoàn toàn giá trị của "brainstorm".

**Anti-pattern 3: Nghĩ temperature cao = thông minh hơn**

Temperature không ảnh hưởng đến *chất lượng kiến thức* của model. Nó chỉ thay đổi cách sample. Temperature cao hơn = ngẫu nhiên hơn = tăng risk hallucination. Với tasks cần factual accuracy, temperature cao là phản tác dụng.

---

## Phần 7: Gotchas & Pitfalls

**Gotcha 1: Temperature=0 không phải 100% reproducible**

Do floating-point arithmetic trên các hardware khác nhau (GPU vs CPU, CUDA versions), output có thể khác nhau một chút ngay cả khi temperature=0. Đừng assume determinism tuyệt đối trong distributed systems.

**Gotcha 2: Claude có range 0-1, không phải 0-2**

Nếu bạn copy code từ tutorial dùng GPT (cho phép temperature lên 2), set `temperature=1.5` với Claude sẽ báo validation error. Range của Claude là 0 đến 1 — kiểm tra docs của model bạn đang dùng.

**Gotcha 3: Extended Thinking mode yêu cầu temperature=1**

Khi dùng Claude với extended thinking (bật `thinking` trong API), model bắt buộc `temperature=1` và không hỗ trợ `top_p`, `top_k`. Cố set temperature khác 1 sẽ bị reject. Đây là constraint của Anthropic, không phải bug.

**Gotcha 4: Top-p quá thấp degraded output**

`top_p=0.3` nghĩa là chỉ dùng top tokens tạo thành 30% probability mass — một pool cực nhỏ. Với vocabulary đa dạng, điều này có thể tạo ra output lặp lại hoặc cứng nhắc. Top-p thấp hơn 0.5 hiếm khi hữu ích trừ khi bạn biết rõ mình đang làm gì.

**Gotcha 5: Temperature ảnh hưởng token-by-token, không phải toàn bài**

Temperature không set "creativity level" cho cả bài. Nó apply vào *mỗi token* riêng lẻ. Một bài dài với temperature=1.0 có thể bắt đầu coherent rồi drift sang incoherent ở cuối — vì mỗi token "tung xúc xắc" độc lập.

---

## Phần 8: Kết nối với keyword khác

→ **Token & Tokenization** (đã học): Temperature tác động trực tiếp lên probability của từng token. Không có tokenization, không có logits, không có temperature.

→ **Context Window** (đã học): Context window quyết định *input* model nhìn thấy. Temperature quyết định *output* được sample như thế nào. Hai cơ chế độc lập nhau.

→ **Attention / Lost in the Middle** (đã học): Attention mechanism tính logits cho mỗi token. Temperature nhận logits đó và scale trước khi softmax. Attention và Temperature/Top-p nằm ở hai bước khác nhau trong pipeline.

→ **Hallucination** (sẽ học): Temperature cao làm tăng risk hallucination vì cho phép model sample các token ít probable hơn — bao gồm cả những token "bịa" thông tin.

→ **Prompt Engineering** (sẽ học): System prompt định hướng *nội dung* model sẽ nói. Temperature/Top-p kiểm soát *cách* model sample khi nói. Kết hợp đúng hai cái này là core skill khi build LLM apps.

---

## Phần 9: Self-test

**Q1**: Không nhìn lại bài, giải thích bằng lời bạn: tại sao temperature=0.0 và temperature=1.0 cho ra output khác nhau về tính "đa dạng"?

**Q2**: Bạn đang build chatbot hỗ trợ khách hàng trả lời câu hỏi về chính sách hoàn tiền (facts cố định). Bạn set temperature bao nhiêu và tại sao?

**Q3**: Anthropic khuyên không nên chỉnh cả temperature lẫn top_p cùng lúc. Lý do kỹ thuật đằng sau khuyến nghị này là gì?

**Q4**: Giải thích sự khác biệt giữa top_p=0.9 và top_k=50 khi model đang rất confident về câu trả lời tiếp theo (phân phối concentrated). Cái nào cho pool nhỏ hơn?

**Q5**: Nếu một team đang dùng Claude với extended thinking bật lên và muốn tăng "creativity", họ không thể chỉnh temperature. Theo bạn, cách nào khác có thể tăng diversity của output?

---

## Phần 10: Bài tập áp dụng (24h challenge)

**Task**: Viết script Python gọi Claude API 9 lần với 3 prompt × 3 temperature levels, log và so sánh output.

```python
# Gợi ý cấu trúc
prompts = [
    "Write a one-sentence description of machine learning",  # factual
    "Write a catchy tagline for a coffee shop",              # creative
    "What is 15 + 27?",                                      # deterministic
]
temperatures = [0.0, 0.5, 1.0]

# Gọi mỗi combination, lưu kết quả
# So sánh: prompt factual có output khác nhau không?
# Prompt creative có output khác nhau không?
# Prompt toán học thì sao?
```

**Acceptance criteria**:
1. Script chạy được, gọi API thực tế (không mock)
2. Output được lưu vào file hoặc in ra có format rõ ràng để so sánh
3. Bạn viết được ít nhất 3 observation cụ thể về sự khác biệt giữa các temperature
4. Bạn xác định được: prompt nào "nhạy cảm" nhất với temperature?
5. Bonus: thêm 1 experiment với top_p=0.5 và so sánh với temperature=0.5

**Estimated time**: 45-60 phút.

---

## Đáp án Self-test (đọc sau khi tự trả lời)

**Q1**: Temperature scale logits trước softmax. Temperature=0 luôn chọn token xác suất cao nhất (deterministic). Temperature=1 giữ nguyên phân phối gốc, sample theo đúng xác suất đó. Temperature thấp hơn "dồn" xác suất về token top — output lặp lại, nhất quán. Temperature cao hơn "trải đều" xác suất — token ít probable có cơ hội được chọn nhiều hơn, output đa dạng và unpredictable hơn.

**Q2**: Temperature=0.0 hoặc rất thấp (0.1). Chatbot hỗ trợ cần trả lời chính sách chính xác, nhất quán — đây là factual task, không cần creativity. Temperature cao sẽ tăng risk model "sáng tạo" thêm chi tiết không có trong chính sách.

**Q3**: Cả hai đều tác động lên sampling step. Temperature thay đổi shape của phân phối, Top-p filter pool. Kết hợp cả hai tạo ra phân phối đã bị modify ở hai tầng — behavior phức tạp, khó dự đoán, và nếu có bug thì khó biết tham số nào gây ra.

**Q4**: Khi model confident, phân phối concentrated — token top 1 chiếm 80%+ probability. `top_p=0.9` sẽ lấy rất ít tokens (có thể 2-3) vì chỉ cần vài token là đã đủ 90% cumsum. `top_k=50` luôn lấy đúng 50 tokens bất kể probability. Khi confident, top_p cho pool nhỏ hơn nhiều — đây là lý do Top-p được coi là linh hoạt hơn Top-k.

**Q5**: Một số cách: (1) Thêm instruction trong prompt yêu cầu model đề xuất nhiều phương án khác nhau, (2) Chạy nhiều lần và pick best, (3) Dùng multi-turn conversation để steer sang hướng khác nhau. Extended thinking + temperature=1 vẫn có randomness, chỉ là không có thêm lever khác ngoài prompt engineering.
