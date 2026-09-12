# Project Plan — Student Housing Safety Assistant (학생 주거 안전 도우미)

**Repo:** https://github.com/S0lluxx26/Project_web_student_support
**Live site (after deploy):** https://s0lluxx26.github.io/Project_web_student_support/
**Status:** v1 implemented (see Phase 1). Last updated 2026-09-12.

---

## 1. Goal

A free web service that helps students in Korea avoid rental fraud and bad
housing decisions. On entry the user picks one of two paths:

| Path | What the user gets |
|------|--------------------|
| **독립 주거 (Independent housing — 원룸/오피스텔/빌라)** | A document checklist (등기부등본 first), guided upload with per‑document red‑flag questions, and a **conversation analyzer** that scans chats/messages with the agent or landlord for known scam signals. |
| **고시원 (Goshiwon)** | Firm instruction to **visit in person**. If they cannot, a short questionnaire about their needs generates a tailored list of questions to ask the manager, and only after that does the tool advise how/when to pay a deposit safely. |

Target users: Korean university students and international students (hence a
Korean/English toggle).

## 2. Constraints and key decisions

* **Static hosting on GitHub Pages.** No backend, no database, no server-side
  model. Everything runs in the browser.
* **"Trained on scam patterns" = curated rule engine.** A hand‑built knowledge
  base (`data/patterns.json`) encodes common Korean rental‑fraud patterns as
  keyword/regex rules with weights, explanations and recommended actions.
  A JavaScript engine matches conversation text against them and produces a
  risk score, a list of detected signals and next steps. This is
  deterministic, free, private (nothing leaves the browser) and easy for
  non‑developers to extend by editing JSON.
* **Uploaded documents never leave the device.** The upload step is a
  client‑side checklist: files are read only to display name/size/preview and
  to walk the user through what to check on each document. No OCR in v1
  (candidate for Phase 2 with Tesseract.js).
* **Vanilla HTML/CSS/JS, no build step.** Deploys as‑is; anyone can edit.
* **Bilingual (KO default, EN toggle)** via a `data-i18n` attribute system and
  `data/i18n.json`; language preference stored in `localStorage`.
* **Not legal advice.** Every result screen carries a disclaimer and links to
  official help (HUG 전세피해지원센터, 국토교통부, 경찰 112, 대한법률구조공단 132).

## 3. Repository layout

```
Project_web_student_support/
├── index.html                 # single-page app shell (all views)
├── assets/
│   ├── css/style.css          # design system, layout, components, dark mode
│   └── js/
│       ├── i18n.js            # language loading + DOM translation
│       ├── analyzer.js        # rule engine: normalize → match → score → report
│       ├── goshiwon.js        # questionnaire → question generator → deposit advice
│       ├── housing.js         # document checklist + upload handling
│       └── app.js             # router (hash-based views), wiring, state
├── data/
│   ├── patterns.json          # scam-pattern knowledge base (KO/EN)
│   ├── documents.json         # required documents + what-to-check items
│   ├── goshiwon.json          # conditions → questions mapping
│   └── i18n.json              # UI strings KO/EN
├── docs/
│   ├── SCAM_PATTERNS.md       # human-readable catalogue of patterns and sources
│   └── CONTRIBUTING.md        # how to add a pattern / translate
├── .github/workflows/deploy.yml   # GitHub Pages deployment
├── .nojekyll
├── .gitignore
├── PLAN.md                    # this file
└── README.md
```

## 4. User flows

### 4.1 Landing (`#/`)
Hero + two large choice cards. Language toggle in header. Footer with
disclaimer and emergency contacts.

### 4.2 Independent housing (`#/housing`)
Step 1 — **Documents.** Checklist from `documents.json`:
1. 등기부등본 (property register) — the mandatory one. Guidance: issue it
   yourself on the day of contract from 인터넷등기소 (iros.go.kr); check 갑구
   (owner matches the person you're contracting with), 을구 (근저당권/
   mortgage amount vs. your deposit; 가압류/가처분/압류/경매), 신탁 등기.
2. 건축물대장 — building register; check 위반건축물, 용도 (주거용 vs 근린생활시설).
3. Landlord ID (신분증) and, if via agent, 공인중개사 등록증 / 자격증 — verify on
   국가공간정보포털 (V‑World) 부동산중개업 조회.
4. 위임장 + 인감증명서 if the signer is not the owner.
5. 국세/지방세 완납증명서 (landlord's tax certificates — can be requested since
   the 2023 law change).
6. 전입세대열람내역 (for multi‑unit buildings — prior tenants with priority).
7. 확정일자 + 전입신고 immediately after moving in.

Each item: description, "what to check", risk questions with yes/no toggles
that feed the overall risk assessment, and an optional file attach (client
only; shows name/size, image preview).

Step 2 — **Conversation analyzer.** Textarea for pasting KakaoTalk/SMS/call
notes. Optional context fields: deposit (보증금), monthly rent, whether the
person is landlord or agent. Runs `analyzer.js`:

* Normalize: lower‑case, strip spacing variants, unify numerals (억/만원).
* Match each pattern's `keywords` (substring, KO+EN) and `regex` entries.
* Score = Σ weight of matched patterns, capped; adjusted by context (e.g.
  deposit high relative to typical → boosts mortgage‑related warnings).
* Output: risk level (안전/주의/위험/매우 위험), matched signals with the
  quoted sentence, why it matters, and what to do; plus a "questions to ask
  next" list.

Step 3 — **Result & checklist export.** Combined report of document answers
and conversation signals. "Copy report" and "Print" buttons.

### 4.3 Goshiwon (`#/goshiwon`)
Step 1 — **Visit‑first screen.** Big message: always visit in person; what to
check on a visit (fire exits/sprinklers, window, noise, shared kitchen, lock,
CCTV, contract terms, refund rule).
Choice: "I can visit" → visit checklist. "I'm far away / cannot visit" → Step 2.

Step 2 — **Conditions questionnaire.** Budget range, window (외창/내창/무창),
private bathroom, gender‑separated floor, meal provision (밥/김치/라면),
laundry, distance/transport, stay length, quiet‑study vs. sociable, cooking
needs, parking/bike, pets no.

Step 3 — **Generated question list.** From `goshiwon.json`, rules select
questions matching the user's conditions (plus universal ones: 관리비 포함
여부, 보증금 환불 규정, 최소 계약기간, 중도 퇴실 시 환불, 사진/영상 통화 요청,
사업자등록 확인). Copy / share buttons.

Step 4 — **Deposit advice (only after Step 3).** Ask for a video call tour,
request 사업자등록증 and bank account in the business/owner name, pay by
bank transfer with memo, get a written receipt/contract via 카톡, pay only a
small 예약금 before arrival if possible, never pay to a personal account of a
third party, keep all messages.

## 5. Scam‑pattern knowledge base (summary — full list in docs/SCAM_PATTERNS.md)

Categories (each pattern has id, category, severity 1–5, KO/EN keywords,
optional regex, explanation, action):

1. **Deposit / payment pressure** — "오늘 계약 안 하면 다른 사람이", 가계약금 먼저,
   계좌로 지금 입금, 현금 요구, 개인 계좌(제3자 명의), 영수증 없음.
2. **Identity / authority** — 집주인 대신 (대리인), 위임장 없이, 등기부등본 못 보여줌,
   신분증 거절, 중개사 등록번호 회피, 명의 다름.
3. **Property register red flags (from conversation)** — 근저당 많지만 괜찮다,
   신탁 회사 소유, 가압류·경매 언급, 깡통전세 신호 (매매가 ≈ 전세가), 융자 있음.
4. **Contract irregularities** — 확정일자·전입신고 미루라는 요구, 전입신고 하지
   마세요, 특약 없이, 구두 약속, 계약서 나중에, 이중계약, 월세를 전세로 광고.
5. **Too‑good‑to‑be‑true** — 시세보다 매우 저렴, 조건 없이 즉시 입주, 무보증,
   해외 거주 집주인 (overseas landlord, keys by mail).
6. **Goshiwon‑specific** — 방문 불필요, 사진만 보고 계약, 보증금 환불 불가,
   업체명 없는 계좌.
7. **Agent behaviour** — 다른 매물 계속 밀어붙임, 서류 사진 촬영 금지, 급하게
   서명 요구, 수수료 과다/현금.

Scoring: severity‑weighted sum → thresholds (0–14 low, 15–34 caution,
35–59 high, ≥60 very high). Every match prints the offending sentence.

## 6. Deployment

The whole repository root *is* the site, so GitHub Pages needs no build step. There are two
ways to publish it; the first needs no workflow file at all.

**Option A — Deploy from branch (simplest, recommended).** In the repo: Settings → Pages →
Build and deployment → Source = "Deploy from a branch", Branch = `main`, folder = `/ (root)`.
Save. Pages rebuilds on every push to `main`. `.nojekyll` at the root stops Jekyll from
ignoring files.

**Option B — GitHub Actions.** Add `.github/workflows/deploy.yml` (provided separately; it
validates the JSON data files, then uploads the repo root as a Pages artifact and deploys),
and set Settings → Pages → Source = "GitHub Actions". Use this if you want the JSON
validation gate on every push.

Site URL: `https://s0lluxx26.github.io/Project_web_student_support/`. All asset and data paths
are relative, so the project sub-path works without configuration.

### First push (run on the Windows machine, in Git Bash or PowerShell)

```bash
cd C:\Users\nguye\source\repos\Project_web_student_support
git init -b main
git add .
git commit -m "Initial site: student housing safety assistant"
git remote add origin git@github.com:S0lluxx26/Project_web_student_support.git
git push -u origin main
```

SSH push requires a key registered with GitHub; `ssh -T git@github.com` should greet you by
username. If it does not, generate one with `ssh-keygen -t ed25519 -C "your@email"` and add
`~/.ssh/id_ed25519.pub` under GitHub → Settings → SSH and GPG keys.

## 7. Phases

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Static site, two flows, rule engine, KO/EN, GitHub Pages | ✅ done |
| 2 | OCR of 등기부등본 with Tesseract.js (client‑side) to auto‑detect 근저당/가압류/신탁 lines; 시세 lookup guidance; PDF report export | planned |
| 3 | Optional LLM analysis (user‑supplied API key, or a small serverless proxy) for free‑text reasoning; community‑reported patterns via GitHub Issues template | planned |
| 4 | Accessibility audit (WCAG AA), Lighthouse ≥ 95, unit tests for analyzer (Vitest), CI check | planned |

## 8. Testing

* Manual: both flows, KO/EN toggle, mobile widths (375px), print view.
* Automated smoke (Playwright, run locally): landing renders, navigation
  works, analyzer flags a known scam sample as 위험, goshiwon questionnaire
  produces ≥ 8 questions.
* Analyzer regression: `docs/SCAM_PATTERNS.md` includes sample sentences per
  pattern; each must be detected.

## 9. Legal / ethical notes

* Informational tool; not legal advice — stated on every result screen.
* No data collected; no analytics in v1.
* Sources for pattern catalogue: 국토교통부 전세사기 예방 안내, HUG 전세피해지원센터,
  경찰청 전세사기 유형 안내, 대한법률구조공단 FAQ, news‑reported fraud cases 2022‑2026.
