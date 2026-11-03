#!/usr/bin/env python3
"""optimizar_assets.py — Aligera las imágenes y las tipografías de un evento SIN cambiar su aspecto.

Uso:      python optimizar_assets.py [carpeta_del_evento]        (por defecto ./ignacioysuly)
Requiere: pip install pillow numpy fonttools brotli beautifulsoup4 lxml

Qué hace (todo medido: si una conversión no supera el umbral de fidelidad, se deja el archivo como estaba):
  1. PNG opacos (papel, fotos, fondos)        → JPG progresivo 4:4:4 (la menor calidad con SSIM ≥ 0.98).
  2. JPG pesados                               → se re-comprimen solo si ahorran ≥ 20 % con SSIM ≥ 0.985 (si no, se dejan igual).
  3. PNG con transparencia
       · de línea (iconos de un solo color)    → PNG de 256 colores EXACTO (sin pérdida).
       · con textura (papel, sello, sobre)     → WebP de alta calidad (q 95, transparencia sin pérdida). Umbral: PSNR ≥ 44 dB y ≥ 3× más liviano.
  4. Imágenes más grandes de lo que se llega a ver (calculado con el ancho de Canva, el ancho máximo y pantallas 3×) → se reducen a esa escala.
  5. Tipografías (.woff/.woff2 de Canva)       → woff2 con solo las letras latinas (es/en); suelen bajar de ~280 KB a ~25 KB.
  6. Reescribe las referencias en invitacion.html / index.html, y escribe en index.html los @font-face y los
     <link rel="preload"> de las tipografías de la portada (entre los marcadores @@FUENTES-PORTADA@@).
Se puede ejecutar varias veces: lo ya optimizado se deja igual. Copia de seguridad en <carpeta>/../<evento>_originales/ (omitir con --sin-respaldo).
"""
import argparse, io, os, re, shutil, sys
import numpy as np
from PIL import Image

PSNR_WEBP, RATIO_WEBP, Q_WEBP, PSNR_JPG_PAPEL = 44.0, 3.0, 95, 42.0
SSIM_PNG_A_JPG, SSIM_JPG, AHORRO_JPG = .98, .985, .20          # fidelidad mínima (SSIM 1 = idéntica) y ahorro mínimo al re-comprimir un JPG
ESCALERA_JPG = (80, 84, 88, 90, 92)                              # calidades que se prueban, de menor a mayor, hasta cumplir la fidelidad
RANGO_LETRAS = ('U+0020-007E,U+00A0-024F,U+2010-2015,U+2018-201E,U+2020-2022,U+2026,U+2030,U+2039-203A,'
                'U+20AC,U+2122,U+2190-2193,U+2212,U+25CF')
FUENTES_PORTADA = [('YAFdJhX-538_0', ['400']), ('YAFdJi-0PQg_0', ['400', '500'])]       # familias y pesos que usa la portada (index.html)


def kb(n): return '%6.0f KB' % (n / 1024)


def sobre_fondo(im, bg):
    im = im.convert('RGBA'); b = Image.new('RGBA', im.size, bg); b.alpha_composite(im); return np.asarray(b.convert('RGB')).astype(np.float32)


def psnr(orig, cand):
    """PSNR mínimo de la imagen compuesta sobre blanco y sobre gris oscuro (así también se juzgan los bordes semitransparentes)."""
    if orig.size != cand.size: cand = cand.resize(orig.size, Image.LANCZOS)
    v = []
    for bg in ((255, 255, 255, 255), (60, 60, 60, 255)):
        a, b = sobre_fondo(orig, bg), sobre_fondo(cand, bg); m = float(((a - b) ** 2).mean())
        v.append(99.0 if m == 0 else 10 * np.log10(255 ** 2 / m))
    return min(v)


def bytes_png(im, **kw):
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True, compress_level=9, **kw); return b.getvalue()


def bytes_jpg(im, q, **kw):
    b = io.BytesIO(); im.convert('RGB').save(b, 'JPEG', quality=q, optimize=True, progressive=True, subsampling=0, **kw); return b.getvalue()


def ssim(a, b):
    """Similitud estructural (SSIM) en luminosidad: 1 = idéntica; ≥ 0.98 no se distingue a simple vista."""
    from scipy.ndimage import uniform_filter
    a = np.asarray(a.convert('L')).astype(np.float64); b = np.asarray(b.convert('L')).astype(np.float64)
    C1, C2, w = (0.01 * 255) ** 2, (0.03 * 255) ** 2, 7
    ma, mb = uniform_filter(a, w), uniform_filter(b, w)
    saa, sbb, sab = uniform_filter(a * a, w) - ma ** 2, uniform_filter(b * b, w) - mb ** 2, uniform_filter(a * b, w) - ma * mb
    return float((((2 * ma * mb + C1) * (2 * sab + C2)) / ((ma ** 2 + mb ** 2 + C1) * (saa + sbb + C2))).mean())


def mejor_jpg(ref, minimo, psnr_ok=None):
    """El JPG más liviano de la escalera que cumpla la fidelidad → (bytes, calidad, nota) o None.
    Fidelidad = SSIM ≥ mínimo (estructura: fotos y texturas con relieve)  o  PSNR ≥ psnr_ok (papeles de grano muy sutil, donde el SSIM se
    penaliza por el ruido de baja amplitud aunque a simple vista sea idéntico)."""
    for q in ESCALERA_JPG:
        b = bytes_jpg(ref, q); d = Image.open(io.BytesIO(b)); ss = ssim(ref, d)
        if ss >= minimo: return b, q, 'SSIM %.3f' % ss
        if psnr_ok:
            ps = psnr(ref, d)
            if ps >= psnr_ok: return b, q, 'PSNR %.1f dB' % ps
    return None


def bytes_webp(im, q):
    b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6, alpha_quality=100); return b.getvalue()


def paleta_exacta(im):
    """PNG de 256 colores sin pérdida si la imagen RGBA tiene ≤ 256 combinaciones (rgb, alfa) distintas; si no, None."""
    a = np.asarray(im.convert('RGBA')); flat = a.reshape(-1, 4)
    flat = np.where(flat[:, 3:4] == 0, 0, flat)                                      # el color de lo totalmente transparente no importa
    u, inv = np.unique(flat.view(np.uint32).ravel(), return_inverse=True)
    if len(u) > 256: return None
    pal = u.view(np.uint8).reshape(-1, 4)
    p = Image.fromarray(inv.reshape(a.shape[:2]).astype(np.uint8), 'P')
    p.putpalette(pal[:, :3].ravel().tolist()); p.info['transparency'] = bytes(pal[:, 3].tolist())
    return bytes_png(p, transparency=bytes(pal[:, 3].tolist()))


def tiene_alfa(im):
    if im.mode == 'P' and 'transparency' in im.info: im = im.convert('RGBA')
    if im.mode not in ('RGBA', 'LA'): return False
    a = np.asarray(im.getchannel('A')); return (a < 250).mean() > 0.0005


def colores_rgb(im, bits=3):
    """Cantidad de colores distintos (con `bits` bits menos por canal) en la parte visible: pocos = arte plano / iconos de línea; muchos = fotos y texturas."""
    a = np.asarray(im.convert('RGBA')).reshape(-1, 4); a = a[a[:, 3] > 8][:, :3]
    if len(a) > 600000: a = a[::max(1, len(a) // 600000)]
    if not len(a): return 0
    a = (a >> bits).astype(np.uint32); return len(np.unique((a[:, 0] << 16) | (a[:, 1] << 8) | a[:, 2]))


def anchos_necesarios(carpeta, ancho_canva, ancho_max, dpr):
    """Ancho (px de pantalla) que como máximo llega a verse cada imagen de invitacion.html (px de Canva × escala máxima × densidad de pantalla)."""
    r = {}; ruta = os.path.join(carpeta, 'invitacion.html')
    if not os.path.exists(ruta): return r
    from bs4 import BeautifulSoup
    d = BeautifulSoup(open(ruta, encoding='utf8').read(), 'lxml'); k = ancho_max / ancho_canva * dpr
    for im in d.find_all('img'):
        m = re.search(r'assets/([\w.\-]+)$', im.get('src', ''))
        if not m: continue
        w = None
        for p in im.parents:
            st = p.get('style', '') if hasattr(p, 'get') else ''
            mm = re.search(r'(?<![\w-])width:\s*([\d.]+)px', st); mh = re.search(r'(?<![\w-])height:\s*([\d.]+)px', st)
            if mm and mh: w = float(mm.group(1)); break
        if w: r[m.group(1)] = max(r.get(m.group(1), 0), w * k)
    return r


def optimizar_imagen(ruta, nec, informe):
    nombre = os.path.basename(ruta); ext = os.path.splitext(nombre)[1].lower(); orig_bytes = os.path.getsize(ruta)
    if ext == '.webp': informe.append((nombre, nombre, orig_bytes, orig_bytes, 'ya es WebP')); return None
    im0 = Image.open(ruta); im0.load()
    alfa = tiene_alfa(im0); im = im0.convert('RGBA' if alfa else 'RGB')
    w0, h0 = im.size; reducida = False
    if nec and w0 > nec * 1.25:                                                         # más grande de lo que se llega a ver
        w1 = int(np.ceil(nec * 1.15 / 16) * 16); h1 = int(round(h0 * w1 / w0)); im_r = im.resize((w1, h1), Image.LANCZOS); reducida = True
    else: im_r = im
    ref = im_r if reducida else im                                                      # contra qué se mide la fidelidad
    stem = os.path.splitext(nombre)[0]; cand = []                                       # (bytes, extensión nueva, nota)
    nota_red = ' · %d→%d px' % (w0, im_r.size[0]) if reducida else ''
    if not alfa:
        pocos = colores_rgb(im_r, 0) < 400                                              # arte plano con pocos colores exactos: el JPG lo ensuciaría
        if ext == '.png' and not pocos:
            r = mejor_jpg(ref, SSIM_PNG_A_JPG, PSNR_JPG_PAPEL)
            if r: cand.append((r[0], '.jpg', 'JPG q%d · %s%s' % (r[1], r[2], nota_red)))
        elif ext in ('.jpg', '.jpeg'):
            r = mejor_jpg(ref, SSIM_JPG)
            if r and (len(r[0]) <= orig_bytes * (1 - AHORRO_JPG) or reducida): cand.append((r[0], ext, 'JPG q%d · %s%s' % (r[1], r[2], nota_red)))
        if ext == '.png' and (not cand):
            cand.append((bytes_png(im_r), '.png', 'PNG optimizado' + nota_red))
    else:
        if colores_rgb(im_r, 3) <= 8:                                                   # iconos de línea de un solo color
            b = paleta_exacta(im_r)
            if b: cand.append((b, '.png', 'PNG 256 colores sin pérdida' + nota_red))
            else:                                                                       # bordes con matices: paleta de 256 si queda igual
                q = im_r.quantize(colors=256, method=Image.FASTOCTREE); bq = bytes_png(q); ps = psnr(ref, Image.open(io.BytesIO(bq)))
                if ps >= PSNR_WEBP: cand.append((bq, '.png', 'PNG 256 colores · PSNR %.1f dB%s' % (ps, nota_red)))
        if not cand:
            b = bytes_webp(im_r, Q_WEBP); ps = psnr(ref, Image.open(io.BytesIO(b)))
            if ps >= PSNR_WEBP and len(b) * RATIO_WEBP <= orig_bytes: cand.append((b, '.webp', 'WebP q%d · PSNR %.1f dB%s' % (Q_WEBP, ps, nota_red)))
        if not cand or reducida:
            cand.append((bytes_png(im_r), '.png', 'PNG optimizado' + nota_red))
    if not cand: informe.append((nombre, nombre, orig_bytes, orig_bytes, 'sin cambios')); return None
    b, e, nota = min(cand, key=lambda c: len(c[0]))
    if len(b) >= orig_bytes * .97 and e == ext and not reducida: informe.append((nombre, nombre, orig_bytes, orig_bytes, 'sin cambios')); return None
    nuevo = stem + e; destino = os.path.join(os.path.dirname(ruta), nuevo)
    open(destino, 'wb').write(b)
    if destino != ruta: os.remove(ruta)
    informe.append((nombre, nuevo, orig_bytes, len(b), nota))
    return (nombre, nuevo) if nuevo != nombre else None


def subconjunto_fuente(ruta, informe):
    from fontTools import subset
    from fontTools.ttLib import TTFont
    nombre = os.path.basename(ruta); orig = os.path.getsize(ruta)
    f = TTFont(ruta); op = subset.Options(); op.layout_features = ['*']; op.name_IDs = [1, 2, 3, 4, 6]; op.notdef_outline = True
    op.glyph_names = False; op.hinting = False; op.desubroutinize = True; op.flavor = 'woff2'; op.drop_tables += ['DSIG']
    unis = []
    for r in RANGO_LETRAS.split(','):
        r = r.replace('U+', ''); a, _, b = r.partition('-'); unis += list(range(int(a, 16), int(b or a, 16) + 1))
    s = subset.Subsetter(op); s.populate(unicodes=unis); s.subset(f)
    f.flavor = 'woff2'
    nuevo = os.path.splitext(nombre)[0] + '.woff2'; destino = os.path.join(os.path.dirname(ruta), nuevo)
    f.save(destino + '.tmp'); tam = os.path.getsize(destino + '.tmp')
    if nombre.endswith('.woff2') and tam >= orig * .97: os.remove(destino + '.tmp'); informe.append((nombre, nombre, orig, orig, 'sin cambios')); return None
    os.replace(destino + '.tmp', destino)
    if destino != ruta: os.remove(ruta)
    informe.append((nombre, nuevo, orig, tam, 'letras latinas (es/en)'))
    return (nombre, nuevo) if nuevo != nombre else None


def reescribir(archivo, cambios, fuentes):
    if not os.path.exists(archivo): return 0
    s = open(archivo, encoding='utf8').read(); n = 0
    for a, b in cambios:
        t = s.replace('assets/' + a, 'assets/' + b); n += t != s; s = t
    for a, b in fuentes:                                                                  # woff → woff2: también el formato declarado
        s = re.sub(r'(url\(["\']?assets/' + re.escape(b) + r'["\']?\))\s*format\(["\']woff["\']\)', r'\1 format("woff2")', s)
    open(archivo, 'w', encoding='utf8').write(s); return n


def reparar_referencias(carpeta):
    """Si un HTML apunta a assets/X.png pero solo existe X.webp / X.jpg / X.woff2 (de una ejecución anterior), corrige la referencia."""
    assets = os.path.join(carpeta, 'assets'); n = 0
    existentes = {os.path.splitext(f)[0]: f for f in os.listdir(assets)}
    for nombre in ('invitacion.html', 'index.html'):   # rsvp.html no se toca: sus fondos aceptan .jpg y .png
        ruta = os.path.join(carpeta, nombre)
        if not os.path.exists(ruta): continue
        s = open(ruta, encoding='utf8').read()
        def cambia(m):
            nonlocal n
            f = m.group(1) + m.group(2)
            if os.path.exists(os.path.join(assets, f)): return m.group(0)
            alt = existentes.get(m.group(1))
            if alt and os.path.splitext(alt)[1].lower() in ('.webp', '.jpg', '.jpeg', '.png', '.woff2'): n += 1; return 'assets/' + alt
            return m.group(0)
        t = re.sub(r'assets/([\w\-]+)(\.(?:png|jpe?g|webp|woff2?))', cambia, s)
        t = re.sub(r'(url\(["\']?assets/[\w\-]+\.woff2["\']?\))\s*format\(["\']woff["\']\)', r'\1 format("woff2")', t)
        if t != s: open(ruta, 'w', encoding='utf8').write(t)
    return n


def bloque_portada(carpeta):
    """@font-face + preload de las tipografías de la portada, tomados del propio Canva (sus nombres de archivo cambian en cada exportación)."""
    ruta = os.path.join(carpeta, 'invitacion.html')
    if not os.path.exists(ruta): return None
    css = open(ruta, encoding='utf8').read(); reglas = {}; pre = []
    for m in re.finditer(r'@font-face\s*\{([^}]*)\}', css):
        t = m.group(1)
        fam = re.search(r'font-family:\s*["\']?([^;"\']+)', t); st = re.search(r'font-style:\s*(\w+)', t); wt = re.search(r'font-weight:\s*(\d+)', t); u = re.search(r'url\(["\']?(assets/[^"\')]+)', t)
        if fam and st and wt and u and st.group(1) == 'normal': reglas[(fam.group(1).strip(), wt.group(1))] = u.group(1)
    css_out, vistos = [], set()
    for fam, pesos in FUENTES_PORTADA:
        for p in pesos:
            u = reglas.get((fam, p))
            if not u: continue
            css_out.append('@font-face{font-family:"%s";font-weight:%s;font-style:normal;font-display:block;src:url(%s) format("woff2")}' % (fam, p, u))
            if u not in vistos: vistos.add(u); pre.append('<link rel="preload" as="font" type="font/woff2" href="%s" crossorigin>' % u)
    return pre, css_out


def escribir_bloque(carpeta, pre, css):
    ruta = os.path.join(carpeta, 'index.html'); s = open(ruta, encoding='utf8').read()
    bloque = ('<!-- @@FUENTES-PORTADA@@ (lo escribe optimizar_assets.py) -->\n' + '\n'.join(pre) +
              '\n<style id="fuentes-portada">\n' + '\n'.join(css) + '\n</style>\n<!-- @@/FUENTES-PORTADA@@ -->')
    n = re.subn(r'<!-- @@FUENTES-PORTADA@@.*?@@/FUENTES-PORTADA@@ -->', lambda m: bloque, s, flags=re.S)
    if n[1]: open(ruta, 'w', encoding='utf8').write(n[0]); return True
    return False


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('carpeta', nargs='?', default='ignacioysuly'); ap.add_argument('--sin-respaldo', action='store_true')
    ap.add_argument('--ancho-canva', type=float, default=None); ap.add_argument('--ancho-maximo', type=float, default=None); ap.add_argument('--dpr', type=float, default=3)
    a = ap.parse_args(); carpeta = a.carpeta.rstrip('/\\'); assets = os.path.join(carpeta, 'assets')
    if not os.path.isdir(assets): sys.exit('No existe %s' % assets)
    idx = open(os.path.join(carpeta, 'index.html'), encoding='utf8').read() if os.path.exists(os.path.join(carpeta, 'index.html')) else ''
    ac = a.ancho_canva or float((re.search(r'anchoCanva:\s*([\d.]+)', idx) or [0, 465])[1]); am = a.ancho_maximo or float((re.search(r'anchoMaximo:\s*([\d.]+)', idx) or [0, 700])[1])
    if not a.sin_respaldo:
        resp = carpeta + '_originales'
        if not os.path.exists(resp): shutil.copytree(carpeta, resp); print('Copia de seguridad en', resp)
    nec = anchos_necesarios(carpeta, ac, am, a.dpr); informe, imgs, fonts = [], [], []
    for f in sorted(os.listdir(assets)):
        ruta = os.path.join(assets, f); e = os.path.splitext(f)[1].lower()
        if f.startswith('rsvp_logo') or f.startswith('logo_portada'): continue            # logos propios del evento: se respetan
        if e in ('.png', '.jpg', '.jpeg', '.webp'):
            c = optimizar_imagen(ruta, nec.get(f), informe)
            if c: imgs.append(c)
        elif e in ('.woff', '.woff2'):
            c = subconjunto_fuente(ruta, informe)
            if c: fonts.append(c)
    ref = sum(reescribir(os.path.join(carpeta, x), imgs + fonts, fonts) for x in ('invitacion.html', 'index.html'))   # rsvp.html no se toca: sus fondos aceptan .jpg y .png
    ref += reparar_referencias(carpeta)
    b = bloque_portada(carpeta); bl = escribir_bloque(carpeta, *b) if b else False
    print('\n%-44s %-44s %10s %10s  %s' % ('archivo', 'resultado', 'antes', 'después', 'detalle'))
    for o, n, x, y, nota in sorted(informe, key=lambda r: -(r[2] - r[3])):
        print('%-44s %-44s %s %s  %s' % (o[:44], n[:44] if n != o else '=', kb(x), kb(y), nota))
    t0, t1 = sum(r[2] for r in informe), sum(r[3] for r in informe)
    print('\nTOTAL %s → %s  (−%.0f %%) · %d referencia(s) corregida(s) · bloque de tipografías de la portada: %s'
          % (kb(t0).strip(), kb(t1).strip(), 100 * (1 - t1 / max(1, t0)), ref, 'actualizado' if bl else 'no encontrado en index.html'))


if __name__ == '__main__':
    main()
