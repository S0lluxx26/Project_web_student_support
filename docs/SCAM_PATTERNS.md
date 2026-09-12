# 사기 패턴 카탈로그 · Scam Pattern Catalogue

A human-readable view of `data/patterns.json` (version 1.0.0, updated 2026-09-12): 25 patterns across 7 categories.

**Scoring.** Each matched pattern contributes `severity × 5` points. Ticked document red flags and a deposit-to-value ratio above 70% add further points. Thresholds: caution 15, high 35, very high 60, capped at 100.

**Matching.** Keywords match after lower-casing and removing all whitespace, so Korean spacing variants match automatically. `combos` are groups of terms that must all appear in the *same sentence* — they catch conjugation variants (미루라고 / 미뤄주세요) without a single broad keyword that would fire on innocent text.

**Regression set.** Every sample sentence below is detected by its own pattern, and the benign control conversations in the README score zero. Re-run that check after editing this file.

## 입금·결제 압박 — Payment and deposit pressure

### `pay-urgency` — 입금을 서두르게 하는 압박

*Pressure to pay immediately* · **Severity 5/5**

**왜 / Why.** 정상적인 임대차 계약은 등기부등본 확인과 서류 검토에 시간이 필요합니다. '오늘 안 하면 다른 사람이 계약한다'는 말은 검증 시간을 빼앗기 위한 가장 흔한 사기 수법입니다.

A legitimate lease gives you time to check the property register and documents. 'Someone else will take it today' is the most common tactic used to stop you from verifying anything.

**대응 / Action.** 서두르지 마세요. 등기부등본을 직접 발급해 확인하기 전에는 어떤 금액도 입금하지 마십시오. 진짜 매물이면 하루 기다릴 수 있습니다.

Do not rush. Transfer nothing until you have issued and read the property register yourself. A real listing can wait a day.

**예시 / Sample.** `오늘 가계약금 100만원 먼저 입금하셔야 잡아드려요. 다른 분도 보고 계셔서요.`

`You need to send the holding deposit today, someone else is looking at it.`

Keywords (ko): `오늘 안 하면`, `오늘까지`, `지금 바로 입금`, `다른 사람이 보고`, `다른 분이 계약`, `빨리 결정`, `선입금`, `먼저 입금`, `가계약금`, `오늘 계약`, `마감 임박`, `곧 나가요`, `지금 결정`

Keywords (en): `today only`, `pay now`, `someone else is`, `decide quickly`, `deposit first`, `hurry`, `last one`, `right away`

Combos (all terms in one sentence): `오늘 + 입금`; `지금 + 입금 + 바로`; `빨리 + 결정`; `today + transfer`; `now + deposit`

### `pay-personal-account` — 소유자 명의가 아닌 계좌로 송금 요구

*Payment requested to an account not in the owner's name* · **Severity 5/5**

**왜 / Why.** 보증금은 반드시 등기부등본상 소유자 본인 명의 계좌로 입금해야 합니다. 제3자 계좌로 보낸 돈은 회수가 매우 어렵고, 임대인이 '받지 않았다'고 주장할 수 있습니다.

The deposit must go to an account in the registered owner's own name. Money sent to a third party is very hard to recover and the landlord can deny receiving it.

**대응 / Action.** 등기부등본의 소유자 이름과 입금 계좌 예금주가 글자 하나까지 같은지 확인하세요. 다르면 계약을 중단하십시오.

Check that the account holder name matches the registered owner exactly. If it differs, stop the transaction.

**예시 / Sample.** `집주인 누나 계좌로 보내주시면 돼요.`

`Just send it to my sister's account.`

Keywords (ko): `제 계좌로`, `개인 계좌`, `다른 사람 계좌`, `아내 계좌`, `동생 계좌`, `어머니 계좌`, `법인 말고`, `명의가 달라`, `가족 계좌`, `직원 계좌`, `누나 계좌`, `형 계좌`, `오빠 계좌`, `언니 계좌`, `지인 계좌`, `친구 계좌`, `와이프 계좌`, `사장님 계좌`, `제 명의 아닌`

Keywords (en): `my personal account`, `different account name`, `my wife's account`, `third party account`, `not the company account`, `sister's account`, `brother's account`, `friend's account`, `another person's account`

Combos (all terms in one sentence): `개인 + 계좌`; `제 + 계좌 + 보내`; `personal + account`; `different + account`; `누나 + 계좌`; `형 + 계좌`; `지인 + 계좌`; `sister + account`; `brother + account`

### `pay-before-contract` — 계약서 작성 전 입금 요구

*Payment demanded before any contract exists* · **Severity 5/5**

**왜 / Why.** 계약서 없이 보낸 돈은 법적 근거가 없습니다. 가계약금이라도 계약 조건(주소, 보증금, 입주일, 환불 조건)을 문자로 확정한 증거가 필요합니다.

Money sent with no contract has no legal basis. Even a holding deposit needs the terms — address, amount, move-in date, refund condition — confirmed in writing.

**대응 / Action.** 최소한 문자/카톡으로 '주소, 보증금, 월세, 입주일, 미계약 시 전액 반환'을 명시한 답변을 받은 후 소액만 송금하세요. 가능하면 계약서 서명과 동시에 입금하세요.

At minimum get a written message stating address, deposit, rent, move-in date and full refund if the lease isn't signed — then send only a small amount. Better: pay at signing.

**예시 / Sample.** `일단 50만원 보내주시면 계약서는 만나서 쓸게요.`

`Just send 500k first and we'll do the contract when we meet.`

Keywords (ko): `계약서 전에`, `서명 전에 입금`, `일단 보내주시면`, `입금 확인 후 계약`, `송금하시면 계약서`, `예약금 먼저`

Keywords (en): `pay before the contract`, `send it first`, `contract after payment`, `reservation fee first`

Combos (all terms in one sentence): `보내주시면 + 계약서`; `입금 + 계약서 + 나중`; `먼저 + 보내 + 계약`; `send + first + contract`

### `pay-cash-no-receipt` — 현금 요구 / 영수증·계약서 미발행

*Cash demanded, no receipt or contract* · **Severity 4/5**

**왜 / Why.** 현금 거래는 증거가 남지 않습니다. 계약서와 영수증 없이 지급한 돈은 법적으로 입증하기 어렵습니다.

Cash leaves no trace. Money paid without a contract or receipt is very hard to prove in court.

**대응 / Action.** 반드시 계좌 이체로, 이체 메모에 '보증금'을 기재하고, 계약서에 서명한 뒤에 입금하세요.

Always pay by bank transfer with 'deposit' in the memo, and only after the contract is signed.

**예시 / Sample.** `현금으로 주시면 좀 깎아드릴게요. 영수증은 나중에 드리고요.`

`I can discount it if you pay cash, I'll give you the receipt later.`

Keywords (ko): `현금으로`, `현금만`, `영수증은 나중에`, `영수증 없이`, `계약서는 나중에`, `현금 거래`, `세금 때문에 현금`

Keywords (en): `cash only`, `in cash`, `no receipt`, `receipt later`, `contract later`

Combos (all terms in one sentence): `현금 + 깎`; `현금 + 할인`; `영수증 + 나중`; `cash + discount`; `receipt + later`

## 신원·권한 확인 — Identity and authority

### `id-proxy-no-poa` — 대리인 계약 — 위임장·인감증명서 미확인

*Proxy signing without power of attorney* · **Severity 5/5**

**왜 / Why.** 소유자가 아닌 사람이 계약하려면 인감증명서가 첨부된 위임장과 대리인 신분증이 반드시 필요합니다. 이것이 없는 대리 계약은 무권대리로 계약 자체가 무효가 될 수 있습니다.

Anyone signing for the owner needs a power of attorney with the owner's seal certificate plus their own ID. Without it the lease can be void.

**대응 / Action.** 위임장 원본 + 인감증명서(3개월 내 발급) + 대리인 신분증을 요구하고, 소유자와 직접 통화(영상통화)로 확인하세요.

Demand the original power of attorney, a seal certificate issued within 3 months, and the proxy's ID — then confirm directly with the owner by video call.

**예시 / Sample.** `집주인이 해외에 계셔서 제가 대신 계약합니다. 위임장은 나중에 드릴게요.`

`The owner is overseas so I'm signing for him; I'll send the power of attorney later.`

Keywords (ko): `집주인 대신`, `대리인`, `제가 위임받`, `위임장은 나중`, `위임장 없`, `집주인이 해외`, `집주인이 바빠`, `집주인 연락 안`, `주인 대신 제가`

Keywords (en): `on behalf of the owner`, `i represent the owner`, `owner is abroad`, `owner is busy`, `power of attorney later`, `cannot reach the owner`

Combos (all terms in one sentence): `대신 + 계약`; `위임장 + 나중`; `위임장 + 없`; `집주인 + 해외`; `owner + abroad`; `behalf + owner`

### `id-refuse-register` — 등기부등본·서류 확인 거부

*Refusing to show the property register or documents* · **Severity 5/5**

**왜 / Why.** 등기부등본은 누구나 700원으로 직접 발급할 수 있는 공개 문서입니다. 보여주기를 거부하는 것은 숨길 것이 있다는 뜻입니다.

The property register is a public document anyone can issue for about 700 won. Refusing to show it means there is something to hide.

**대응 / Action.** 인터넷등기소(iros.go.kr)에서 주소로 직접 발급하세요. 상대방의 허락이 필요하지 않습니다. 계약 당일 다시 발급해 변동을 확인하세요.

Issue it yourself at iros.go.kr by address — you don't need their permission. Re-issue it on signing day to catch last-minute changes.

**예시 / Sample.** `등기부등본은 계약할 때 보여드릴게요. 사진은 찍지 마세요.`

`I'll show the register when we sign. Please don't take photos.`

Keywords (ko): `등기부등본은 안`, `등기부등본 안 보여`, `등본은 계약할 때`, `서류는 계약 후`, `사진 찍지 마`, `촬영 금지`, `보여드릴 수 없`, `그런 건 필요 없`, `믿으세요`

Keywords (en): `can't show the register`, `no need for the register`, `documents after signing`, `don't photograph`, `just trust me`

Combos (all terms in one sentence): `등기부등본 + 나중`; `등기부등본 + 계약할 때`; `등기부등본 + 안 보여`; `서류 + 계약 후`; `사진 + 찍지`; `register + after`; `don't + photo`

### `id-name-mismatch` — 계약 상대와 등기부상 소유자 불일치

*Signer does not match the registered owner* · **Severity 5/5**

**왜 / Why.** '서류상 주인은 다른 사람이지만 실제 주인은 나'라는 설명은 법적으로 아무 의미가 없습니다. 임대차 계약은 등기부등본상 소유자(또는 정당한 위임을 받은 대리인)와만 유효합니다.

'The paper owner is someone else but I'm the real owner' has no legal meaning. A lease is valid only with the registered owner or a properly authorised proxy.

**대응 / Action.** 등기부등본 갑구의 소유자 이름·주민번호 앞자리와 신분증을 대조하세요. 불일치하면 위임장과 인감증명서를 요구하고, 없으면 계약을 중단하세요.

Compare the owner's name on the register with their ID. If they differ, demand a power of attorney and seal certificate — without them, stop.

**예시 / Sample.** `등기는 아버지 명의인데 실제로는 제가 관리하니까 저랑 계약하시면 돼요.`

`It's in my father's name but I manage it, so you can contract with me.`

Keywords (ko): `명의가 달라`, `등기는 아버지`, `등기는 남편`, `명의만 빌려`, `실제 주인은 저`, `서류상 주인은`

Keywords (en): `registered in my father's name`, `owner on paper is`, `name is just borrowed`, `i'm the real owner`

Combos (all terms in one sentence): `등기 + 명의 + 제가`; `명의 + 다르 + 실제`; `서류상 + 주인`; `father's name + contract`; `등기 + 아버지`; `등기 + 남편`; `등기 + 어머니`; `명의 + 실제로는`; `father's name + manage`; `registered + but`

### `id-agent-unregistered` — 무등록 중개 / 중개사 자격 미확인

*Unlicensed brokerage* · **Severity 4/5**

**왜 / Why.** 무등록 중개는 불법이며, 사고가 나도 공제(보증)를 받을 수 없습니다. 등록된 중개사는 사무소에 등록증과 공제증서를 게시해야 합니다.

Unlicensed brokering is illegal and leaves you with no insurance coverage if something goes wrong. Licensed agents must display their registration and indemnity certificate.

**대응 / Action.** 국가공간정보포털 또는 해당 시·군·구청에서 중개사무소 등록번호를 조회하고, 공제증서(최소 2억) 사본을 받으세요.

Look up the agency's registration number with the local district office and get a copy of their indemnity certificate.

**예시 / Sample.** `저는 중개사는 아니고 개인적으로 소개해드리는 거예요.`

`I'm not a licensed agent, just introducing it privately.`

Keywords (ko): `중개사 아니`, `중개수수료 없이`, `개인적으로 소개`, `무등록`, `등록증은 없`, `사무실은 없`, `직거래인데 수수료`

Keywords (en): `not a licensed agent`, `no agent fee`, `private introduction`, `unregistered`, `no office`

Combos (all terms in one sentence): `중개사 + 아니`; `개인적으로 + 소개`; `not + agent`; `introducing + privately`

## 등기부등본 위험 신호 — Property-register red flags

### `reg-heavy-mortgage` — 선순위 근저당·융자 존재

*Existing senior mortgage on the property* · **Severity 5/5**

**왜 / Why.** 집이 경매에 넘어가면 근저당(선순위 채권)이 먼저 변제되고, 남는 돈으로 보증금을 받습니다. (선순위 채권 + 내 보증금)이 시세의 70%를 넘으면 보증금을 못 받을 위험이 큽니다.

If the property is auctioned, the mortgage is repaid first and you get only what's left. If (senior debt + your deposit) exceeds about 70% of market value, your deposit is at serious risk.

**대응 / Action.** 등기부등본 을구에서 채권최고액을 확인하고 (채권최고액 + 보증금) ÷ 시세를 계산하세요. 70% 초과 시 계약하지 마세요. '잔금으로 갚겠다'는 약속은 특약에 '말소 조건부'로 명기하고 동시이행하세요.

Read the lien amount in section 을구 and compute (lien + deposit) ÷ market value. Above ~70%, walk away. A promise to clear the loan must be written into the contract as a condition fulfilled at the same time as your payment.

**예시 / Sample.** `근저당 2억 있는데 잔금 받아서 바로 갚을 거니까 괜찮아요.`

`There's a 200M won mortgage but I'll repay it with your money, so it's fine.`

Keywords (ko): `근저당이 있`, `근저당 있`, `근저당 많`, `근저당은 있`, `융자가 있`, `융자 있`, `대출이 있`, `담보가 잡혀`, `은행 빚`, `빚은 있지만`, `선순위 채권`, `잔금 받아서 갚`, `잔금으로 갚`

Keywords (en): `mortgage on it`, `there's a loan`, `bank loan on the property`, `senior lien`, `will clear it later`

Combos (all terms in one sentence): `근저당 + 괜찮`; `근저당 + 갚`; `융자 + 괜찮`; `대출 + 갚을`; `mortgage + fine`; `loan + repay`

### `reg-trust` — 신탁등기된 부동산

*Property registered under a trust* · **Severity 5/5**

**왜 / Why.** 신탁등기된 집은 법적 소유자가 신탁회사입니다. 신탁회사의 사전 동의 없이 원래 주인(위탁자)과 맺은 계약은 무효이며, 보증금을 전액 잃을 수 있습니다. 전세사기의 대표 유형입니다.

When a property is in trust, the trust company is the legal owner. A lease signed with the original owner without the trustee's written consent is void and you can lose the entire deposit. This is a classic fraud pattern.

**대응 / Action.** 신탁원부를 발급받아 임대 권한이 누구에게 있는지 확인하고, 신탁회사의 서면 동의서를 반드시 받으세요. 없으면 계약하지 마세요.

Obtain the trust deed, confirm who holds leasing authority, and require written consent from the trust company. Without it, do not sign.

**예시 / Sample.** `신탁회사 소유로 되어 있는데 실제 주인은 저예요, 문제없어요.`

`It's under a trust company but I'm the real owner, no problem.`

Keywords (ko): `신탁등기`, `신탁 등기`, `신탁회사`, `신탁 회사`, `수탁자`, `위탁자`, `신탁원부`, `신탁 원부`

Keywords (en): `trust company`, `held in trust`, `trustee`, `trust registration`

Combos (all terms in one sentence): `신탁 + 괜찮`; `신탁 + 실제 주인`; `trust + real owner`

### `reg-seizure-auction` — 가압류·압류·경매 기재

*Seizure or auction recorded on the register* · **Severity 5/5**

**왜 / Why.** 가압류·압류·경매개시결정이 기재된 부동산은 언제든 강제 매각될 수 있습니다. 이 경우 후순위 임차인은 보증금을 거의 돌려받지 못합니다.

A property with a seizure or auction notice can be force-sold at any time, and a junior tenant recovers almost nothing.

**대응 / Action.** 즉시 계약을 중단하세요. 어떤 설명도 이 위험을 없애주지 않습니다.

Stop the process immediately. No explanation removes this risk.

**예시 / Sample.** `가압류는 곧 풀릴 거예요, 신경 쓰지 마세요.`

`The seizure will be lifted soon, don't worry about it.`

Keywords (ko): `가압류`, `압류`, `가처분`, `경매`, `임의경매`, `강제경매`, `체납`, `세금 미납`, `소송 중`

Keywords (en): `provisional seizure`, `attachment`, `auction`, `foreclosure`, `tax arrears`, `in litigation`

Combos (all terms in one sentence): `가압류 + 풀릴`; `경매 + 신경`; `압류 + 괜찮`; `seizure + lifted`; `가압류 + 신경`; `압류 + 곧`; `경매 + 걱정`

### `reg-gangtong` — 깡통전세 위험 (전세가 ≈ 매매가)

*Deposit close to or above the property's value* · **Severity 4/5**

**왜 / Why.** 보증금이 매매 시세에 가까우면 집값이 조금만 떨어져도 보증금을 회수할 수 없습니다. 시세 자료가 없는 신축 빌라는 감정가를 부풀린 사기에 자주 쓰입니다.

If the deposit approaches the sale value, a small price drop wipes out your money. New-build villas without market data are a favourite vehicle for inflated-valuation fraud.

**대응 / Action.** 국토부 실거래가 공개시스템, KB시세, 주변 공인중개사 3곳 이상에서 시세를 교차 확인하세요. 보증금이 시세의 70%를 넘으면 피하세요.

Cross-check the price on the MOLIT actual-transaction system, KB valuations, and at least three nearby agencies. Avoid deposits above ~70% of value.

**예시 / Sample.** `신축이라 시세는 없지만 감정가 3억이니까 전세 2억 8천은 싼 거예요.`

`It's new so there's no market price, but appraised at 300M so a 280M deposit is cheap.`

Keywords (ko): `매매가랑 비슷`, `시세랑 똑같`, `매매가보다`, `깡통`, `전세가율`, `신축이라 시세가 없`, `신축이라 시세`, `시세는 없`, `감정가`, `전세가율이 높`

Keywords (en): `same as the sale price`, `above market price`, `underwater`, `new build so no market price`, `no market price`, `appraised at`, `valuation is`

Combos (all terms in one sentence): `신축 + 시세 + 없`; `감정가 + 전세`; `appraised + deposit`; `no market price + cheap`

## 계약 절차 문제 — Contract irregularities

### `con-no-moving-report` — 전입신고·확정일자를 미루라는 요구

*Asked to delay move-in registration or the fixed-date stamp* · **Severity 5/5**

**왜 / Why.** 전입신고 + 확정일자는 보증금에 대한 대항력과 우선변제권을 만들어주는 유일한 장치입니다. 이를 미루라는 요구는 그 사이에 집을 담보로 대출을 받거나 매도하려는 의도일 가능성이 매우 높습니다.

The move-in report plus fixed-date stamp are the only things that give your deposit legal priority. Asking you to delay them usually means they plan to mortgage or sell the property in that gap.

**대응 / Action.** 이사 당일 주민센터에서 전입신고와 확정일자를 함께 받으세요. 이를 금지하는 특약은 효력이 없으며, 그런 요구 자체가 계약을 중단할 충분한 이유입니다.

Do both at the community centre on moving day. A clause forbidding it is unenforceable, and the request alone is reason enough to walk away.

**예시 / Sample.** `대출 때문에 전입신고는 한 달만 미뤄주세요.`

`Please hold off on the move-in report for a month because of my loan.`

Keywords (ko): `전입신고 하지`, `전입신고 미루`, `전입신고는 나중`, `확정일자 안`, `확정일자는 필요 없`, `전입신고 안 해도`, `세대분리`

Keywords (en): `don't register your move-in`, `delay the move-in report`, `no need for the fixed date`, `skip the registration`

Combos (all terms in one sentence): `전입신고 + 미뤄`; `전입신고 + 미루`; `전입신고 + 나중`; `전입신고 + 하지 마`; `전입신고 + 안 하`; `확정일자 + 나중`; `확정일자 + 미뤄`; `확정일자 + 필요 없`; `move-in + delay`; `move-in + later`; `registration + delay`; `전입신고 + 한 달`; `move-in + hold off`; `move-in report + month`; `전입신고 + 늦`; `확정일자 + 늦`

### `con-double-lease` — 이중계약 / 무권한 전대 위험

*Double lease or unauthorised sublet* · **Severity 5/5**

**왜 / Why.** 관리인이나 전 세입자가 소유자 동의 없이 계약하고 보증금을 가로채는 수법입니다. 전입세대열람으로 기존 거주자를 확인하지 않으면 같은 방에 두 명이 계약한 사실을 알 수 없습니다.

A manager or previous tenant signs without the owner's consent and pockets the deposit. Without checking the resident registry you cannot know two people have leased the same room.

**대응 / Action.** 전입세대열람내역을 발급해 기존 거주자를 확인하고, 등기부등본상 소유자와 직접 계약하세요.

Obtain the resident-registry extract to see who already lives there, and contract directly with the registered owner.

**예시 / Sample.** `기존 세입자 보증금은 제가 받고 정리할 거니까 저한테 입금하세요.`

`I'll settle the existing tenant's deposit, so transfer the money to me.`

Keywords (ko): `이중계약`, `다른 세입자`, `이미 살고 있는`, `기존 세입자는 곧`, `전세를 월세로`, `월세를 전세로`, `보증금은 제가 받고`

Keywords (en): `double contract`, `another tenant`, `existing tenant will leave`, `i collect the deposit`, `existing tenant's deposit`, `previous tenant's deposit`

Combos (all terms in one sentence): `기존 세입자 + 제가`; `세입자 + 보증금 + 제가`; `tenant + transfer`; `tenant's deposit + me`

### `con-verbal-only` — 구두 약속 / 특약 미기재

*Verbal promises not written into the contract* · **Severity 4/5**

**왜 / Why.** 계약서에 없는 약속은 분쟁 시 거의 입증되지 않습니다. 수리, 옵션, 근저당 말소, 반려동물, 퇴실 조건 모두 특약에 기재해야 합니다.

A promise not in the contract is nearly impossible to prove later. Repairs, appliances, clearing the mortgage, pets, and exit terms all belong in the special-terms clause.

**대응 / Action.** 국토교통부 주택임대차 표준계약서를 사용하고, 모든 약속을 특약사항에 문자로 적어 양측이 서명하세요.

Use the MOLIT standard lease form and write every promise into the special terms, signed by both parties.

**예시 / Sample.** `도배는 해드릴게요, 계약서에 굳이 안 써도 돼요.`

`I'll redo the wallpaper, no need to put it in the contract.`

Keywords (ko): `구두로`, `말로 약속`, `특약은 안 넣`, `계약서에 안 써도`, `서로 믿고`, `표준계약서 아니`, `계약서 대충`, `굳이 안 써도`, `안 써도 돼`, `계약서에 굳이`, `특약 필요 없`

Keywords (en): `verbal agreement`, `we don't need it in writing`, `trust each other`, `not the standard contract`, `no need to put it in the contract`, `no need to write it`

Combos (all terms in one sentence): `계약서 + 안 써도`; `계약서 + 굳이`; `contract + no need`

### `con-illegal-building` — 위반건축물 / 주거용 아닌 용도

*Illegal building or non-residential zoning* · **Severity 4/5**

**왜 / Why.** 근린생활시설(사무실·상가)을 주거용으로 쓰면 전입신고가 거부되거나 전세보증보험 가입이 불가능해 보증금 보호를 받을 수 없습니다. 위반건축물은 이행강제금과 철거 위험도 있습니다.

A commercial-zoned unit used as housing can block your move-in registration and make deposit insurance impossible, leaving the deposit unprotected. Illegal structures also face fines and demolition orders.

**대응 / Action.** 건축물대장(정부24)에서 용도와 '위반건축물' 표기를 확인하세요. 전입신고와 전세보증보험 가입이 가능한지 사전에 확인하세요.

Check the building register on gov.kr for the zoning and any 'violation' flag, and confirm in advance that move-in registration and deposit insurance are possible.

**예시 / Sample.** `등록은 사무실인데 사는 데는 아무 문제 없어요.`

`It's registered as an office but living there is no problem at all.`

Keywords (ko): `근린생활시설`, `사무실 용도`, `위반건축물`, `불법 개조`, `쪼개기`, `다가구를 다세대`, `옥탑`, `반지하인데 등록은`

Keywords (en): `commercial use`, `office zoning`, `illegal building`, `unauthorised conversion`, `rooftop unit`

Combos (all terms in one sentence): `사무실 + 사는`; `근린생활시설 + 주거`; `위반건축물 + 괜찮`; `office + living`; `사무실 + 문제없`; `등록은 + 사무실`; `office + no problem`

### `con-no-insurance` — 전세보증보험 가입 불가

*Deposit guarantee insurance not available* · **Severity 4/5**

**왜 / Why.** HUG·SGI 전세보증보험에 가입할 수 없는 집은 그 자체로 기관이 위험하다고 판단한 집입니다. 선순위 채권 과다, 신탁, 위반건축물 등이 주된 거절 사유입니다.

If HUG or SGI will not insure the deposit, an institution has already judged the property risky — usually because of excess senior debt, a trust, or building violations.

**대응 / Action.** 계약 전에 보증보험 가입 가능 여부를 확인하고, 불가능하면 계약하지 마세요. 특약에 '보증보험 미가입 시 계약 무효 및 계약금 반환'을 기재하세요.

Check insurability before signing; if it's not insurable, don't sign. Add a clause voiding the contract and refunding your money if insurance is refused.

**예시 / Sample.** `전세보증보험은 이 집은 안 되는데, 제가 믿을 만한 사람이니까요.`

`Deposit insurance isn't possible for this place, but you can trust me.`

Keywords (ko): `보증보험 안 되`, `보증보험은 못`, `HUG 안 되`, `전세보증 불가`, `보험은 필요 없`

Keywords (en): `no deposit insurance`, `can't get HUG`, `insurance not possible`, `you don't need insurance`, `insurance isn't possible`, `insurance is not possible`

Combos (all terms in one sentence): `보증보험 + 안 되`; `보증보험 + 불가`; `insurance + not possible`; `보증보험 + 안 됩`; `보증보험 + 이 집은`; `insurance + possible`; `insurance + can't`

## 비현실적으로 좋은 조건 — Too good to be true

### `good-remote-keys` — 방문·대면 없이 계약 요구

*Contract without any visit or meeting* · **Severity 5/5**

**왜 / Why.** 존재하지 않는 방, 남의 집 사진, 이미 다른 사람이 사는 방을 파는 전형적인 원격 사기입니다. 열쇠를 택배로 보낸다는 말은 거의 100% 사기입니다.

This is the classic remote scam: a non-existent room, stolen photos, or a room someone already lives in. 'Keys by mail' is fraud nearly 100% of the time.

**대응 / Action.** 직접 방문하거나, 불가능하면 신뢰할 수 있는 지인에게 대리 방문을 요청하세요. 최소한 실시간 영상통화로 방과 우편함의 호수, 창밖 풍경을 확인하세요.

Visit yourself, or send someone you trust. At minimum do a live video call showing the room, the unit number on the mailbox, and the view outside.

**예시 / Sample.** `멀리 계시니까 방문 안 하셔도 돼요, 열쇠는 택배로 보내드릴게요.`

`Since you're far away, no need to visit — I'll courier the keys.`

Keywords (ko): `방문 안 하셔도`, `보지 않고`, `사진으로 충분`, `열쇠는 택배`, `키는 우편`, `도착하면 드릴`, `영상통화도 안`, `직접 안 만나`

Keywords (en): `no need to visit`, `photos are enough`, `keys by mail`, `keys by courier`, `we don't need to meet`, `can't do a video call`

Combos (all terms in one sentence): `방문 + 안 하셔도`; `열쇠 + 택배`; `키 + 우편`; `보지 않고 + 계약`; `keys + mail`; `no need + visit`; `멀리 + 방문`; `keys + courier`; `far away + no need`

### `good-too-cheap` — 시세보다 비정상적으로 저렴한 조건

*Price far below market* · **Severity 4/5**

**왜 / Why.** 주변 시세보다 현저히 싼 매물은 존재하지 않는 방(허위매물)이거나, 권리관계에 심각한 문제가 있거나, 선입금만 받고 사라지는 사기입니다.

A listing far below market is usually a phantom listing, a property with serious legal defects, or a pure advance-fee scam.

**대응 / Action.** 같은 건물·같은 동네 매물 시세를 최소 3곳에서 비교하고, 반드시 직접 방문해 방이 실제로 존재하는지 확인하세요.

Compare at least three nearby listings and visit in person to confirm the room actually exists.

**예시 / Sample.** `원래 월 70만인데 사정이 있어서 40만에 드려요.`

`It's normally 700k a month but I'll give it to you for 400k.`

Keywords (ko): `시세보다 싸`, `엄청 저렴`, `이 가격에 이런`, `급하게 처분`, `무보증`, `보증금 없이`, `특별히 싸게`, `사정이 있어서 싸게`, `사정이 있어서`, `원래는 더 비싼`, `특별히 싸`

Keywords (en): `below market`, `unbelievably cheap`, `special price for you`, `no deposit needed`, `urgent sale`

Combos (all terms in one sentence): `시세 + 싸`; `시세 + 저렴`; `원래 + 깎`; `below + market`; `원래 + 드려요`; `원래 + 해드릴`; `사정 + 싸`; `normally + give it to you`; `normally + but`

## 고시원 특화 — Goshiwon-specific

### `gosi-no-visit` — 고시원 관련 언급

*Goshiwon-related discussion* · **Severity 4/5**

**왜 / Why.** 고시원은 계약 기간이 짧고 보증금이 작지만, 환불 규정이 불리하거나 소방·채광 기준을 위반한 곳이 많습니다. 사진과 실물 차이가 가장 큰 주거 형태입니다.

Goshiwons have short terms and small deposits but often unfavourable refund rules and fire-safety or window violations. The gap between photos and reality is the largest of any housing type.

**대응 / Action.** 반드시 직접 방문해 방 크기, 창문(외창 여부), 소방시설, 공동 주방·화장실 상태를 확인하고, 환불 규정을 서면으로 받으세요.

Visit in person to check room size, whether the window faces outside, fire safety, shared kitchen and bathroom, and get the refund policy in writing.

**예시 / Sample.** `고시원인데 보증금 50만원만 먼저 입금하시면 방 잡아드려요.`

`It's a goshiwon, just send the 500k deposit and I'll hold the room.`

Keywords (ko): `고시원`, `원룸텔`, `리빙텔`, `쉐어하우스`

Keywords (en): `goshiwon`, `livingtel`, `share house`

### `gosi-no-refund` — 환불 불가 조건

*No-refund terms* · **Severity 4/5**

**왜 / Why.** '입금 후 환불 불가'는 소비자에게 현저히 불리한 조항으로 무효가 될 수 있지만, 분쟁 자체가 큰 부담입니다. 또한 사기범이 환불 요구를 차단하기 위해 미리 깔아두는 장치입니다.

A blanket 'no refunds after payment' clause can be void as unfair, but fighting it is a burden — and scammers use it pre-emptively to block refund demands.

**대응 / Action.** 환불 규정(입실 전 취소, 중도 퇴실 시 일할 계산)을 서면으로 받고, 없으면 계약하지 마세요. 소액이라도 입금 전에 받아두세요.

Get the refund policy in writing (cancellation before move-in, pro-rata on early exit) before paying anything.

**예시 / Sample.** `입금하시면 환불은 절대 안 됩니다.`

`Once you pay there are absolutely no refunds.`

Keywords (ko): `환불 불가`, `환불은 안 되`, `보증금은 못 돌려`, `중도 퇴실 안`, `계약금 반환 없`, `입금하면 취소 안`, `환불은 절대`, `환불 절대`, `환불은 안`, `환불이 안`, `보증금 환불 불가`

Keywords (en): `no refunds`, `deposit not refundable`, `cannot cancel`, `no early move-out`

Combos (all terms in one sentence): `환불 + 안 되`; `환불 + 불가`; `보증금 + 못 돌려`; `no + refund`; `환불 + 절대`; `환불 + 안 됩`; `환불 + 안 돼`; `환불 + 못`; `보증금 + 돌려 + 못`; `refund + not`

### `gosi-no-business-reg` — 사업자등록·상호 미확인

*No business registration or trade name* · **Severity 4/5**

**왜 / Why.** 고시원은 다중생활시설로 사업자등록과 소방 관련 신고가 필요합니다. 사업자 정보가 없는 곳은 불법 운영이거나 존재하지 않는 시설일 수 있습니다.

A goshiwon is a regulated multi-occupancy facility that requires business registration and fire-safety filings. No business details means illegal operation or no facility at all.

**대응 / Action.** 사업자등록증 사본을 받아 국세청 사업자등록 상태조회로 확인하고, 입금 계좌 예금주가 사업자명과 일치하는지 확인하세요.

Get the business registration certificate, verify it on the NTS lookup, and check the bank account name matches the business name.

**예시 / Sample.** `사업자등록증 같은 건 없고 제가 개인적으로 운영해요.`

`There's no business registration, I run it privately.`

Keywords (ko): `사업자등록증 없`, `상호가 없`, `개인이 운영`, `세금계산서 안`, `현금영수증 안`, `사업자등록증 같은`, `개인적으로 운영`, `사업자등록 안`

Keywords (en): `no business registration`, `no company name`, `privately run`, `no tax invoice`

Combos (all terms in one sentence): `사업자등록증 + 없`; `개인적으로 + 운영`; `business registration + no`; `privately + run`

## 중개인 행태 — Agent behaviour

### `agent-pushy-switch` — 허위매물 유인 후 다른 방 권유

*Bait listing, then pushed to another room* · **Severity 3/5**

**왜 / Why.** 광고한 방이 '방금 나갔다'며 다른 방을 권하는 것은 허위매물로 손님을 유인하는 전형적인 수법입니다. 이후 조급한 상태에서 불리한 계약을 맺게 됩니다.

Claiming the advertised room 'just went' and offering another is classic bait-and-switch. It leaves you rushed and more likely to accept a bad deal.

**대응 / Action.** 그 자리에서 계약하지 말고 돌아가서 비교하세요. 허위매물은 한국인터넷자율정책기구 또는 해당 구청에 신고할 수 있습니다.

Don't sign on the spot — leave and compare. False listings can be reported to the district office.

**예시 / Sample.** `아 그 방은 어제 나갔어요. 대신 더 좋은 방 보여드릴게요.`

`Oh, that one went yesterday. Let me show you a better one.`

Keywords (ko): `그 방은 나갔`, `방금 계약됐`, `다른 방 보여`, `더 좋은 방이`, `그건 안 되고`, `이 방은 어때요`, `광고랑 다르`, `어제 나갔`, `방금 나갔`, `더 좋은 방`, `다른 방 보여드릴`

Keywords (en): `that one is gone`, `just got taken`, `let me show you another`, `different from the listing`, `let me show you a better`, `that one went`, `already taken`

Combos (all terms in one sentence): `방은 + 나갔`; `방 + 나갔 + 대신`; `더 좋은 + 방`; `show you + better`; `went + yesterday`

### `agent-excess-fee` — 법정 한도 초과 / 현금 수수료 요구

*Fee above the legal cap, or demanded in cash* · **Severity 3/5**

**왜 / Why.** 주택 임대차 중개보수는 법정 상한(거래금액 구간별 0.3~0.8%)이 있습니다. '컨설팅비', '소개비' 명목으로 추가 요구하는 것은 초과 수수료 회피 수단입니다.

Residential brokerage fees are legally capped (0.3–0.8% by bracket). Extra 'consulting' or 'finder' fees are a way of evading that cap.

**대응 / Action.** 중개보수 요율표를 요구하고 현금영수증을 받으세요. 초과 수수료는 시·군·구청에 신고하면 반환받을 수 있습니다.

Ask for the fee schedule and a cash receipt. Excess fees can be reported to the district office and reclaimed.

**예시 / Sample.** `복비는 현금으로 주시고, 컨설팅비 30만원 따로 주세요.`

`Pay the brokerage in cash, plus 300k for consulting.`

Keywords (ko): `수수료는 현금`, `복비는 현금`, `복비 현금`, `컨설팅비`, `알선료`, `소개비`, `수수료 별도`, `수수료 따로`, `복비 따로`

Keywords (en): `brokerage fee in cash`, `consulting fee`, `finder's fee`, `extra commission`, `fee separately`, `for consulting`, `in cash, plus`

Combos (all terms in one sentence): `수수료 + 현금으로`; `복비 + 현금으로`; `brokerage + in cash`

### `comm-external-channel` — 기록을 남기지 않으려는 소통 방식

*Avoiding a traceable communication record* · **Severity 3/5**

**왜 / Why.** 대화 삭제 요구, 통화 거부, 플랫폼 밖 소통 유도는 증거를 남기지 않으려는 의도입니다. 분쟁 시 대화 기록이 가장 중요한 증거입니다.

Asking you to delete chats, refusing calls, or moving off-platform is about leaving no evidence. Chat logs are the single most important proof in a dispute.

**대응 / Action.** 모든 대화를 캡처·백업하고, 중요한 내용은 문자로 다시 확인받으세요. 통화는 녹음하세요(본인이 대화 당사자면 합법).

Screenshot and back up every conversation, re-confirm key points in writing, and record calls (legal in Korea when you are a party to the call).

**예시 / Sample.** `이 대화는 나중에 지워주세요. 전화보다 카톡으로만 연락주세요.`

`Please delete this chat later, and contact me only by message.`

Keywords (ko): `카톡으로만`, `전화는 안 받`, `문자로만`, `메시지 삭제`, `이 대화는 지워`, `앱 밖에서`, `다른 앱으로`

Keywords (en): `message me off-platform`, `delete this chat`, `text only`, `don't call me`, `move to another app`

Combos (all terms in one sentence): `대화 + 지워`; `대화 + 삭제`; `전화 + 카톡`; `delete + chat`; `only by message + contact`

## 출처 · Sources

Assembled from public guidance and widely reported fraud patterns: 국토교통부 전세사기 예방 안내, 주택도시보증공사(HUG) 전세피해지원센터 자료, 경찰청 전세사기 유형 안내, 대한법률구조공단 임대차 FAQ, 한국소비자원 고시원 상담 사례, and news coverage of lease-fraud cases from 2022 onward.

Nothing here is legal advice. Law and practice change; if a pattern's legal basis has shifted, please open an issue.
