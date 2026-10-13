#!/usr/bin/env python3
# Andora 3D — injeta three.min.js, cenas da cutscene (JPEG b64) e game.js no template.
import base64, io, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D3 = os.path.join(ROOT, 'demo3d')

ASSETS = {
    'f1': os.path.join(ROOT, 'arte/cutscene/a1-estrada.png'),
    'f2': os.path.join(ROOT, 'arte/cutscene/a2-ponte.png'),
    'f3': os.path.join(ROOT, 'arte/cutscene/a3-vila.png'),
    'f4': os.path.join(ROOT, 'arte/cutscene/a4-lago.png'),
}


def jpg_b64(path, maxw=1220):
    im = Image.open(path).convert('RGB')
    if im.width > maxw:
        im = im.resize((maxw, int(im.height * maxw / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=82, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


def main():
    tpl = open(os.path.join(D3, 'template.html')).read()
    three = open(os.path.join(D3, 'three.min.js')).read()
    game = open(os.path.join(D3, 'game.js')).read()
    parts = []
    for k, p in ASSETS.items():
        if not os.path.exists(p):
            print('AVISO: asset ausente', p)
            continue
        parts.append("%s:'%s'" % (k, jpg_b64(p)))
    assets_js = 'const ASSETS={' + ','.join(parts) + '};'
    out = tpl.replace('@@THREE@@', three).replace('@@ASSETS@@', assets_js).replace('@@GAME@@', game)
    dest = os.path.join(D3, 'andora3d.html')
    open(dest, 'w').write(out)
    print('OK -> %s (%d KB, %d assets)' % (dest, len(out) // 1024, len(parts)))
    wa = os.path.join(ROOT, 'webapp')
    os.makedirs(wa, exist_ok=True)
    open(os.path.join(wa, 'index.html'), 'w').write(out)
    # ícones PWA
    ic = os.path.join(ROOT, 'arte/icone-andora.png')
    if os.path.exists(ic):
        im = Image.open(ic).convert('RGBA')
        s = min(im.size)
        im = im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width + s) // 2, (im.height + s) // 2))
        for sz in (192, 512):
            im.resize((sz, sz), Image.LANCZOS).save(os.path.join(wa, 'icon-%d.png' % sz))
    print('OK -> webapp/ (index.html + icones)')


if __name__ == '__main__':
    main()
