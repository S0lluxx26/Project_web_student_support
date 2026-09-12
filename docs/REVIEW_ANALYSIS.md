# 후기 분석 기능 검토 · Review-Analysis Feature: Feasibility and Design

A teammate proposed analysing reviews of a specific property from platforms
like 직방 or 숨고. This memo is the honest answer: the feature is worth
building, but **not in the form proposed** — two of its premises don't hold,
and a third carries criminal exposure in Korea.

Read §1 before writing any code.

---

## 1. Three problems with the proposal as stated

### 1.1 Per-property reviews mostly don't exist on 직방/다방

This is the load-bearing problem. These are **listing** platforms, not review
platforms. What they carry is:

- Listings posted by 중개사, with agent contact details
- Agent-level trust signals (직방's 안심중개사 scheme and similar)
- Occasional ratings of the *agent*, not of the room or building

There is no meaningful corpus of "residents of this building said X". A
one-room in a 5-unit 빌라 has no review page anywhere, because the population
who could write one is five households with a one-to-two-year turnover.

What these platforms *do* have in abundance is a well-documented 허위매물 (fake
listing) problem — listings that don't exist, are already taken, or are priced
to bait. That is a real, analysable signal, and it is about **listing text**,
not reviews.

### 1.2 숨고 is the wrong platform entirely

숨고 is a services marketplace — 이사, 청소, 인테리어, 과외. Its reviews are of
**service providers**, not housing. A 숨고 review tells you whether a moving
company showed up on time. It says nothing about a room's deposit risk.

If the intent was "reviews of the moving company I'll hire", that's a different
(and much less important) feature. If the intent was "reviews of this house",
숨고 does not have them.

### 1.3 Where property-level reviews actually exist

| Source | Covers | Usable? |
|---|---|---|
| 카카오맵 / 네이버 지도 place reviews | **고시원, 원룸텔** — these are registered businesses with map listings | **Yes**, via official APIs. Best available source. |
| 호갱노노 and similar | 아파트 단지 | Not our users — students rent 원룸/고시원, not 아파트 |
| 대학 커뮤니티 (에브리타임 etc.) | Everything, honestly | Closed platforms. Read manually; **never scrape or repost**. |
| 네이버 블로그 / 카페 자취 후기 | Scattered | Real but unstructured; user can paste one |
| 직방 / 다방 | Agents, not properties | Not a review source |

**The one genuinely good source is map reviews of goshiwons**, precisely because
a goshiwon is a business with a storefront, an address, and dozens of past
residents. That is also the flow where our users are most exposed, since they
may be paying a deposit sight-unseen.

---

## 2. The legal constraints

Two separate bodies of law apply, and they cut in different directions.

### 2.1 Scraping: risky, and unnecessary

The leading authority is **대법원 2022. 5. 12. 선고 2021도1533** (an
accommodation-platform crawling case, which ended in acquittal). The court
looked at three frameworks:

- **정보통신망법** — unauthorised access turns on "objective circumstances
  including security measures or terms of service". The defendant was acquitted
  partly because the API had no protective measures and the terms were unclear
  as to non-members. A platform with clear ToS and any access control is a very
  different case.
- **저작권법 (데이터베이스제작자의 권리)** — infringement requires "repeated or
  systematic reproduction" producing "substantially similar results" to copying
  the whole database, judged both quantitatively and qualitatively.
- **부정경쟁방지법** — unauthorised use of the fruits of another's substantial
  investment. No criminal penalty, but civil liability, and the newsletter
  analysis expects this route to grow in importance.

The acquittal is not a green light. It turned on narrow facts — only 3–8 of 50
data fields taken, publicly disclosed, little investment in collection. And
civil courts may reach a different conclusion on identical conduct.

For us the analysis is simpler: **every one of these platforms forbids
automated collection in its terms of service**, we are a student project with
no legal budget, and we do not need the data anyway (see §3). Scraping 직방 or
다방 is not a risk worth taking for a feature whose premise is already wrong.

### 2.2 Publishing conclusions about a named property: the bigger risk

This is the part most teams miss. Under **정보통신망법 제70조**:

- Publicly disclosing **true facts** that damage a person's reputation, with
  intent to defame: **up to 3 years' imprisonment or a 30 million won fine**.
- **False facts**: up to 7 years, or a 70 million won fine.

Truth is not a complete defence. Korea criminalises 사실적시 명예훼손 — stating
facts that are actually true — where the intent is to harm reputation. (It is a
반의사불벌죄: prosecution stops if the victim explicitly withdraws, which is
cold comfort once it has started.)

Concretely: a page on our site that says **"○○고시원 — 위험, 후기 분석 결과
사기 의심"**, naming a real business, is criminally actionable by that business
even if every underlying review is accurate. The aggregation and the conclusion
are ours, not the reviewers'.

**This rules out**: publishing per-property risk scores, maintaining a public
database of flagged buildings or landlords, or displaying an aggregate verdict
about a named business to anyone other than the user who supplied the input.

**This permits**: analysing text the user pasted and showing the result **to
that user only**, in their browser, with nothing stored or published. Which is
exactly our existing architecture.

---

## 3. What to build instead

The good news: the useful 80% of the idea survives, and it fits the tool's
existing shape — user pastes text, browser analyses it, nothing leaves the
device, nothing is published.

### Phase 1 — Review credibility analyser (paste-based, no scraping)

The user finds reviews themselves (map app, blog, 카페, wherever) and pastes
them in. We analyse the **set of reviews** for the signals that distinguish
genuine feedback from manufactured or suppressed feedback:

**Fake-review signals**
- Near-duplicate text across reviews — `Detector.scan()` already does this, and
  it is the single strongest signal. Review farms reuse sentences.
- Clustering of 5-star reviews in a short window, with generic praise
  ("깨끗해요 친절해요 추천합니다") and no specific detail.
- Reviews that read like listing copy — repeating the advertised features in
  marketing language rather than lived experience.
- Absence of any middling review. Real places get 3-star reviews.

**Suppression signals**
- Substantive complaints (곰팡이, 소음, 보증금 반환) clustered in the oldest
  reviews with a wall of short positive ones on top.
- Replies from the operator that threaten rather than address.

**Substance extraction** — what the reviews actually say about the things that
matter for a goshiwon decision, mapped onto our existing visit checklist:
소방/비상구, 창문, 방음, 곰팡이, 온수, 공용 주방 청결, 관리자 응대, and above
all **보증금 반환** — the one that costs money.

This needs no new infrastructure. It is `detector.js` with a second corpus and
a few concept rules, and the output is a private, per-user analysis.

### Phase 2 — Map place lookup via official APIs

For goshiwons only, and only through documented, terms-compliant APIs
(Kakao Local, Naver Search). Use them to confirm the **business exists at the
claimed address**, and to show its registered name and category so the user can
check it against the 사업자등록증 the operator gave them. A name mismatch there
is a hard signal.

Note this requires an API key and therefore a small serverless proxy, since a
key in client-side JavaScript is a key you have published. That is a real cost;
Phase 1 has none. Do Phase 1 first and see whether Phase 2 is still wanted.

### Never

- Scraping any listing platform.
- Storing or publishing a verdict about a named building, landlord or agency.
- Republishing review text that others wrote.
- Ranking or listing "dangerous" properties.

---

## 4. Implementation sketch for Phase 1

A third entry point alongside the two existing ones:

```
#/reviews  →  paste reviews  →  credibility + substance analysis
```

Reusing what already exists:

```js
// Near-duplicate detection across the pasted reviews — the strongest
// fake-review signal, and Detector already does exactly this.
var reviews = splitIntoReviews(pastedText);
var duplicates = [];
for (var i = 0; i < reviews.length; i++) {
  for (var j = i + 1; j < reviews.length; j++) {
    var sim = Detector.jaccard(reviews[i], reviews[j]);
    if (sim > 0.55) duplicates.push({ a: i, b: j, similarity: sim });
  }
}

// Substance: which of the things that matter are actually mentioned,
// and in which direction. Concept rules, same engine as the chat analyser.
var topics = Detector.matchRules(pastedText, REVIEW_LEXICON, REVIEW_RULES);
```

`REVIEW_LEXICON` needs concepts we don't have yet — MOULD, NOISE, HOT_WATER,
DEPOSIT_RETURNED, DEPOSIT_WITHHELD, MANAGER_RESPONSIVE, FIRE_SAFETY — each with
its Korean surface forms, plus POSITIVE/NEGATIVE polarity markers so
"곰팡이 없어요" is not read as a complaint. That negation handling is the part
that will take the most iterations; budget for it.

Output, to that user only:

- **이 후기들 중 n개가 서로 매우 유사합니다** with the pairs shown, so they can
  judge for themselves rather than being told a verdict.
- **후기에서 언급된 항목**: what residents actually said about each checklist
  topic, grouped.
- **후기에 없는 항목**: which checklist topics nobody mentioned — often more
  informative than what is there, and it feeds straight into the question
  generator we already have.

That last one is the feature's real value, and it is something no review site
offers: turning the *silence* in a review set into questions to ask.

---

## 5. Recommendation

Build Phase 1. It is a few days of work, reuses the detector we already have,
carries no legal exposure, and produces something genuinely novel.

Drop 직방/다방 review scraping — the reviews aren't there, and the risk is
real. Drop 숨고 entirely; it is the wrong platform.

If the team wants a 직방/다방 feature, the right one is **fake-listing
detection on listing text**, not reviews: the user pastes a listing, and we flag
photo-count anomalies, price-versus-market gaps, missing 등록번호, and copy that
matches known bait-listing phrasing. Same engine, same paste-based privacy
model, and it addresses the problem those platforms actually have.

---

## Sources

- [크롤링 관련 최근 대법원 판결과 그 시사점 — 법무법인 세종](https://www.shinkim.com/kor/media/newsletter/1843) (대법원 2021도1533)
- [인터넷 명예훼손의 처벌 등 — 찾기쉬운 생활법령정보](https://www.easylaw.go.kr/CSP/CnpClsMain.laf?csmSeq=293&ccfNo=1&cciNo=1&cnpClsNo=2)
- [정보통신망법 제70조 — CaseNote](https://casenote.kr/%EB%B2%95%EB%A0%B9/%EC%A0%95%EB%B3%B4%ED%86%B5%EC%8B%A0%EB%A7%9D_%EC%9D%B4%EC%9A%A9%EC%B4%89%EC%A7%84_%EB%B0%8F_%EC%A0%95%EB%B3%B4%EB%B3%B4%ED%98%B8_%EB%93%B1%EC%97%90_%EA%B4%80%ED%95%9C_%EB%B2%95%EB%A5%A0/%EC%A0%9C70%EC%A1%B0)
- [데이터 전쟁 시대: 크롤링 소송 사례와 합법·불법의 기준 — 법무법인 슈가스퀘어](https://blog.sugar.legal/%EB%8D%B0%EC%9D%B4%ED%84%B0-%EC%A0%84%EC%9F%81-%EC%8B%9C%EB%8C%80-%ED%81%AC%EB%A1%A4%EB%A7%81-%EC%86%8C%EC%86%A1-%EC%82%AC%EB%A1%80%EC%99%80-%ED%95%A9%EB%B2%95%EB%B6%88%EB%B2%95%EC%9D%98-%EA%B8%B0%EC%A4%80-67064)
- [직방·다방 등 부동산앱, 허위 매물 많아 — 이코리아](https://www.ekoreanews.co.kr/news/articleView.html?idxno=19057)

*This memo is an engineering assessment, not legal advice. Before shipping
anything that names a real business, get an opinion from someone qualified.*
