"""Draw explicitly fictional Korean conversation fixtures, without private data.
Requires Pillow and a Korean TrueType font (set EXAMPLE_FONT on other systems).
"""
import json, os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[1]
font_path=os.environ.get('EXAMPLE_FONT','C:/Windows/Fonts/malgun.ttf')
font=ImageFont.truetype(font_path,28)
small=ImageFont.truetype(font_path,22)
records=json.loads((ROOT/'assets/examples/cases.json').read_text(encoding='utf-8'))
for case in records['cases']:
    dark=case['id'] in ['ordinary-denial','pressure-later-demand','risk-registration']
    bg,ink=('#252c35','#f2f5fa') if dark else ('#c9dce7','#162932')
    image=Image.new('RGB',(820,1200),bg)
    d=ImageDraw.Draw(image)
    d.text((32,22),'연습용 대화 · 가상 예시',font=small,fill=ink)
    d.text((32,62),case['title']['ko'],font=font,fill=ink)
    y=125
    for role,text in case['messages']:
        mine=role=='세입자'
        content=role+': '+text
        lines=[];line=''
        for char in content:
            if d.textlength(line+char,font=font)>575:
                lines.append(line);line=char
            else:line+=char
        if line:lines.append(line)
        x=150 if mine else 30
        height=len(lines)*43+36
        d.rounded_rectangle((x,y,x+640,y+height),radius=18,fill='#ffdf64' if mine else ('#394451' if dark else '#ffffff'))
        for row,line in enumerate(lines):
            d.text((x+22,y+15+row*43),line,font=font,fill='#162932' if mine else ink)
        y+=height+30
    d.text((32,max(y+20,760)),'개인정보 없는 학습용 이미지',font=small,fill=ink)
    # Crop unused space while leaving the complete conversation intact.
    image=image.crop((0,0,820,max(y+110,870)))
    image.save(ROOT/case['image'],optimize=True)
print('Wrote',len(records['cases']),'fictional learning screenshots.')
