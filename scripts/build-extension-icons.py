"""Render the simple public/webguide.svg brand geometry into antialiased extension PNGs."""
from pathlib import Path
from PIL import Image, ImageDraw
out=Path('browser-extension/icons');out.mkdir(exist_ok=True)
scale=8
im=Image.new('RGBA',(64*scale,64*scale),(0,0,0,0));draw=ImageDraw.Draw(im)
draw.rounded_rectangle((0,0,64*scale-1,64*scale-1),radius=16*scale,fill='#102544')
def stroke(points,color,width):
 points=[(x*scale,y*scale) for x,y in points]
 draw.line(points,fill=color,width=width*scale,joint='curve')
 r=width*scale/2
 for x,y in points:draw.ellipse((x-r,y-r,x+r,y+r),fill=color)
stroke([(13,22),(21,45),(32,26),(43,45),(51,22)],'#ffffff',5)
stroke([(23,13),(41,13)],'#60a5fa',4)
for size in (16,32,48,128):im.resize((size,size),Image.Resampling.LANCZOS).save(out/f'webguide-{size}.png')
print('Rendered WebGuide brand icons: 16,32,48,128')
