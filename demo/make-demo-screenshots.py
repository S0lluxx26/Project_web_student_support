#!/usr/bin/env python3
"""
Generate the demo screenshots in demo/screenshots/.

    python3 demo/make-demo-screenshots.py

Needs Pillow and a Korean font. On Debian/Ubuntu:

    sudo apt install fonts-noto-cjk && pip install Pillow


WHY THESE ARE DRAWN AND NOT DOWNLOADED
--------------------------------------
There is no stock-photo library of Korean rental-scam chat screenshots. What
does exist online is real people's private conversations — posted to forums and
news articles by victims — carrying their names, their phone numbers and their
landlords'. Downloading those into a public repository to demo a privacy tool
would be an unpleasant kind of irony, so every image here is drawn from
invented conversations. No real name, number, account or address appears in any
of them.

The trade-off is stated honestly in demo/README.md: these reproduce the layout
and the failure modes, not the mess of a real capture.

WHAT THE SET IS FOR
-------------------
Two different jobs, and they pull in opposite directions:

  * Showing someone what the tool does. That wants clear, legible captures.
  * Finding out where it breaks. That wants the awkward ones — a group chat, a
    photo of a screen, a thumbnail someone re-sent twice.

Both are here, and the README records what each one MEASURABLY produces rather
than what it was hoped to produce.

Files 01-13 vary the LAYOUT and the CAPTURE QUALITY — group chats, dark mode,
a photo of a screen, a thumbnail re-sent twice — because that is what breaks
recognition. Files 14-20 hold the layout steady and vary the DANGER instead:
one transaction risk per file, each the kind of thing that costs a student a
deposit. Use 01-13 to find out whether the reader works; use 14-20 to see
whether a particular risk is recognised at all.

Five of the twenty-two conversations are entirely ordinary, and that balance is
deliberate. A demo made only of alarming cases teaches the wrong lesson: the
expensive failure for a checker like this is crying wolf. 13 and 21 especially
are stuffed with 근저당 / 전입신고 / 계약금 / 신탁 used in the CORRECT
direction — if the suppressors ever regress, those are the files that catch
it.

Everything is saved as JPEG. Real screenshots are re-compressed by every
messenger they pass through, and those artefacts are what make small grey type
unreadable; demoing on a lossless PNG would flatter the engine.
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "screenshots")
os.makedirs(OUT, exist_ok=True)

CANDIDATES = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJKkr-Regular.otf",
    "/System/Library/Fonts/AppleSDGothicNeo.ttc",
    "C:/Windows/Fonts/malgun.ttf",
]
FONT = next((p for p in CANDIDATES if os.path.exists(p)), None)
if not FONT:
    raise SystemExit("no Korean font found; install fonts-noto-cjk")
IDX = 0 if FONT.endswith(".ttf") else 2


def f(size):
    return ImageFont.truetype(FONT, size, index=IDX)


# ---------------------------------------------------------------- themes ---

LIGHT = dict(page=(171, 198, 216), mine=(254, 229, 81), theirs=(255, 255, 255),
             ink=(20, 20, 20), mine_ink=(20, 20, 20), bar=(154, 183, 203),
             bar_ink=(28, 32, 36), avatar=(203, 219, 231), stamp=(96, 108, 120),
             divider=(150, 176, 196), divider_ink=(250, 250, 250), unread=(228, 80, 60))

DARK = dict(page=(24, 26, 30), mine=(64, 96, 150), theirs=(46, 49, 56),
            ink=(238, 238, 238), mine_ink=(248, 248, 248), bar=(18, 20, 23),
            bar_ink=(224, 226, 230), avatar=(62, 66, 74), stamp=(140, 148, 158),
            divider=(48, 52, 58), divider_ink=(210, 214, 220), unread=(236, 120, 100))

SMS = dict(page=(244, 245, 247), mine=(58, 128, 246), theirs=(229, 229, 234),
           ink=(16, 16, 18), mine_ink=(255, 255, 255), bar=(248, 248, 250),
           bar_ink=(20, 20, 22), avatar=(206, 208, 214), stamp=(132, 138, 148),
           divider=(220, 222, 228), divider_ink=(88, 92, 100), unread=(228, 80, 60))


# ----------------------------------------------------------- the renderer ---

def wrap(draw, text, font, max_w):
    """Break on spaces, then mid-word — Korean chat wraps mid-word."""
    words, lines, cur = text.split(" "), [], ""
    for w_ in words:
        trial = (cur + " " + w_).strip()
        if draw.textlength(trial, font=font) <= max_w:
            cur = trial
            continue
        if cur:
            lines.append(cur)
        while draw.textlength(w_, font=font) > max_w:
            cut = len(w_)
            while cut > 1 and draw.textlength(w_[:cut], font=font) > max_w:
                cut -= 1
            lines.append(w_[:cut])
            w_ = w_[cut:]
        cur = w_
    if cur:
        lines.append(cur)
    return lines


def render(name, title, messages, theme, stamps=True, dates=("2026년 9월 8일",),
           width=720, height=1560, body_px=27, names=False, unread=False,
           quality=80, photo=False):
    """
    messages: list of (who, text) where who is "me" or a sender name.
    names:    draw the sender's name above each incoming bubble (group chats).
    unread:   draw the KakaoTalk unread marker beside bubbles.
    photo:    simulate a photograph of a screen — rotation, glare, blur.
    dates:    divider labels; a second one is inserted halfway down.
    """
    scale = width / 720.0
    img = Image.new("RGB", (width, height), theme["page"])
    d = ImageDraw.Draw(img)

    body = f(int(body_px * scale))
    small = f(max(9, int(19 * scale)))
    tiny = f(max(8, int(16 * scale)))
    name_f = f(max(9, int(18 * scale)))

    PAD = int(20 * scale)
    AVATAR = int(44 * scale)
    GAP = int(14 * scale)
    LINE_H = int(body_px * 1.4 * scale)
    max_bubble = int(width * 0.62)

    # status bar + app header: chrome the engine has to read past
    d.rectangle([0, 0, width, int(38 * scale)], fill=theme["bar"])
    d.text((int(22 * scale), int(9 * scale)), "9:41", font=tiny, fill=theme["bar_ink"])
    d.text((width - int(92 * scale), int(9 * scale)), "LTE  87%", font=tiny, fill=theme["bar_ink"])
    d.rectangle([0, int(38 * scale), width, int(104 * scale)], fill=theme["bar"])
    d.text((int(26 * scale), int(58 * scale)), "←", font=f(int(26 * scale)), fill=theme["bar_ink"])
    d.text((int(62 * scale), int(58 * scale)), title, font=f(int(24 * scale)), fill=theme["bar_ink"])

    def divider(y, label):
        w_ = int(d.textlength(label, font=tiny))
        d.rounded_rectangle([(width - w_) // 2 - int(14 * scale), y,
                             (width + w_) // 2 + int(14 * scale), y + int(30 * scale)],
                            int(15 * scale), fill=theme["divider"])
        d.text(((width - w_) // 2, y + int(7 * scale)), label, font=tiny,
               fill=theme["divider_ink"])
        return y + int(52 * scale)

    y = divider(int(128 * scale), dates[0])
    halfway = len(messages) // 2
    last_sender = None

    for i, (who, text) in enumerate(messages):
        if len(dates) > 1 and i == halfway:
            y = divider(y + int(6 * scale), dates[1])
            last_sender = None

        mine = who == "me"
        lines = wrap(d, text, body, max_bubble - int(30 * scale))
        bw = max(int(d.textlength(l, font=body)) for l in lines) + int(30 * scale)
        bh = len(lines) * LINE_H + int(18 * scale)

        if mine:
            x = width - PAD - bw
            fill, ink = theme["mine"], theme["mine_ink"]
        else:
            x = PAD + AVATAR + int(12 * scale)
            fill, ink = theme["theirs"], theme["ink"]
            # In a group chat the name is printed once per run of messages.
            if names and who != last_sender:
                d.text((x, y), who, font=name_f, fill=theme["stamp"])
                y += int(24 * scale)
            d.ellipse([PAD, y, PAD + AVATAR, y + AVATAR], fill=theme["avatar"])

        d.rounded_rectangle([x, y, x + bw, y + bh], int(14 * scale), fill=fill)
        for j, line in enumerate(lines):
            d.text((x + int(15 * scale), y + int(8 * scale) + j * LINE_H),
                   line, font=body, fill=ink)

        meta_x = x - int(58 * scale) if mine else x + bw + int(8 * scale)
        if unread and mine and i % 3 == 0:
            d.text((meta_x, y + int(4 * scale)), "1", font=tiny, fill=theme["unread"])
            meta_y = y + bh - int(24 * scale)
        else:
            meta_y = y + bh - int(24 * scale)
        if stamps:
            d.text((meta_x, meta_y), "오후 3:21", font=tiny, fill=theme["stamp"])

        last_sender = who
        y += bh + GAP
        if y > height - int(140 * scale):
            break

    # input row
    d.rectangle([0, height - int(78 * scale), width, height], fill=theme["bar"])
    d.rounded_rectangle([int(56 * scale), height - int(62 * scale),
                         width - int(70 * scale), height - int(16 * scale)],
                        int(23 * scale), fill=theme["theirs"])
    d.text((int(22 * scale), height - int(52 * scale)), "+", font=f(int(30 * scale)),
           fill=theme["bar_ink"])
    d.text((int(76 * scale), height - int(51 * scale)), "메시지 입력", font=small,
           fill=theme["stamp"])

    if photo:
        img = photograph(img)

    path = os.path.join(OUT, name)
    img.save(path, "JPEG", quality=quality, subsampling=2)
    print("  %-28s %sx%s  q%-3s %4d KB" %
          (name, img.size[0], img.size[1], quality, os.path.getsize(path) // 1024))


def photograph(img):
    """
    Simulate someone photographing their screen with a second phone, because
    plenty of people do exactly that instead of taking a screenshot. Slight
    rotation, a soft glare band, a little blur, and a darkened border.
    """
    img = img.rotate(-1.4, resample=Image.BICUBIC, expand=False,
                     fillcolor=(18, 18, 20))
    img = img.filter(ImageFilter.GaussianBlur(0.7))

    glare = Image.new("L", img.size, 0)
    g = ImageDraw.Draw(glare)
    w, h = img.size
    for i in range(90):
        g.line([(int(w * -0.2) + i * 9, 0), (int(w * 0.35) + i * 9, h)],
               fill=max(0, 70 - abs(i - 45) * 2), width=10)
    white = Image.new("RGB", img.size, (255, 255, 255))
    img = Image.composite(white, img, glare.filter(ImageFilter.GaussianBlur(28)))

    # vignette: the edges of a screen photographed off-axis fall off
    vig = Image.new("L", img.size, 255)
    v = ImageDraw.Draw(vig)
    for i in range(26):
        v.rectangle([i, i, w - 1 - i, h - 1 - i], outline=140 + i * 4)
    return Image.composite(img, Image.new("RGB", img.size, (0, 0, 0)), vig)


# ================================================================ the set ===
print("writing to", OUT)

# --- 01 the headline case: several independent signals at once -------------
render("01-kakao-pressure.jpg", "김부동산 중개사", [
    ("them", "안녕하세요 어제 문의주신 원룸 건으로 연락드립니다"),
    ("me",   "네 안녕하세요 이번 주말에 방 볼 수 있을까요"),
    ("them", "지금 세입자가 살고 있어서 방을 못 보여드려요"),
    ("them", "사진으로 충분히 보셨죠 상태 아주 좋습니다"),
    ("them", "오늘 가계약금 100만원만 먼저 보내주시면 방 잡아드릴게요"),
    ("them", "다른 분도 지금 보고 계셔서 오늘 안에 결정하셔야 해요"),
    ("me",   "등기부등본 먼저 보여주실 수 있나요"),
    ("them", "그건 계약하실 때 보여드립니다 걱정 안 하셔도 돼요"),
    ("them", "제 명의 계좌로 보내주세요 사장님이 지방에 계셔서요"),
], LIGHT)

# --- 02 ORDINARY. If this is flagged, the tool is broken -------------------
render("02-kakao-ordinary.jpg", "행복공인중개사", [
    ("them", "안녕하세요 문의주신 원룸 안내드립니다"),
    ("me",   "네 방 보러 갈 수 있을까요"),
    ("them", "네 토요일 오후 2시에 가능하십니다"),
    ("them", "오실 때 신분증만 들고 오시면 됩니다"),
    ("me",   "등기부등본도 볼 수 있을까요"),
    ("them", "물론입니다 방문하시면 같이 확인해 드릴게요"),
    ("them", "근저당은 없고 집주인분 명의로 되어 있습니다"),
    ("me",   "전입신고랑 확정일자도 가능한가요"),
    ("them", "네 계약 후 바로 하시면 됩니다"),
], LIGHT)

# --- 03 dark mode: the polarity the binariser does not expect --------------
render("03-dark-mode.jpg", "임대인", [
    ("them", "오늘 안에 입금하셔야 방이 유지됩니다"),
    ("me",   "계약서 먼저 볼 수 있나요"),
    ("them", "계약서는 입금 확인 후에 보내드려요"),
    ("me",   "직접 만나서 쓰면 안 될까요"),
    ("them", "제가 해외에 있어서 못 갑니다"),
    ("them", "전입신고는 좀 미뤄주셔야 합니다 대출 때문에요"),
    ("me",   "그건 좀 걱정되는데요"),
    ("them", "다들 그렇게 합니다 문제 생긴 적 없어요"),
], DARK)

# --- 04 SMS layout: white-on-blue outgoing, no avatars ---------------------
render("04-sms-message.jpg", "010-0000-0000", [
    ("them", "안녕하세요 원룸 문의 주신 분 맞으실까요"),
    ("them", "시세보다 많이 저렴하게 나온 매물이라 금방 나갑니다"),
    ("me",   "보증금이 얼마인가요"),
    ("them", "보증금 오천만원인데 근저당이 조금 있어요 하지만 괜찮습니다"),
    ("me",   "얼마나 있는데요"),
    ("them", "그건 등기부 보시면 되는데 신경 안 쓰셔도 됩니다"),
    ("them", "계약금은 현금으로 주시면 더 깎아드릴게요"),
], SMS, stamps=False)

# --- 05 goshiwon: the remote-contract push the goshiwon flow exists for ----
render("05-goshiwon.jpg", "고시원 총무", [
    ("them", "네 문의 감사합니다 방 나왔습니다"),
    ("me",   "방을 한번 보고 싶은데 언제 가능할까요"),
    ("them", "굳이 안 오셔도 됩니다 사진이랑 똑같아요"),
    ("me",   "보증금은 어떻게 되나요"),
    ("them", "보증금 삼십만원인데 환불은 안 됩니다"),
    ("them", "오늘 예약금 넣으셔야 자리 잡아드려요"),
    ("me",   "사업자등록증 확인할 수 있을까요"),
    ("them", "그런 건 오시면 보여드립니다"),
], LIGHT)

# --- 06 GROUP CHAT: sender names above bubbles, three participants ---------
#     The side split has to cope with names printed outside the bubble, and
#     with two different people on the same side.
render("06-group-chat.jpg", "원룸 단톡방 (3)", [
    ("박중개사", "안녕하세요 두 분 모두 초대했습니다"),
    ("박중개사", "집주인님 직접 설명해 주시면 될 것 같아요"),
    ("집주인",   "네 안녕하세요 방은 내일 바로 입주 가능합니다"),
    ("me",       "계약서는 언제 쓸 수 있을까요"),
    ("집주인",   "계약서는 나중에 쓰고 오늘 계약금부터 넣어주세요"),
    ("박중개사", "저희가 중간에서 보증하니까 걱정 마세요"),
    ("me",       "등기부등본은 확인할 수 있나요"),
    ("집주인",   "그건 지금 발급이 안 돼서요 나중에 보여드릴게요"),
], LIGHT, names=True, dates=("2026년 9월 8일", "2026년 9월 9일"))

# --- 07 DENSE: many short bubbles, unread markers, two days ---------------
#     Short messages are where the bubble-merge threshold can go wrong: get it
#     too loose and a whole screen glues into one sentence.
render("07-dense-thread.jpg", "이집주인", [
    ("them", "네"),
    ("them", "방 아직 있습니다"),
    ("me",   "감사합니다"),
    ("me",   "언제 볼 수 있을까요"),
    ("them", "이번주는 좀 어렵고"),
    ("them", "다음주에 연락드릴게요"),
    ("me",   "네 알겠습니다"),
    ("them", "근데 그 전에 예약금은 넣어두셔야 해요"),
    ("them", "안 그러면 다른 사람한테 나갑니다"),
    ("me",   "얼마 정도인가요"),
    ("them", "오십만원이요"),
    ("them", "지금 바로 보내주시면 잡아드립니다"),
    ("me",   "방도 안 봤는데요"),
    ("them", "다들 그렇게 해요"),
], LIGHT, unread=True, dates=("2026년 9월 7일", "2026년 9월 8일"), body_px=25)

# --- 08 MIXED KO/EN: an international student and a Korean agent ----------
#     The vendored model is `kor` only; this records what that costs.
render("08-mixed-language.jpg", "Agent Kim", [
    ("them", "Hello, thank you for your interest in the studio"),
    ("me",   "Hi, can I visit this week?"),
    ("them", "죄송하지만 지금은 방문이 어렵습니다"),
    ("them", "Please send the deposit first to hold the room"),
    ("me",   "Can I see the contract before paying?"),
    ("them", "계약서는 입금 후에 보내드립니다"),
    ("them", "Many students do it this way, no problem"),
    ("me",   "등기부등본 can I check it?"),
    ("them", "That is not necessary for foreigners"),
], LIGHT)

# --- 09 ORDINARY goshiwon: a manager doing everything right ---------------
render("09-goshiwon-ordinary.jpg", "○○고시원 원장", [
    ("them", "안녕하세요 문의 주셔서 감사합니다"),
    ("me",   "방을 보고 싶은데 가능할까요"),
    ("them", "네 언제든 오셔서 보시고 결정하세요"),
    ("them", "오시기 전에 연락 주시면 빈 방 두 개 다 보여드릴게요"),
    ("me",   "보증금이랑 환불 규정은 어떻게 되나요"),
    ("them", "보증금 삼십만원이고 중도 퇴실하시면 일할 계산해서 돌려드립니다"),
    ("them", "계약서에도 그렇게 적혀 있습니다"),
    ("me",   "관리비는 따로 있나요"),
    ("them", "공과금 포함이라 따로 없습니다"),
], LIGHT)

# --- 10 LOW RESOLUTION: forwarded, shrunk, re-compressed twice ------------
#     What actually arrives when someone sends a screenshot of a screenshot.
render("10-low-quality.jpg", "부동산", [
    ("them", "지금 계약금 안 넣으시면 다른 분께 넘어갑니다"),
    ("me",   "조금만 생각해볼게요"),
    ("them", "오늘까지만 기다립니다"),
    ("them", "계좌번호 보내드릴게요 제 개인 계좌로 보내세요"),
    ("me",   "집주인 계좌 아닌가요"),
    ("them", "제가 받아서 전달합니다"),
], LIGHT, width=420, height=910, body_px=26, quality=45)

# --- 11 PHOTO OF A SCREEN: rotation, glare, blur -------------------------
render("11-photo-of-screen.jpg", "한빛부동산", [
    ("them", "전세로 나온 매물인데 시세보다 훨씬 쌉니다"),
    ("me",   "왜 이렇게 저렴한가요"),
    ("them", "집주인이 급하게 가셔야 해서요"),
    ("them", "근저당이 좀 있는데 곧 말소될 예정이라 괜찮습니다"),
    ("me",   "말소 확인은 어떻게 하나요"),
    ("them", "그냥 믿으셔도 됩니다 제가 십년 넘게 했어요"),
    ("them", "오늘 계약금 넣으시면 확정입니다"),
], LIGHT, quality=62, photo=True)

# --- 12 SLANG AND EMOTICONS: how students actually type ------------------
render("12-casual-slang.jpg", "원룸 아저씨", [
    ("them", "넵넵 방 아직 있어요~~"),
    ("me",   "헐 진짜요?? 언제 볼 수 있을까요 ㅎㅎ"),
    ("them", "지금 리모델링 중이라 못 보여드려요ㅠㅠ"),
    ("them", "근데 진짜 좋아요 믿으셔도 됩니다 ^^"),
    ("me",   "음.. 사진이라도 더 있을까요"),
    ("them", "카톡으로만 연락주세요 전화는 잘 안 받아요;;"),
    ("them", "가계약금 30만 먼저 쏴주시면 홀딩해드림"),
    ("me",   "계약서는요?"),
    ("them", "그건 나중에 쓰면 돼요~"),
], LIGHT, body_px=26)

# --- 13 THE FALSE-POSITIVE TRAP -----------------------------------------
#     Packed with 근저당 / 전입신고 / 계약금 / 보증금 — every one of them used
#     the CORRECT way. Nothing here should fire. If the suppressors ever
#     regress, this is the file that catches it.
render("13-correct-but-loaded.jpg", "정직공인중개사", [
    ("them", "등기부등본 떼어보시면 근저당 5천만원 잡혀 있습니다"),
    ("them", "보증금이 3천이시니까 이 부분은 꼭 확인하고 결정하세요"),
    ("me",   "그럼 위험한 건가요"),
    ("them", "집주인분이 잔금일에 말소하기로 특약에 넣기로 했습니다"),
    ("them", "특약에 안 들어가면 계약 안 하시는 게 맞습니다"),
    ("me",   "전입신고는 언제 하면 되나요"),
    ("them", "잔금 치르신 당일에 전입신고랑 확정일자 꼭 받으세요"),
    ("them", "계약금은 집주인 명의 계좌로만 보내시고 영수증 받으세요"),
    ("me",   "네 알겠습니다 감사합니다"),
], LIGHT, dates=("2026년 9월 8일", "2026년 9월 9일"))

# ===================================================== DANGEROUS SITUATIONS ==
# 14-20 hold the layout steady and isolate ONE transaction risk each, so it is
# obvious which risk a given verdict came from. Every one of these is a way a
# student actually loses a deposit, not a hypothetical.

# --- 14 깡통전세: the deposit is the whole value of the flat ---------------
#     If the owner defaults, the auction proceeds cover the bank first and the
#     tenant gets what is left, which is nothing. The tell is the agent waving
#     away a deposit-to-price ratio near 100%.
render("14-danger-kkangtong.jpg", "대박공인중개사", [
    ("them", "이 빌라 전세 2억 4천에 나왔습니다"),
    ("me",   "주변 매매가는 얼마나 하나요"),
    ("them", "매매가가 2억 5천 정도인데 요즘 다 이렇습니다"),
    ("me",   "전세가가 매매가랑 거의 같은데 괜찮은가요"),
    ("them", "요즘 빌라는 원래 그래요 신경 쓰실 필요 없습니다"),
    ("them", "보증보험은 이 물건은 가입이 안 되는데 대신 싸게 드리는 거예요"),
    ("me",   "보증보험이 왜 안 되나요"),
    ("them", "그건 절차가 복잡해서 그렇고 문제는 전혀 없습니다"),
], LIGHT)

# --- 15 신탁등기: the registered owner is a trust company -----------------
#     A contract signed with the beneficiary instead of the trustee is void
#     against the trust, and the tenant has no claim at all.
render("15-danger-trust.jpg", "임대인 최", [
    ("them", "등기부 보시면 신탁회사 이름으로 되어 있을 거예요"),
    ("me",   "그럼 집주인이 신탁회사인가요"),
    ("them", "서류상만 그렇고 실제 주인은 저입니다"),
    ("them", "계약은 저랑 하시면 되고 돈도 저한테 보내시면 됩니다"),
    ("me",   "신탁회사 동의서 같은 건 필요 없나요"),
    ("them", "그런 거 받는 사람 아무도 없어요"),
    ("them", "다들 이렇게 하고 아무 문제 없었습니다"),
], LIGHT)

# --- 16 무권대리: the person signing is not the owner and has no mandate --
render("16-danger-no-mandate.jpg", "김실장", [
    ("them", "집주인분은 연세가 있으셔서 제가 대신 계약합니다"),
    ("me",   "위임장이랑 인감증명서 볼 수 있을까요"),
    ("them", "그런 건 원래 안 보여드립니다"),
    ("them", "제가 이 건물 관리한 지 십 년이 넘었어요"),
    ("me",   "집주인분이랑 통화라도 할 수 있나요"),
    ("them", "지금 병원에 계셔서 연락이 안 됩니다"),
    ("them", "계약금은 제 계좌로 넣으시면 제가 전달해 드릴게요"),
], LIGHT)

# --- 17 이중계약: the flat is already let to someone else -----------------
render("17-danger-double-lease.jpg", "박사장", [
    ("them", "이 방 지금 바로 계약 가능합니다"),
    ("me",   "전에 살던 분은 나가셨나요"),
    ("them", "아직 계시는데 곧 나갈 거예요"),
    ("me",   "언제 나가시는지 확인할 수 있을까요"),
    ("them", "그건 제가 알아서 정리할 테니까 신경 안 쓰셔도 됩니다"),
    ("them", "전입세대열람은 굳이 떼실 필요 없어요"),
    ("them", "먼저 계약금 넣으시는 분이 임자입니다"),
    ("me",   "그래도 확인은 하고 싶은데요"),
    ("them", "그러다 다른 분한테 넘어가요"),
], LIGHT)

# --- 18 무등록 중개: no licence, and no documents may be photographed ----
render("18-danger-unlicensed.jpg", "부동산 상담", [
    ("them", "저희는 수수료 없이 직거래로 연결해 드립니다"),
    ("me",   "중개사무소 등록번호 알 수 있을까요"),
    ("them", "저희는 정식 중개는 아니고 소개만 하는 거라 등록증은 없습니다"),
    ("me",   "그럼 계약서는 누가 쓰나요"),
    ("them", "저희 양식으로 쓰시면 되고 공제증서는 따로 없습니다"),
    ("them", "서류는 보여드리는데 사진 촬영은 안 됩니다"),
    ("them", "수수료는 현금으로만 받습니다"),
], LIGHT)

# --- 19 명의 불일치: the bank account is not the registered owner ---------
render("19-danger-name-mismatch.jpg", "행운부동산", [
    ("them", "계약서에 임대인은 김○○으로 들어갑니다"),
    ("me",   "등기부상 소유자도 같은 분인가요"),
    ("them", "등기는 아버님 명의인데 실제로는 아드님이 관리하세요"),
    ("them", "입금은 아드님 계좌로 하시면 됩니다 명의가 좀 달라요"),
    ("me",   "그래도 소유자 계좌로 보내야 하지 않나요"),
    ("them", "가족끼리인데 뭐 어떻습니까"),
    ("them", "다들 이렇게 합니다"),
], LIGHT)

# --- 20 가압류·경매 진행 중 -----------------------------------------------
render("20-danger-seizure.jpg", "임대인", [
    ("me",   "등기부에 가압류가 걸려 있던데요"),
    ("them", "아 그거 별거 아닙니다 곧 풀립니다"),
    ("me",   "경매 넘어가면 보증금은 어떻게 되나요"),
    ("them", "경매까지 갈 일 없어요 걱정도 팔자입니다"),
    ("them", "확정일자만 받아두시면 아무 문제 없습니다"),
    ("me",   "선순위 채권이 얼마인지 알 수 있을까요"),
    ("them", "그런 거 따지면 계약 못 해요"),
    ("them", "오늘 안에 결정 안 하시면 다음 분께 넘어갑니다"),
], LIGHT)

# --- 21 ORDINARY, with every alarming word in it -------------------------
#     A trust-owned flat handled CORRECTLY: the agent names the trustee, says
#     the consent is required, and points the money at the trust account. The
#     vocabulary is identical to 15; only the direction differs.
render("21-trust-done-right.jpg", "바른공인중개사", [
    ("them", "이 물건은 등기부상 소유자가 신탁회사로 되어 있습니다"),
    ("them", "그래서 신탁사 임대차 동의서를 먼저 받아야 계약이 유효합니다"),
    ("me",   "동의서는 누가 받나요"),
    ("them", "제가 신탁사에 요청해서 받아드리고 사본도 드립니다"),
    ("them", "보증금은 신탁사 지정 계좌로 입금하셔야 합니다"),
    ("me",   "집주인 개인 계좌로 보내면 안 되나요"),
    ("them", "절대 안 됩니다 그렇게 하시면 보호받지 못합니다"),
    ("me",   "네 알겠습니다"),
], LIGHT)

# --- 22 ORDINARY: a landlord declining something, politely ---------------
#     Refusals by the tenant and ordinary "no" answers must not read as
#     pressure. This is the negation case the gate exists for.
render("22-ordinary-refusal.jpg", "이집주인", [
    ("me",   "혹시 계약금을 먼저 보내드릴까요"),
    ("them", "아니요 방 보시고 계약서 쓰실 때 주시면 됩니다"),
    ("me",   "반려동물은 가능할까요"),
    ("them", "죄송하지만 반려동물은 안 됩니다"),
    ("me",   "전입신고는 괜찮나요"),
    ("them", "네 전입신고 문제없고 확정일자도 꼭 받으세요"),
    ("me",   "근저당은 없나요"),
    ("them", "근저당 없습니다 등기부 보시면 확인되실 거예요"),
], LIGHT)


print("\n%d screenshots in %s" % (len(os.listdir(OUT)), OUT))
