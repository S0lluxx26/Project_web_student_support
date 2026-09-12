"""Build the reviewed Korean feature introduction in Malgun Gothic, 9pt/1.0.

Run after: node scripts/capture-manual.mjs --features --lang ko
Requires reportlab, Pillow and pypdf. No network access is performed.
"""
from pathlib import Path
from xml.sax.saxutils import escape
import hashlib
import json
import os
import re
import shutil
import zipfile
from PIL import Image as PILImage
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Image, Spacer, PageBreak

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'manual/MAIN_FUNCTIONS_KO.md'
OUT = ROOT / 'output/pdf/main-functions-ko.pdf'
PUBLIC = ROOT / 'manual/main-functions-ko.pdf'
REPO = 'https://github.com/S0lluxx26/Project_web_student_support'
SITE = 'https://s0lluxx26.github.io/Project_web_student_support/'
FONT = Path(os.environ.get('GUIDE_FONT', 'C:/Windows/Fonts/malgun.ttf'))
BOLD = Path(os.environ.get('GUIDE_FONT_BOLD', 'C:/Windows/Fonts/malgunbd.ttf'))
assert FONT.is_file() and BOLD.is_file(), 'Install Malgun Gothic or set GUIDE_FONT and GUIDE_FONT_BOLD to its files.'
pdfmetrics.registerFont(TTFont('Feature', str(FONT)))
pdfmetrics.registerFont(TTFont('FeatureBold', str(BOLD)))
pdfmetrics.registerFontFamily('Feature', normal='Feature', bold='FeatureBold', italic='Feature', boldItalic='FeatureBold')
text = SOURCE.read_text(encoding='utf8')
assert 'Bui Xuan Mai' in text and REPO in text and SITE in text
assert not re.search(r'\b(daughter|father|mother)\b|딸|아버지|어머니', text, re.I)
assert 'font-size=9pt; line-spacing=1.0' in text
submission = text.split('<!-- authoring-notes:start -->')[0]
sections = re.split(r'^## (3\.\d+\. .+)$', submission, flags=re.M)
assert len(sections) == 13, 'Expected six numbered feature sections'
records = json.loads((ROOT / 'assets/manual/features-ko/cases.json').read_text(encoding='utf8'))
assert [(c['id'], c['assessment'], len(c['signals'])) for c in records['cases']] == [
    ('pressure', 'strong_warning_signals', 4), ('ordinary', 'no_known_signals', 0)]
assert records['helpCases'] == 12 and records['exportDemo']['fictional']
assert '010-0000-0000' not in records['exportDemo']['preview']
assert '전화번호 2' in records['exportDemo']['maskSummary']

INK = colors.HexColor('#182e33')
TEAL = colors.HexColor('#146356')
WIDTH = A4[0] - 80
styles = {
    'body': ParagraphStyle('body', fontName='Feature', fontSize=9, leading=9,
        wordWrap='CJK', textColor=INK, spaceAfter=7),
    'heading': ParagraphStyle('heading', fontName='FeatureBold', fontSize=9, leading=9,
        wordWrap='CJK', textColor=TEAL, spaceBefore=6, spaceAfter=9, keepWithNext=True),
    'caption': ParagraphStyle('caption', fontName='Feature', fontSize=9, leading=9,
        wordWrap='CJK', textColor=INK, spaceBefore=5, spaceAfter=11),
}

def inline(value):
    value = escape(value)
    value = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', value)
    return re.sub(r'(https://[^\s<]+)', r'<link href="\1" color="#146356">\1</link>', value)

def paragraph(value, style='body'):
    return Paragraph(inline(value), styles[style])

class FeatureDocument(SimpleDocTemplate):
    def afterFlowable(self, item):
        title = getattr(item, 'feature_title', None)
        if title:
            self.canv.bookmarkPage(title)
            self.canv.addOutlineEntry(title, title, level=0)

def decorate(canvas, doc):
    canvas.saveState()
    canvas.setFont('Feature', 9)
    canvas.setFillColor(INK)
    canvas.drawString(40, A4[1] - 28, '학생 주거 안전 도우미 | 주요 기능 소개')
    canvas.drawString(40, 25, 'Bui Xuan Mai')
    canvas.drawRightString(A4[0] - 40, 25, f'{doc.page} / 6')
    canvas.setStrokeColor(colors.HexColor('#d3e0dc'))
    canvas.line(40, 40, A4[0] - 40, 40)
    canvas.restoreState()

story = []
images = []
for index in range(6):
    if index:
        story.append(PageBreak())
    else:
        for line in sections[0].strip().splitlines():
            if not line.strip() or line.startswith('<!--'):
                continue
            story.append(paragraph(line[2:] if line.startswith('# ') else line,
                'heading' if line.startswith('# ') else 'body'))
    title, body = sections[index * 2 + 1:index * 2 + 3]
    heading = paragraph(title, 'heading')
    heading.feature_title = title
    story.append(heading)
    match = re.search(r'!\[([^\]]+)\]\(([^)]+)\)', body)
    assert match, title
    caption, href = match.groups()
    image_path = (SOURCE.parent / href).resolve()
    assert image_path.is_relative_to(ROOT) and image_path.is_file()
    images.append(image_path)
    story.append(paragraph('화면', 'heading'))
    with PILImage.open(image_path) as picture:
        width, height = picture.size
    ratio = min(WIDTH / width, 435 / height)
    story.append(Image(str(image_path), width=width * ratio, height=height * ratio))
    story.append(paragraph(caption, 'caption'))
    details = body[match.end():].strip()
    for block in re.split(r'\n\s*\n', details):
        story.append(paragraph(block.replace('\n', ' ')))

OUT.parent.mkdir(parents=True, exist_ok=True)
doc = FeatureDocument(str(OUT), pagesize=A4, leftMargin=40, rightMargin=40,
    topMargin=48, bottomMargin=52, title='3. 주요 기능 소개 - 학생 주거 안전 도우미', author='Bui Xuan Mai')
doc.build(story, onFirstPage=decorate, onLaterPages=decorate)
reader = PdfReader(OUT)
assert len(reader.pages) == 6, f'Unexpected page count: {len(reader.pages)}'
assert reader.metadata.author == 'Bui Xuan Mai'
for index, page in enumerate(reader.pages):
    title = sections[index * 2 + 1]
    assert title in page.extract_text(), 'Feature moved to another page: ' + title
    def verify_text(value, cm, tm, font, size):
        if value.strip():
            assert abs(size - 9) < 0.001, f'Text must be 9pt, found {size}'
            assert font and 'MalgunGothic' in str(font.get('/BaseFont')), 'Unexpected document font'
    page.extract_text(visitor_text=verify_text)
all_text = '\n'.join(page.extract_text() for page in reader.pages)
assert REPO in all_text and SITE in all_text
assert not re.search(r'\b(daughter|father|mother)\b|딸|아버지|어머니', all_text, re.I)
assert all_text.count('기능 설명:') == 6 and all_text.count('구현 결과:') == 6
PUBLIC.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(OUT, PUBLIC)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
record = {'source': str(SOURCE.relative_to(ROOT)).replace('\\', '/'), 'sourceSha256': sha(SOURCE),
    'pdf': 'manual/main-functions-ko.pdf', 'pdfSha256': sha(PUBLIC), 'pages': 6,
    'font': 'Malgun Gothic', 'fontSizePt': 9, 'lineSpacing': 1.0, 'leadingPt': 9,
    'maker': 'Bui Xuan Mai', 'captureRecordSha256': sha(ROOT / 'assets/manual/features-ko/cases.json'),
    'screenshots': [{'file': p.relative_to(ROOT).as_posix(), 'sha256': sha(p)} for p in images]}
(ROOT / 'assets/manual/features-ko/report-build.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf8', newline='\n')
bundle = ROOT / 'output/main-functions-ko-submission.zip'
with zipfile.ZipFile(bundle, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for p in [SOURCE, PUBLIC, *images, ROOT / 'assets/manual/features-ko/cases.json', ROOT / 'assets/manual/features-ko/report-build.json']:
        archive.write(p, p.relative_to(ROOT).as_posix())
print(json.dumps({'pdf': str(OUT), 'pages': 6, 'font': 'Malgun Gothic', 'textPt': 9, 'leadingPt': 9, 'bundle': str(bundle)}, ensure_ascii=False))
