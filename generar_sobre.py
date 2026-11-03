#!/usr/bin/env python3
"""generar_sobre.py · v2 — Dibuja las piezas PNG del sobre de index.html (portada sin video).

Uso:   pip install numpy pillow scipy   ·   python generar_sobre.py            →  ./salida/*.png
Copia las PNG a /<evento>/assets/.

Piezas (RGBA, 1200 px de ancho = 800 u de diseño × 1.5, nítidas hasta pantallas de 3×):
  sobre_fondo.png      interior del sobre (detrás de la tarjeta)
  sobre_adelante.png   frente: dos solapas laterales + solapa inferior, con la muesca en V (y la sombra que proyecta sobre la tarjeta)
  solapa_frontal.png   solapa cerrada (cara exterior). Se guarda volteada (▲) porque el CSS la gira 180° al cerrarla
  solapa_reverso.png   solapa abierta (cara interior)
  tarjeta.png          tarjeta de papel de algodón con doble marco en relieve (línea gráfica de la invitación)
  sello.png            sello de lacre (se recorta del archivo de Canva)
  logo_portada_hd.png  título de la portada con fondo transparente (de logo_portada.png, ×4, con el «&» de Canva más firme)

Modelo de luz: viene de arriba a la izquierda. Cada pieza = color base (degradados) × relieve del papel (ruido → normales) + biselado de
los bordes (transformada de distancia) + destellos nacarados. Para otro color de papel cambia PALETA; para otra forma, la geometría de abajo.
Geometría (unidades de un lienzo de 800 de ancho): cuerpo 800×556 (aspecto 1.44) · capa 800×923 (166 %: arriba queda sitio para la
solapa abierta y la tarjeta) · solapa = 73 % del cuerpo, con punta redondeada (como un sobre «euro flap»).
"""
import math, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, distance_transform_edt

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(AQUI, 'salida'); os.makedirs(SALIDA, exist_ok=True)
ASSETS_ORIGEN = os.environ.get('ASSETS', os.path.join(AQUI, 'ignacioysuly', 'assets'))

# ------------------------------------------------------------------ geometría (unidades de diseño)
S = 1.5                                  # px por unidad
W, HB, HL, TOP = 800, 556, 923, 367      # ancho, cuerpo, capa, y del borde superior del cuerpo
FH = 406                                 # alto visible de la solapa (73 % del cuerpo)
TIP = 432                                # vértice (sin redondear) de la punta de la solapa
KFLARE = 42                              # donde el borde diagonal de la solapa deja el borde lateral
NOTCH = 0.44; APEX = 36                  # profundidad de la muesca del frente y media anchura de su vértice plano
CARD_W, CARD_H = 1100, 846               # px de la tarjeta (aspecto 1.30)
SS = 3                                   # supermuestreo para los bordes

# ------------------------------------------------------------------ paleta (RGB 0-255), tomada de assets/288633…png
PALETA = {
    'solapa_c':  (238, 235, 224), 'solapa_m': (229, 224, 209), 'solapa_p': (219, 213, 197),   # solapa exterior: esquina sup-izq · centro · punta
    'izq_a': (232, 227, 212), 'izq_b': (224, 218, 202),                                        # panel lateral izquierdo (alto → bajo)
    'der_a': (223, 217, 201), 'der_b': (211, 205, 189),                                        # panel lateral derecho
    'inf_a': (225, 219, 203), 'inf_b': (215, 209, 193),                                        # panel inferior
    'int_a': (203, 196, 179), 'int_b': (218, 212, 197),                                        # interior (fondo): arriba (sombra) → abajo
    'rev_a': (207, 200, 184), 'rev_b': (225, 220, 206),                                        # solapa abierta: bisagra → punta
    'tarjeta': (247, 246, 244),
}
LUZ = np.array([-0.62, -0.78])           # hacia dónde está la luz (arriba-izquierda), en (x, y)
rng = np.random.default_rng(20261103)


# ------------------------------------------------------------------ utilidades
def rounded_poly(pts, radios, n=28):
    """Polígono con esquinas redondeadas (Bézier cuadrática): el radio es la distancia sobre cada arista donde empieza la curva."""
    N = len(pts); out = []
    for i in range(N):
        p0, p1, p2 = np.array(pts[i - 1], float), np.array(pts[i], float), np.array(pts[(i + 1) % N], float)
        v1, v2 = p0 - p1, p2 - p1
        l1, l2 = np.linalg.norm(v1), np.linalg.norm(v2)
        r = min(radios[i] if radios[i] is not None else 0, l1 * .48, l2 * .48)
        if r <= 0.01: out.append(tuple(p1)); continue
        a, b = p1 + v1 / l1 * r, p1 + v2 / l2 * r
        for t in np.linspace(0, 1, n):
            out.append(tuple((1 - t) ** 2 * a + 2 * (1 - t) * t * p1 + t ** 2 * b))
    return out


def mascara(poligonos, w, h, escala=S, ss=SS):
    """Máscara 0..1 (float32) de uno o varios polígonos en unidades de diseño, con borde suavizado por supermuestreo."""
    img = Image.new('L', (w * ss, h * ss), 0); d = ImageDraw.Draw(img)
    for p in (poligonos if isinstance(poligonos[0][0], (tuple, list)) else [poligonos]):
        d.polygon([(x * escala * ss, y * escala * ss) for x, y in p], fill=255)
    return np.asarray(img.resize((w, h), Image.LANCZOS), np.float32) / 255.0


def lineas(segmentos, w, h, grosor, escala=S, ss=SS):
    img = Image.new('L', (w * ss, h * ss), 0); d = ImageDraw.Draw(img)
    for seg in segmentos:
        d.line([(x * escala * ss, y * escala * ss) for x, y in seg], fill=255, width=max(1, int(round(grosor * ss))), joint='curve')
    return np.asarray(img.resize((w, h), Image.LANCZOS), np.float32) / 255.0


def normal(a):
    a = a - a.mean(); s = a.std(); return a / (s if s > 1e-9 else 1)


def papel(h, w, semilla=None, fino=.5, medio=.8, grueso=.3):
    """Altura del papel: grano fino + fibras medianas + ondulación suave (en px). Devuelve (altura, grueso)."""
    r = np.random.default_rng(semilla) if semilla is not None else rng
    f = normal(gaussian_filter(r.normal(size=(h, w)).astype(np.float32), .75))
    m = normal(gaussian_filter(r.normal(size=(h, w)).astype(np.float32), 2.6))
    g = normal(gaussian_filter(r.normal(size=(h, w)).astype(np.float32), 16))
    return fino * f + medio * m + grueso * g, g


def sombreado(altura, k=.05, suave=.9):
    """Luminosidad por relieve: las pendientes que miran a la luz se aclaran y las opuestas se oscurecen."""
    hs = gaussian_filter(altura, suave); gy, gx = np.gradient(hs)
    return k * (-(gx * LUZ[0] + gy * LUZ[1]))


def biselado(mask, ancho_px, k=.22):
    """Borde biselado: sombreado de una altura que crece desde el borde hacia adentro (luz arriba-izquierda)."""
    d = distance_transform_edt(mask > .5).astype(np.float32)
    hgt = np.minimum(d, ancho_px) / ancho_px
    hgt = gaussian_filter(hgt, .7)
    gy, gx = np.gradient(hgt)
    return k * (-(gx * LUZ[0] + gy * LUZ[1])) * ancho_px


def destellos(h, w, densidad=.0009, fuerza=1.0, semilla=None):
    """Destellos nacarados dispersos (puntos muy pequeños y claros)."""
    r = np.random.default_rng(semilla) if semilla is not None else rng
    p = (r.random((h, w)) < densidad).astype(np.float32) * r.random((h, w)).astype(np.float32)
    return gaussian_filter(p, .65) * fuerza * 9


def grad(h, w, p0, p1, c0, c1, curva=1.0):
    """Degradado lineal de c0 en p0 a c1 en p1 (puntos en unidades de diseño)."""
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    x, y = xs / S, ys / S
    d = np.array(p1, float) - np.array(p0, float)
    t = ((x - p0[0]) * d[0] + (y - p0[1]) * d[1]) / (d @ d)
    t = np.clip(t, 0, 1) ** curva
    return np.array(c0, np.float32)[None, None, :] * (1 - t)[..., None] + np.array(c1, np.float32)[None, None, :] * t[..., None]


def viñeta(h, w, fuerza=.05, cx=.5, cy=.5, r=.75):
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((xs / w - cx) / r) ** 2 + ((ys / h - cy) / r) ** 2)
    return -fuerza * np.clip(d, 0, 1.4) ** 2.2


def guardar(rgb, alfa, nombre):
    """rgb: 0-255 (h,w,3) con la luminosidad ya aplicada; alfa 0..1. PNG RGBA (alfa recta; el color fuera del dibujo = el del borde)."""
    a8 = np.clip(alfa * 255 + .5, 0, 255).astype(np.uint8)
    c8 = np.clip(rgb + .5, 0, 255).astype(np.uint8)
    Image.fromarray(np.dstack([c8, a8]), 'RGBA').save(os.path.join(SALIDA, nombre), optimize=True, compress_level=9)
    print('→', nombre, '%d×%d' % (c8.shape[1], c8.shape[0]), '%d KB' % (os.path.getsize(os.path.join(SALIDA, nombre)) // 1024))


def aplicar(color, lum):
    """Multiplica el color base por (1 + lum)."""
    return color * (1 + lum)[..., None]


# ------------------------------------------------------------------ geometría de las piezas
def contorno_solapa(abajo=True):
    """Solapa tipo «euro flap»: bordes laterales que se curvan al nacer y punta muy redondeada.
    abajo=True: bisagra arriba y punta abajo (▼). abajo=False: se voltea (▲)."""
    pts = [(0, 0), (W, 0), (W, KFLARE), (W / 2, TIP), (0, KFLARE)]
    p = rounded_poly(pts, [0, 0, 62, 88, 62])
    return p if abajo else [(x, FH - y) for x, y in p]


def contorno_frente():
    cx, nt = W / 2, TOP + NOTCH * HB
    return [(0, TOP), (cx - APEX, nt), (cx + APEX, nt), (W, TOP), (W, HL), (0, HL)], nt, cx


# ------------------------------------------------------------------ 1) interior del sobre
def fondo():
    h, w = int(round(HL * S)), int(W * S)
    cuerpo = [(0, TOP), (W, TOP), (W, HL), (0, HL)]
    m = mascara(rounded_poly(cuerpo, [3, 3, 0, 0]), w, h)
    col = grad(h, w, (0, TOP), (0, HL), PALETA['int_a'], PALETA['int_b'], .75)
    alt, gr = papel(h, w, 1, .5, .5, .2)
    ys = (np.arange(h, dtype=np.float32) / S)[:, None]
    xs = (np.arange(w, dtype=np.float32) / S)[None, :]
    lum = sombreado(alt, .010) + .003 * gr + viñeta(h, w, .06)
    lum -= .07 * np.exp(-np.clip(ys - TOP, 0, None) / 60.)            # sombra de la solapa en la bisagra
    lum -= .05 * (np.exp(-xs / 45.) + np.exp(-(W - xs) / 45.))         # lados en penumbra
    lum += biselado(m, 3.0, .06)
    rgb = aplicar(col, lum)
    # justo en el borde superior el interior se funde con el color de la solapa cerrada: así no asoma una línea oscura al cerrar (el borde de la solapa queda a medio píxel)
    t = np.exp(-np.clip(ys - TOP, 0, None) / 3.5)[..., None]
    rgb = rgb * (1 - t) + np.array(PALETA['solapa_c'], np.float32)[None, None, :] * .975 * t
    guardar(rgb, m, 'sobre_fondo.png')


# ------------------------------------------------------------------ 2) frente (3 paneles) con la muesca en V
def frente():
    h, w = int(round(HL * S)), int(W * S)
    sil, nt, cx = contorno_frente()
    m_sil = mascara(rounded_poly(sil, [2, 70, 70, 2, 0, 0]), w, h)
    izq = [(0, TOP), (cx - APEX, nt), (0, HL)]; der = [(W, TOP), (cx + APEX, nt), (W, HL)]
    inf = [(0, HL), (cx - APEX, nt), (cx + APEX, nt), (W, HL)]
    mi, md, mb = (mascara(p, w, h) for p in (izq, der, inf))
    P = PALETA
    c_i = grad(h, w, (0, TOP), (160, HL), P['izq_a'], P['izq_b'], 1)
    c_d = grad(h, w, (W, TOP), (W, HL), P['der_a'], P['der_b'], 1)
    c_b = grad(h, w, (cx, nt), (cx, HL), P['inf_a'], P['inf_b'], .8)
    col = c_i * mi[..., None] + c_d * md[..., None]
    col = col * (1 - mb[..., None]) + c_b * mb[..., None]
    cob = (mi + md) * (1 - mb) + mb
    col = col / np.maximum(cob[..., None], 1e-3)
    col = np.where((cob < .5)[..., None], c_b, col)          # el redondeo del vértice de la muesca añade un poco de material: se rellena con el color de la solapa inferior
    alt, gr = papel(h, w, 2, .5, .75, .25)
    lum = sombreado(alt, .016) + .004 * gr + viñeta(h, w, .035, .5, .55)

    # costuras: la solapa inferior se monta sobre las laterales
    ap, ci = cx - APEX, cx + APEX
    seg_i = [[(ap, nt), (0, HL)]]; seg_d = [[(ci, nt), (W, HL)]]
    luz_i = gaussian_filter(lineas(seg_i, w, h, 2.2), 1.2) * 1.0        # filo iluminado (mira a la luz)
    som_d = gaussian_filter(mascara(rounded_poly(inf, [0, 40, 40, 0]), w, h) , 1)                     # sombra que la inferior proyecta a la derecha
    desp = int(7 * S)
    som_d = np.roll(np.roll(som_d, desp, axis=1), int(5 * S), axis=0)
    som_d = gaussian_filter(som_d, 6 * S / 1.5)
    lum += .075 * luz_i * (mi + mb)
    lum -= .12 * som_d * md * (1 - mb)
    lum -= .12 * gaussian_filter(lineas(seg_d, w, h, 1.6), 1.1)          # pliegue de la derecha (tenue)
    lum -= .035 * gaussian_filter(lineas(seg_i, w, h, 3), 3) * mi

    lum += biselado(m_sil, 2.6, .07)
    rgb = aplicar(col, lum) + destellos(h, w, .0008, .35, 4)[..., None]

    # sombra que el frente proyecta sobre la tarjeta (solo dentro de la muesca)
    notch = mascara([(0, TOP), (W, TOP), (W, nt + 2), (0, nt + 2)], w, h)
    sh = np.roll(m_sil, -int(7 * S), axis=0); sh = gaussian_filter(sh, 9 * S / 1.5)
    amb = gaussian_filter(m_sil, 26 * S / 1.5)
    sa = np.clip((.26 * sh + .13 * amb), 0, .5) * (1 - m_sil) * notch
    alfa = m_sil + (1 - m_sil) * sa
    sc = np.array([42, 33, 22], np.float32)
    rgb = (rgb * m_sil[..., None] + sc[None, None, :] * (sa[..., None] * (1 - m_sil[..., None]))) / np.maximum(alfa[..., None], 1e-4)
    guardar(rgb, alfa, 'sobre_adelante.png')


# ------------------------------------------------------------------ 3) solapa cerrada (exterior)
def solapa_frontal():
    h, w = int(round(FH * S)) + 2, int(W * S)
    m = mascara(contorno_solapa(True), w, h)
    P = PALETA
    col = grad(h, w, (40, 0), (W * .62, FH * 1.0), P['solapa_c'], P['solapa_p'], .85)
    col = col * .55 + grad(h, w, (0, 0), (W, 0), P['solapa_c'], P['solapa_m'], 1) * .45
    alt, gr = papel(h, w, 3, .5, .7, .2)
    ys = (np.arange(h, dtype=np.float32) / S)[:, None]; xs = (np.arange(w, dtype=np.float32) / S)[None, :]
    lum = sombreado(alt, .014) + .003 * gr
    lum += .035 * np.exp(-((xs - 150) ** 2 + (ys - 40) ** 2) / (2 * 150. ** 2))         # brillo nacarado arriba a la izquierda
    lum -= .03 * np.clip((xs - W / 2) / (W / 2), 0, 1)                                    # el lado derecho recibe menos luz
    lum -= .03 * np.exp(-ys / 14.)                                                         # leve oscurecimiento junto a la bisagra
    lum += biselado(m, 2.6, .07)
    rgb = aplicar(col, lum) + destellos(h, w, .0008, .4, 5)[..., None]
    guardar(np.flipud(rgb), np.flipud(m), 'solapa_frontal.png')            # ▲ en disco; el CSS la gira 180°


# ------------------------------------------------------------------ 4) solapa abierta (interior)
def solapa_reverso():
    h, w = int(round(FH * S)) + 2, int(W * S)
    m = mascara(contorno_solapa(False), w, h)
    P = PALETA
    col = grad(h, w, (W / 2, FH), (W / 2, 0), P['rev_a'], P['rev_b'], .8)
    alt, gr = papel(h, w, 6, .5, .6, .2)
    ys = (np.arange(h, dtype=np.float32) / S)[:, None]; xs = (np.arange(w, dtype=np.float32) / S)[None, :]
    lum = sombreado(alt, .011) + .003 * gr + viñeta(h, w, .04, .5, .6)
    lum -= .08 * np.exp(-(FH - ys) / 22.)                                                  # pliegue de la bisagra
    lum += .03 * np.exp(-((xs - 170) ** 2 + (ys - 150) ** 2) / (2 * 150. ** 2))
    lum += biselado(m, 2.6, .06)
    guardar(aplicar(col, lum), m, 'solapa_reverso.png')


# ------------------------------------------------------------------ 5) tarjeta: papel de algodón con doble marco en relieve
def tarjeta():
    w, h = CARD_W, CARD_H
    r = 8
    m = mascara([(0, 0), (w / S, 0), (w / S, h / S), (0, h / S)], w, h)            # se redondea abajo con la distancia
    d_borde = distance_transform_edt(np.pad(np.ones((h, w), bool), 1)[1:-1, 1:-1])
    # esquinas con radio r (px)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx_, cy_ = np.clip(xx, r, w - 1 - r), np.clip(yy, r, h - 1 - r)
    dist = np.sqrt((xx - cx_) ** 2 + (yy - cy_) ** 2)
    m = np.clip(r + .5 - dist, 0, 1).astype(np.float32)
    # relieve: grano de papel de algodón + dos crestas (marco)
    alt, gr = papel(h, w, 9, .95, .7, 0.0)
    def marco(ins, ancho):
        img = Image.new('L', (w * 3, h * 3), 0); dr = ImageDraw.Draw(img)
        dr.rounded_rectangle([ins * 3, ins * 3, (w - ins) * 3, (h - ins) * 3], radius=int(10 * 3), outline=255, width=int(ancho * 3))
        return np.asarray(img.resize((w, h), Image.LANCZOS), np.float32) / 255.0
    ins1, ins2 = round(w * .045), round(w * .045) + 14
    cresta = gaussian_filter(marco(ins1, 5.0), 2.3) * 1.0 + gaussian_filter(marco(ins2, 3.2), 1.7) * .8
    relieve = alt * .8 + cresta * 30.0
    lum = sombreado(relieve, .0105, .9)
    lum += biselado(m, 3.4, .10)
    lum += viñeta(h, w, .012)
    col = np.broadcast_to(np.array(PALETA['tarjeta'], np.float32), (h, w, 3)).copy()
    col[..., 2] *= 1 + .004 * (yy / h)              # un velo apenas cálido hacia abajo
    guardar(aplicar(col, lum), m, 'tarjeta.png')


# ------------------------------------------------------------------ 6) sello (recorte del archivo de Canva)
def sello():
    ruta = os.path.join(ASSETS_ORIGEN, 'd33579f29fec6e71449e068ea46dccdc.png')
    if not os.path.exists(ruta): print('· sello: no encuentro', ruta); return
    im = Image.open(ruta).convert('RGBA'); im = im.crop(im.getbbox())
    im.save(os.path.join(SALIDA, 'sello.png'), optimize=True)
    print('→ sello.png', im.size)


# ------------------------------------------------------------------ 7) título de la portada (fondo transparente, ×4)
def logo_portada():
    """Título de la portada: logo_portada.png (tinta oscura sobre papel liso) → PNG transparente ×4.
    El «&» de logo_portada.png es un hilo de 1 px y se ve delgado: se sustituye por el «&» de Canva (3afb33b5….png, 762×800), mucho más nítido,
    ajustado a la misma caja y con un poco más de cuerpo (PESO_AMP px del lienzo ×4; 0 = sin engrosar)."""
    from scipy.ndimage import grey_dilation
    PESO_AMP = 1.2
    ruta = os.path.join(ASSETS_ORIGEN, 'logo_portada.png'); ruta_amp = os.path.join(ASSETS_ORIGEN, '3afb33b5eb64a7670cc883856da38425.png')
    if not os.path.exists(ruta): print('· logo: no encuentro', ruta); return
    K = 4
    im = np.asarray(Image.open(ruta).convert('RGB'), np.float32); bg = im[0, 0]                  # color del papel de Canva (255,251,244)
    a = np.clip(np.clip(1 - (im / np.maximum(bg, 1)).mean(-1), 0, 1) * 1.04, 0, 1)               # tinta negra sobre ese papel → opacidad
    h, w = a.shape
    A = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((w * K, h * K), Image.LANCZOS), np.float32) / 255
    A = np.clip((A - .04) / .80, 0, 1); A = A * A * (3 - 2 * A)                                   # contraste suave: conserva los trazos finos
    if os.path.exists(ruta_amp):
        x0, x1 = 175, 218                                                                         # columnas del «&» en logo_portada.png (hueco entre IGNACIO y SULY)
        filas = np.where(a[:, x0:x1 + 1].max(1) > .15)[0]; filas = filas[filas > 45]; y0, y1 = filas.min(), filas.max()
        tx0, tx1, ty0, ty1 = x0 * K, (x1 + 1) * K, y0 * K, (y1 + 1) * K
        A[45 * K:, (x0 - 12) * K:(x1 + 12) * K] = 0                                               # borra el «&» original (solo la línea de los nombres)
        amp = np.asarray(Image.open(ruta_amp).convert('RGBA'), np.float32)[..., 3] / 255
        ys, xs = np.where(amp > .03); amp = amp[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        bw, bh = tx1 - tx0, ty1 - ty0; e = min(bw / amp.shape[1], bh / amp.shape[0])
        nw, nh = int(round(amp.shape[1] * e)), int(round(amp.shape[0] * e))
        ampr = np.asarray(Image.fromarray((amp * 255).astype(np.uint8)).resize((nw, nh), Image.LANCZOS), np.float32) / 255
        if PESO_AMP > 0:
            r = int(np.ceil(PESO_AMP)); yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
            ampr = gaussian_filter(grey_dilation(ampr, footprint=(xx ** 2 + yy ** 2) <= PESO_AMP ** 2 + .25), .75)
            ampr = np.clip((ampr - .08) / .80, 0, 1)
        px, py = tx0 + (bw - nw) // 2, ty0 + (bh - nh) // 2
        A[py:py + nh, px:px + nw] = np.maximum(A[py:py + nh, px:px + nw], ampr)
    rgb = np.broadcast_to(np.array([30, 27, 24], np.uint8), A.shape + (3,))
    Image.fromarray(np.dstack([rgb, (A * 255 + .5).astype(np.uint8)]), 'RGBA').save(os.path.join(SALIDA, 'logo_portada_hd.png'), optimize=True)
    print('→ logo_portada_hd.png', A.shape[::-1])


if __name__ == '__main__':
    quedan = sys.argv[1:] or ['fondo', 'frente', 'solapa_frontal', 'solapa_reverso', 'tarjeta', 'sello', 'logo_portada']
    for n in quedan: globals()[n]()
