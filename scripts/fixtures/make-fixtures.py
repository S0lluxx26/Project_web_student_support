#!/usr/bin/env python3
"""
Regenerate the OCR fixtures next to this file.

    python3 scripts/fixtures/make-fixtures.py

The PNGs are committed, so this only needs running when a case is added or a
case's wording changes. Needs Pillow and a Korean font; on Debian/Ubuntu:

    sudo apt install fonts-noto-cjk && pip install Pillow

These are SYNTHETIC. They reproduce the layout of a Korean chat app closely
enough to catch the failure modes that matter — coloured outgoing bubbles,
small grey timestamps, a two-column split — but they are not photographs of a
real phone, and a real capture carries compression artefacts and a status bar
that these do not. Treat a green run as a regression guard, not as evidence
that the feature works on a user's actual screenshot; that is what the browser
smoke test and real screenshots are for.

No real names, numbers or addresses appear in any fixture.
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
CANDIDATES = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJKkr-Regular.otf",
    "/System/Library/Fonts/AppleSDGothicNeo.ttc",
    "C:/Windows/Fonts/malgun.ttf",
]


def font_path():
    for p in CANDIDATES:
        if os.path.exists(p):
            return p
    raise SystemExit("no Korean font found; install fonts-noto-cjk")


FONT = font_path()
def f(size):
    return ImageFont.truetype(FONT, size, index=0 if FONT.endswith(".ttf") else 2)


def chat(name, messages, bg, mine, theirs, text_colour=(20, 20, 20), stamps=True):
    """A KakaoTalk-shaped capture: theirs on the left, mine on the right."""
    W, PAD, LH = 760, 22, 46
    body, small = f(26), f(14)
    img = Image.new("RGB", (W, PAD * 2 + LH * len(messages) + 40), bg)
    d = ImageDraw.Draw(img)
    d.text((PAD, 14), "집주인", font=f(18), fill=(40, 40, 40))
    y = PAD + 34
    for who, line in messages:
        w = int(d.textlength(line, font=body)) + 28
        x = W - PAD - w if who == "me" else PAD + 46
        d.rounded_rectangle([x, y, x + w, y + 38], 10,
                            fill=mine if who == "me" else theirs)
        d.text((x + 14, y + 7), line, font=body, fill=text_colour)
        if stamps:
            sx = W - PAD - 62 if who == "me" else x + w + 6
            d.text((sx, y + 12), "오후 3:21", font=small, fill=(90, 100, 110))
        y += LH
    out = os.path.join(HERE, name)
    img.save(out)
    print("wrote", out, img.size)


# 1. The case that made greyscale non-optional: on the raw channels the yellow
#    outgoing bubbles binarise into the blue-grey page and every line the user
#    typed disappears.
chat("kakao-ko.png", [
    ("them", "안녕하세요 방 보고 연락드렸어요"),
    ("me",   "네 안녕하세요 이번 주에 볼 수 있을까요"),
    ("them", "지금 세입자가 있어서 방을 못 보여드려요"),
    ("them", "오늘 계약금 50만원 먼저 보내주시면 잡아드릴게요"),
    ("them", "제 명의 계좌로 보내주세요"),
    ("me",   "등기부등본 보여주실 수 있나요"),
    ("them", "그건 계약할 때 보여드립니다"),
], bg=(171, 198, 216), mine=(254, 229, 81), theirs=(255, 255, 255))

# 2. The easy case, as a floor: dark text on white, no colour anywhere. If this
#    ever regresses the engine itself is broken, not the preprocessing.
chat("plain-ko.png", [
    ("them", "보증금은 오천만원입니다"),
    ("me",   "전입신고 가능한가요"),
    ("them", "전입신고는 안 됩니다"),
    ("me",   "왜 안 되나요"),
    ("them", "집주인 사정이 있어서요"),
], bg=(255, 255, 255), mine=(240, 240, 240), theirs=(255, 255, 255), stamps=False)

# 3. Dark mode, which inverts the polarity the binariser expects.
chat("dark-ko.png", [
    ("them", "오늘 안에 입금하셔야 방이 유지됩니다"),
    ("me",   "계약서 먼저 볼 수 있나요"),
    ("them", "계약서는 입금 확인 후에 보내드려요"),
    ("me",   "직접 만나서 쓰면 안 될까요"),
    ("them", "제가 지방에 있어서 못 갑니다"),
], bg=(24, 26, 30), mine=(58, 90, 140), theirs=(46, 49, 56),
   text_colour=(238, 238, 238))
