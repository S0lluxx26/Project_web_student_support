"""Convert reviewed Markdown to PDF; requires reportlab, pypdf and Pillow.
Windows fonts default to Malgun Gothic. Else set GUIDE_FONT and GUIDE_FONT_BOLD.
No network access, model download or code execution from Markdown.
"""
from pathlib import Path
from xml.sax.saxutils import escape, quoteattr
import hashlib, json, os, re, shutil, textwrap
from PIL import Image as PILImage
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, CondPageBreak, Table, TableStyle, Image, KeepTogether, Preformatted

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "manual/PROJECT_GUIDE.md"
OUT = ROOT / "output/pdf/project-guide.pdf"
PUBLIC = ROOT / "manual/project-guide.pdf"
REPO = "https://github.com/S0lluxx26/Project_web_student_support"
FENCE = chr(96) * 3
md = SOURCE.read_text(encoding="utf-8")
assert "**Maker: Bui Xuan Mai**" in md and REPO in md
assert not re.search(r"\b(daughter|father|mother)\b", md, re.I)
assert md.count(FENCE) % 2 == 0, "Unclosed Markdown code fence"
regular = Path(os.environ.get("GUIDE_FONT", "C:/Windows/Fonts/malgun.ttf"))
bold = Path(os.environ.get("GUIDE_FONT_BOLD", "C:/Windows/Fonts/malgunbd.ttf"))
if not regular.is_file() or not bold.is_file():
    raise SystemExit("Set GUIDE_FONT and GUIDE_FONT_BOLD to suitable Unicode TrueType fonts.")
pdfmetrics.registerFont(TTFont("Guide", str(regular)))
pdfmetrics.registerFont(TTFont("GuideBold", str(bold)))
pdfmetrics.registerFontFamily("Guide", normal="Guide", bold="GuideBold", italic="Guide", boldItalic="GuideBold")
mono = Path("C:/Windows/Fonts/consola.ttf")
if mono.is_file():
    pdfmetrics.registerFont(TTFont("GuideMono", str(mono)))
    MONO = "GuideMono"
else:
    MONO = "Courier"
ink, teal, dim = [colors.HexColor(x) for x in ["#182e33", "#146356", "#49636a"]]
PAGE_W, PAGE_H = A4
MARGIN = 43
WIDTH = PAGE_W - 2 * MARGIN
styles = {
    "body": ParagraphStyle("body", fontName="Guide", fontSize=9.15, leading=13.4, textColor=ink, spaceAfter=8, splitLongWords=True),
    "h1": ParagraphStyle("h1", fontName="GuideBold", fontSize=29, leading=34, textColor=ink, spaceBefore=34, spaceAfter=18, keepWithNext=True),
    "h2": ParagraphStyle("h2", fontName="GuideBold", fontSize=17, leading=22, textColor=teal, spaceBefore=7, spaceAfter=16, keepWithNext=True),
    "h3": ParagraphStyle("h3", fontName="GuideBold", fontSize=11.1, leading=15, textColor=ink, spaceBefore=12, spaceAfter=7, keepWithNext=True),
    "caption": ParagraphStyle("caption", fontName="Guide", fontSize=8, leading=11, textColor=dim, spaceBefore=5, spaceAfter=12),
    "code": ParagraphStyle("code", fontName=MONO, fontSize=8.1, leading=11.4, textColor=ink, backColor=colors.HexColor("#eef3ef"), borderPadding=10, spaceBefore=5, spaceAfter=14),
    "cell": ParagraphStyle("cell", fontName="Guide", fontSize=8, leading=11.4, textColor=ink),
    "cellhead": ParagraphStyle("cellhead", fontName="GuideBold", fontSize=8, leading=11.4, textColor=colors.white)
}
styles["bullet"] = ParagraphStyle("bullet", parent=styles["body"], leftIndent=13, firstLineIndent=-10, spaceAfter=4)

def inline(text):
    tokens = []
    def hold(markup):
        tokens.append(markup)
        return "\x00" + str(len(tokens) - 1) + "\x00"
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", lambda m: hold(
        "<a href=" + quoteattr(m.group(2)) + ' color="#146356">' + escape(m.group(1)) + "</a>"), text)
    text = re.sub(chr(96) + "([^" + chr(96) + "]+)" + chr(96), lambda m: hold('<font name="' + MONO + '">' + escape(m.group(1)) + "</font>"), text)
    text = escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    return re.sub(r"\x00(\d+)\x00", lambda m: tokens[int(m.group(1))], text)

def para(text, style="body"):
    return Paragraph(inline(text), styles[style])

def decorate(canvas, doc):
    canvas.saveState()
    canvas.setTitle("Student Housing Safety Assistant - Project guide")
    canvas.setAuthor("Bui Xuan Mai")
    canvas.setSubject("Illustrated manual, architecture, AI prompts and installation for " + REPO)
    canvas.setFillColor(dim)
    canvas.setFont("Guide", 7.5)
    if doc.page > 1:
        canvas.drawString(MARGIN, PAGE_H - 28, "STUDENT HOUSING SAFETY ASSISTANT / PROJECT GUIDE")
    canvas.setStrokeColor(colors.HexColor("#d3e0dc"))
    canvas.line(MARGIN, 35, PAGE_W - MARGIN, 35)
    canvas.drawString(MARGIN, 22, "Bui Xuan Mai | 12 September 2026")
    canvas.drawRightString(PAGE_W - MARGIN, 22, str(doc.page))
    canvas.restoreState()

story, lines, i, headings, section_breaks = [], md.splitlines(), 0, [], 0
while i < len(lines):
    line = lines[i]
    if not line.strip():
        i += 1; continue
    if line.strip() == "<!-- pagebreak -->":
        # Keep the cover separate. Subsequent section boundaries reserve room
        # for an introduction rather than producing nearly empty spill pages.
        story.append(PageBreak() if section_breaks == 0 else CondPageBreak(190))
        if section_breaks: story.append(Spacer(1, 12))
        section_breaks += 1
        i += 1; continue
    heading = re.match(r"^(#{1,3}) (.+)$", line)
    if heading:
        headings.append(heading[2])
        story.append(para(heading[2], "h" + str(len(heading[1])))); i += 1; continue
    if line.startswith(FENCE):
        i += 1
        block = []
        while i < len(lines) and not lines[i].startswith(FENCE):
            block.extend(textwrap.wrap(lines[i], width=91, replace_whitespace=False, drop_whitespace=False) or [""])
            i += 1
        story.append(Preformatted("\n".join(block), styles["code"]))
        i += 1; continue
    match = re.match(r"!\[([^\]]*)\]\(([^)]+)\)", line)
    if match:
        file = (SOURCE.parent / match[2]).resolve()
        if not file.is_relative_to(ROOT) or not file.is_file():
            raise ValueError("Missing or out-of-project image: " + str(file))
        with PILImage.open(file) as img:
            w, h = img.size
        scale = min(WIDTH / w, 295 / h)
        story.append(KeepTogether([Spacer(1, 5), Image(str(file), width=w * scale, height=h * scale, hAlign="LEFT"), para(match[1], "caption")]))
        i += 1; continue
    if line.startswith("|"):
        rows = []
        while i < len(lines) and lines[i].startswith("|"):
            cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
            if not all(re.fullmatch(r":?-+:?", c) for c in cells):
                rows.append(cells)
            i += 1
        n = len(rows[0])
        widths = [WIDTH * .20, WIDTH * .39, WIDTH * .41] if n == 3 else [WIDTH / n] * n
        table = Table([[para(c, "cellhead" if j == 0 else "cell") for c in row] for j, row in enumerate(rows)], colWidths=widths, repeatRows=1, hAlign="LEFT")
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), teal),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f0f5f1"), colors.white]),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LINEBELOW", (0, 0), (-1, -1), .4, colors.HexColor("#d3e0dc"))]))
        story.extend([table, Spacer(1, 11)])
        continue
    bullet = re.match(r"^(- |\d+\. )(.+)$", line)
    if bullet:
        text = bullet[2]; i += 1
        while i < len(lines) and lines[i].startswith("  ") and lines[i].strip():
            text += " " + lines[i].strip(); i += 1
        story.append(para(bullet[1] + text, "bullet")); continue
    block = [line]
    i += 1
    while i < len(lines) and lines[i].strip() and not lines[i].startswith(FENCE) and not re.match(r"^(#|!\[|\||<!--|- |\d+\. )", lines[i]):
        block.append(lines[i]); i += 1
    markup = ""
    for j, part in enumerate(block):
        markup += inline(part.rstrip())
        if j < len(block) - 1:
            markup += "<br/>" if part.endswith("  ") else " "
    story.append(Paragraph(markup, styles["body"]))

OUT.parent.mkdir(parents=True, exist_ok=True)
doc = SimpleDocTemplate(str(OUT), pagesize=A4, rightMargin=MARGIN, leftMargin=MARGIN, topMargin=48, bottomMargin=47,
                        title="Student Housing Safety Assistant - Project guide", author="Bui Xuan Mai")
doc.build(story, onFirstPage=decorate, onLaterPages=decorate)
reader = PdfReader(str(OUT))
text = "\n".join(page.extract_text() for page in reader.pages)
collapsed = re.sub(r"\s+", "", text)
assert REPO in collapsed and "BuiXuanMai" in collapsed
assert not re.search(r"\b(daughter|father|mother)\b", text, re.I)
for heading in headings:
    assert re.sub(r"\s+", "", heading) in collapsed, "Missing heading: " + heading
assert reader.metadata.author == "Bui Xuan Mai"
PUBLIC.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(OUT, PUBLIC)
assert OUT.read_bytes() == PUBLIC.read_bytes()
record = {"source": "manual/PROJECT_GUIDE.md", "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
          "pdfSha256": hashlib.sha256(OUT.read_bytes()).hexdigest(), "pages": len(reader.pages),
          "bytes": OUT.stat().st_size, "maker": reader.metadata.author, "repository": REPO,
          "headingsVerified": len(headings), "visualReview": "Required separately: render and inspect every page."}
tmp = ROOT / "tmp/pdfs"
tmp.mkdir(parents=True, exist_ok=True)
(tmp / "guide-text.txt").write_text(text, encoding="utf-8")
(tmp / "build-record.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
print(json.dumps(record, indent=2))
