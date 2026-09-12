# 현장 조사 프로토콜 · Field Research Protocol

How to actually set up and test the apps students use, and turn what you find
into rules the tool can run. Written so a teammate can pick it up and start
today without asking anyone questions.

The point of this is **not** to browse the apps and form impressions. It is to
come back with sentences — real messages, real listing copy — that we can add
to `data/patterns.json` and `data/lexicon.json` as testable rules.

---

## 0. Ground rules before you start

**Never send money.** Not a holding deposit, not 만원, not "just to see what
happens". If a conversation reaches the point where money is the next step,
stop and write down how you got there. That transcript is the finding.

**Never sign anything**, and never hand over your 주민등록번호, a photo of your
ID, or your bank details. "저는 아직 알아보는 단계예요" ends any conversation
politely.

**Don't waste an agent's afternoon.** Viewing rooms you cannot rent has a real
cost to the person showing them. Do your in-person visits in one area on one
day, be honest that you are comparing, and don't book viewings you won't attend.

**Save everything.** Screenshots with timestamps, exported KakaoTalk chats,
listing URLs and the date you saw them. A finding you cannot quote is not a
finding.

**Anonymise before it enters the repo.** Strip names, phone numbers, exact
addresses, agency registration numbers and room numbers. We keep the *shape*
of the sentence, never the person. See "What goes in the repo" at the end —
this matters legally, not just ethically.

---

## 1. The apps, and what each is actually for

Install all of these on one phone. They overlap, and the differences are the
interesting part.

| App | What it actually is | Why it matters to us |
|---|---|---|
| **직방 (Zigbang)** | The largest one-room/officetel listing app. Listings are posted by 중개사, not owners. | Biggest volume of agent-written listing copy. Its "허위매물" problem is well documented and is a pattern source. |
| **다방 (Dabang)** | The other big listing app, same model. | Cross-check: the *same room* often appears on both at different prices. That discrepancy is itself a signal. |
| **피터팬의 좋은방 구하기** | Started as a 직거래 (owner-to-tenant, no agent) community, now mixed. | Direct-from-owner messages are where identity and proxy scams concentrate — no licensed agent in between. |
| **네이버 부동산** | Aggregates listings, ties them to 단지/건물 records. | Best for checking whether a building exists and what else is listed in it. |
| **고시원넷 / 고시원 aggregators** | Goshiwon-specific listing sites. | Our goshiwon flow needs real goshiwon listing copy, which the big apps barely carry. |
| **당근마켓 부동산** | Local classifieds, increasingly used for rooms. | Lowest verification of all — worst listings, therefore richest pattern source. |
| **학교 커뮤니티 (에브리타임 etc.)** | Student boards with 자취방 threads. | Where students actually warn each other. Read-only, and do **not** scrape or repost. |

A practical note on accounts: most of these require a Korean phone number to
message an agent. If a teammate is abroad, they can still browse listings and
read copy, but the conversation half of this protocol needs someone in Korea.

---

## 2. Setup, once

1. Install the apps above. Use a real account, but **not** your main KakaoTalk
   if you can avoid it — conversations with agents generate a lot of follow-up.
2. Turn on screenshot-to-cloud so you don't lose evidence.
3. Learn to export a KakaoTalk chat: 채팅방 → 메뉴 → 대화 내용 내보내기 →
   텍스트 파일. This is exactly the format our analyzer expects, which is not
   a coincidence — test the tool with real exports.
4. Open a shared spreadsheet with the columns in §5. One row per listing.
5. Pick **two contrasting areas** and stick to them, e.g. a university area with
   heavy student turnover (신촌, 회기, 상록수) and a cheaper outer area. Patterns
   differ by market and you want both.

---

## 3. The listing sweep (do this first, ~2 hours)

Goal: 30–40 listings recorded, no conversations yet.

For each app, filter to a realistic student budget (보증금 500–2000만원,
월세 40–70만원) in your two areas, then record the first 8–10 listings.

For each one, capture:

- The full listing text, verbatim. Copy it, don't summarise it.
- Price, deposit, maintenance fee, floor, area (전용면적), move-in date.
- How many photos, and whether they look wide-angle or reused.
- Whether the 중개사무소 name and 등록번호 are shown.
- The listing URL and the date.

Then do the three cross-checks that produce most of the findings:

**Cross-check A — is the same room listed twice?** Search the other apps for
the same building/floor/area. Note any price difference. A room listed at
40만원 on one app and 55만원 on another is a bait listing on one of them.

**Cross-check B — does the price make sense?** Look up the building on
[국토교통부 실거래가](https://rt.molit.go.kr) and 네이버 부동산. Anything more
than ~20% below comparable listings goes in the "too good" bucket.

**Cross-check C — does the building exist as described?** 건축물대장 on
[정부24](https://www.gov.kr) is free. Check the 용도 and any 위반건축물 flag.
A listing advertising a "주거용 오피스텔" that the register calls
근린생활시설 is a concrete, documentable finding.

---

## 4. The conversation sweep (the valuable part)

Goal: 10–15 real conversations, ended before any money is discussed.

Message agents through the app about listings from §3. Use the same three
opening messages every time, so the replies are comparable:

> **Opening A (neutral):** "안녕하세요, 올려주신 매물 보고 연락드립니다. 아직
> 방이 있나요? 실제 방 사진을 좀 더 볼 수 있을까요?"

> **Opening B (the register question):** "계약 전에 등기부등본을 직접 확인하고
> 싶은데, 주소를 알려주실 수 있을까요?"

> **Opening C (the remote question):** "제가 지금 지방에 있어서 당장 방문이
> 어려운데, 어떻게 진행하면 될까요?"

Opening B and C are the diagnostic ones. B separates agents who hand over the
address immediately from those who deflect — and deflection is our
`id-refuse-register` pattern in the wild. C invites exactly the remote-contract
pitch that our `good-remote-keys` pattern is about, without you having to
propose it.

Record, for each conversation:

- How long until the address was given, or that it never was.
- Whether they proposed any payment before a viewing, and in what words.
- Whose name the account would be in, if they mentioned it.
- Any urgency language, quoted exactly.
- Whether they offered a video call when you said you couldn't visit.

**When to stop:** the moment money becomes the next concrete step. Say
"확인해보고 다시 연락드리겠습니다" and leave.

---

## 5. What to record — the spreadsheet

| Column | Notes |
|---|---|
| `date` | When you saw it |
| `app` | 직방 / 다방 / 피터팬 / 네이버 / 고시원넷 / 당근 |
| `area` | Neighbourhood only, not the address |
| `deposit` / `rent` / `maintenance` | 만원 |
| `listed_by` | 중개사 / 집주인 / 불명 |
| `reg_number_shown` | Y/N |
| `price_vs_market` | −30% / −10% / 시세 / +10% |
| `dual_listed` | Y/N, and the price gap |
| `building_register_ok` | Y / N / 확인불가 + what was wrong |
| `asked_address` | Given immediately / after pressing / refused |
| `proposed_prepay` | Y/N + the exact sentence |
| `urgency_language` | The exact sentence |
| `remote_contract_offered` | Y/N + the exact sentence |
| `video_call_offered` | Y/N |
| `quote_1`…`quote_3` | Verbatim sentences worth turning into rules |
| `screenshot` | Link |

The `quote_*` columns are the deliverable. Everything else is context.

---

## 6. In-person visits (3–5 rooms, one afternoon)

Use the tool's own checklists — that is the point of building them. Open
`#/goshiwon` for a goshiwon visit and the document checklist for a one-room.

Additionally record, for our purposes:

- How the room compares to its photos. Estimate the real 면적 in steps and
  compare to the listed 전용면적. Quantify the gap; "smaller than it looked"
  is not a finding, "listed 6평, paced about 4" is.
- Whether the 중개사 등록증 and 공제증서 were actually displayed in the office.
- What happened when you asked to photograph the 등기부등본 or the 신분증.
- For goshiwon: whether the room has an outside window, how many exits the
  corridor has, and whether the manager lives on site.

---

## 7. Turning findings into rules

This is the step that makes the whole exercise worth doing. A finding becomes
either a **pattern** (a specific wording) or a **concept** (a new way of saying
an existing idea). Most findings are the second kind.

**If you found a new way of saying something we already cover**, add the surface
form to `data/lexicon.json` under the right concept. Example: an agent wrote
"입금 확인되면 방 킵해드려요". We already have the `HOLD_ROOM` concept, but not
"킵". Adding `"킵"` to `HOLD_ROOM` immediately improves every rule that mentions
it. This is the highest-value, lowest-risk contribution.

**If you found a genuinely new tactic**, add a pattern to `data/patterns.json`
following `docs/CONTRIBUTING.md`, with the real sentence as its `sample`.

Then verify, from the repo root:

```bash
node scripts/test-detector.js     # every sample must still be detected
python3 -m http.server 8000       # then check the sentence in the UI
```

The test asserts that every pattern's own sample sentence is detected and that
the benign control sentences stay silent. If your new keyword makes a benign
control fire, the keyword is too broad — narrow it or express it as a concept
pair instead.

---

## 8. What goes in the repo, and what does not

**Goes in:** the shape of a sentence, with identifying details replaced.

> "오늘 ○○금 먼저 입금해주시면 방 잡아드릴게요" ✅

**Does not go in:** anything that identifies a real agent, landlord, agency,
building or listing. Not in code, not in comments, not in commit messages, not
in the spreadsheet if the spreadsheet is public.

This is not only politeness. Under 정보통신망법 제70조, publishing facts that
damage a named person's reputation is a criminal offence in Korea **even when
the facts are true** — up to 3 years or a 30 million won fine. A repo that
names "○○부동산" as a scammer is a liability for whoever pushed it, and the
truth of the claim is not a complete defence. Keep the patterns, drop the names.
`docs/REVIEW_ANALYSIS.md` covers this in more detail.

If you believe you have found actual fraud in progress, that is a report to
경찰 112 or [ecrm.police.go.kr](https://ecrm.police.go.kr), not a commit.

---

## 9. A realistic schedule

| When | What | Output |
|---|---|---|
| Day 1, 2h | Setup + listing sweep, app by app | 30–40 rows |
| Day 1, 1h | The three cross-checks | Discrepancies flagged |
| Day 2, 2h | Conversation sweep, openings A/B/C | 10–15 transcripts |
| Day 2, 3h | In-person visits, one area | Photo-vs-reality notes |
| Day 3, 2h | Convert quotes into lexicon and pattern entries | A pull request |
| Day 3, 1h | Run the tests, fix what fires wrongly | Green suite |

One person can do this in three half-days. Two people splitting the areas get
better cross-checks, because you can compare the same listing seen by two
accounts — which is, incidentally, how you detect price discrimination.

---

## Sources

- [크롤링 관련 최근 대법원 판결과 그 시사점 — 법무법인 세종](https://www.shinkim.com/kor/media/newsletter/1843)
- [인터넷 명예훼손의 처벌 — 찾기쉬운 생활법령정보](https://www.easylaw.go.kr/CSP/CnpClsMain.laf?csmSeq=293&ccfNo=1&cciNo=1&cnpClsNo=2)
- [직방·다방 등 부동산앱, 허위 매물 많아 — 이코리아](https://www.ekoreanews.co.kr/news/articleView.html?idxno=19057)
- [직방·다방, '가짜 부동산' 매물 어떻게 거를까 — ZDNet Korea](https://zdnet.co.kr/view/?no=20170804162647)
