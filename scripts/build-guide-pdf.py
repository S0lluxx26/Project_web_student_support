"""Convert reviewed Markdown to PDF; requires reportlab, pypdf and Pillow.
Windows fonts default to Malgun Gothic. Else set GUIDE_FONT and GUIDE_FONT_BOLD.
No network access, model download or code execution from Markdown.
"""
from pathlib import Path
from xml.sax.saxutils import escape, quoteattr
from urllib.parse import urljoin
import hashlib, json, os, re, shutil, textwrap
from PIL import Image as PILImage
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, CondPageBreak, Table, TableStyle, Image, KeepTogether, Preformatted
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "manual/PROJECT_GUIDE.md"
OUT = ROOT / "output/pdf/project-guide.pdf"
PUBLIC = ROOT / "manual/project-guide.pdf"
REPO = "https://github.com/S0lluxx26/Project_web_student_support"
PROMPTS = REPO + "/blob/main/docs/AI_PROMPTS.md"
PUBLIC_SOURCE = "https://s0lluxx26.github.io/Project_web_student_support/manual/PROJECT_GUIDE.md"
FENCE = chr(96) * 3
md = SOURCE.read_text(encoding="utf-8")
assert "**Maker: Bui Xuan Mai**" in md and REPO in md and PROMPTS in md
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
styles["toc"] = ParagraphStyle("toc", parent=styles["body"], fontSize=10, leading=15, spaceBefore=6, spaceAfter=6, rightIndent=25)

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def slug(text):
    return re.sub(r"[^a-z0-9 -]", "", text.lower()).replace(" ", "-")

diagram_manifest = json.loads((ROOT / "assets/manual/diagrams/manifest.json").read_text(encoding="utf-8"))
diagrams = {item["id"]: item for item in diagram_manifest["diagrams"]}
for item in diagrams.values():
    for kind in ("source", "svg", "png"):
        assert digest(ROOT / item[kind]) == item[kind + "Sha256"], "Stale diagram: " + item[kind]

class GuideDocument(SimpleDocTemplate):
    def beforeDocument(self):
        self.chapter_entries = []

    def afterFlowable(self, flowable):
        entry = getattr(flowable, "guide_heading", None)
        if not entry:
            return
        level, title, key = entry
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(title, key, level=level, closed=False)
        if level == 0:
            self.notify("TOCEntry", (0, title, self.page, key))
            self.chapter_entries.append({"title": title, "anchor": key, "page": self.page})

def inline(text):
    tokens = []
    def hold(markup):
        tokens.append(markup)
        return "\x00" + str(len(tokens) - 1) + "\x00"
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", lambda m: hold(
        "<a href=" + quoteattr(m.group(2) if m.group(2).startswith("#") else urljoin(PUBLIC_SOURCE, m.group(2))) + ' color="#146356">' + escape(m.group(1)) + "</a>"), text)
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

story, lines, i, headings, pending_diagram = [], md.splitlines(), 0, [], None
section_breaks = 0
rendered_diagrams = []
while i < len(lines):
    line = lines[i]
    if not line.strip():
        i += 1; continue
    if line.strip() == "<!-- pagebreak -->":
        # Keep the cover, contents, architecture and diagram chapters separate.
        # Later chapters may share a page when there is room for a substantial
        # introduction, avoiding almost-empty screenshot/paragraph spill pages.
        story.append(PageBreak() if section_breaks < 5 else CondPageBreak(300))
        if section_breaks >= 5:
            story.append(Spacer(1, 14))
        section_breaks += 1
        i += 1; continue
    if line.strip() == "<!-- toc:start -->":
        toc = TableOfContents()
        toc.levelStyles = [styles["toc"]]
        toc.dotsMinLevel = 0
        story.append(toc)
        while i < len(lines) and lines[i].strip() != "<!-- toc:end -->":
            i += 1
        assert i < len(lines), "Unclosed contents marker"
        i += 1; continue
    diagram_marker = re.fullmatch(r"<!-- mermaid: ([a-z-]+) -->", line.strip())
    if diagram_marker:
        pending_diagram = diagram_marker[1]
        i += 1; continue
    heading = re.match(r"^(#{1,3}) (.+)$", line)
    if heading:
        headings.append(heading[2])
        paragraph = para(heading[2], "h" + str(len(heading[1])))
        if len(heading[1]) == 2 and re.match(r"\d+\. ", heading[2]):
            paragraph.guide_heading = (0, heading[2], slug(heading[2]))
        elif len(heading[1]) == 3 and re.match(r"[34]\.[12] ", heading[2]):
            paragraph.guide_heading = (1, heading[2], slug(heading[2]))
        story.append(paragraph); i += 1; continue
    if line.startswith(FENCE):
        language = line[len(FENCE):].strip()
        i += 1
        block = []
        while i < len(lines) and not lines[i].startswith(FENCE):
            block.append(lines[i])
            i += 1
        if language == "mermaid":
            assert pending_diagram in diagrams, "Missing Mermaid figure marker"
            item = diagrams[pending_diagram]
            expected = (ROOT / item["source"]).read_text(encoding="utf-8").strip()
            assert "\n".join(block).strip() == expected, "Markdown/source diagram mismatch: " + pending_diagram
            file = ROOT / item["png"]
            with PILImage.open(file) as img:
                w, h = img.size
            scale = min(WIDTH / w, 575 / h)
            figure = Image(str(file), width=w * scale, height=h * scale, hAlign="CENTER")
            figure.keepWithNext = True
            story.append(figure)
            rendered_diagrams.append(pending_diagram)
            pending_diagram = None
        else:
            wrapped = []
            for row in block:
                wrapped.extend(textwrap.wrap(row, width=91, replace_whitespace=False, drop_whitespace=False) or [""])
            story.append(Preformatted("\n".join(wrapped), styles["code"]))
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
    story.append(Paragraph(markup, styles["caption"] if re.match(r"Figure \d+\.", block[0]) else styles["body"]))

OUT.parent.mkdir(parents=True, exist_ok=True)
doc = GuideDocument(str(OUT), pagesize=A4, rightMargin=MARGIN, leftMargin=MARGIN, topMargin=48, bottomMargin=47,
                        title="Student Housing Safety Assistant - Project guide", author="Bui Xuan Mai")
assert len(rendered_diagrams) == len(diagrams) == 4
doc.multiBuild(story, onFirstPage=decorate, onLaterPages=decorate)
reader = PdfReader(str(OUT))
text = "\n".join(page.extract_text() for page in reader.pages)
collapsed = re.sub(r"\s+", "", text)
assert REPO in collapsed and PROMPTS in collapsed and "BuiXuanMai" in collapsed
assert not re.search(r"\b(daughter|father|mother)\b", text, re.I)
for heading in headings:
    assert re.sub(r"\s+", "", heading) in collapsed, "Missing heading: " + heading
assert reader.metadata.author == "Bui Xuan Mai"
assert len(doc.chapter_entries) == 15
for entry in doc.chapter_entries:
    page_text = re.sub(r"\s+", "", reader.pages[entry["page"] - 1].extract_text())
    assert re.sub(r"\s+", "", entry["title"]) in page_text, "Incorrect contents destination: " + entry["title"]
PUBLIC.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(OUT, PUBLIC)
assert OUT.read_bytes() == PUBLIC.read_bytes()
record = {"source": "manual/PROJECT_GUIDE.md", "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
          "pdfSha256": hashlib.sha256(OUT.read_bytes()).hexdigest(), "pages": len(reader.pages),
          "bytes": OUT.stat().st_size, "maker": reader.metadata.author, "repository": REPO,
          "promptReference": PROMPTS, "headingsVerified": len(headings), "contents": doc.chapter_entries,
          "diagramManifestSha256": digest(ROOT / "assets/manual/diagrams/manifest.json"),
          "visualReview": "Required separately: render and inspect every page."}
(ROOT / "assets/manual/report-build.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
tmp = ROOT / "tmp/pdfs"
tmp.mkdir(parents=True, exist_ok=True)
(tmp / "guide-text.txt").write_text(text, encoding="utf-8")
(tmp / "build-record.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
print(json.dumps(record, indent=2))
