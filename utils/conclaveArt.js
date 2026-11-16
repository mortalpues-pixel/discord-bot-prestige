'use strict';

/**
 * conclaveArt.js
 * Piezas gráficas del cónclave de admisión ("la bola negra") de la Familia Helmreich.
 * Todo se dibuja por código con node-canvas; sin emojis, sin degradados metálicos.
 *
 *   renderSummons({ candidateName, avatarUrl, seats })                      -> Promise<Buffer> 960x320
 *   renderBall(kind)                         kind = 'black' | 'white'        -> Promise<Buffer> 320x320 (transparente)
 *   renderVerdict({ candidateName, avatarUrl, white, black, seats, needed, apto, dateText }) -> Promise<Buffer> 960x540
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
if (process.platform === 'win32') {
    process.env.PANGOCAIRO_BACKEND = 'fc';
    const fcDir = path.join(os.tmpdir(), 'helmreich-fc');
    const fcCache = path.join(fcDir, 'cache');
    const fcConf = path.join(fcDir, 'fonts.conf');
    try {
        fs.mkdirSync(fcCache, { recursive: true });
        const toUnix = (p) => p.replace(/\\/g, '/');
        const xml = `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${toUnix(FONT_DIR)}</dir><dir>C:/Windows/Fonts</dir><cachedir>${toUnix(fcCache)}</cachedir></fontconfig>`;
        fs.writeFileSync(fcConf, xml);
        process.env.FONTCONFIG_FILE = fcConf;
    } catch (e) {
        console.warn('[conclaveArt] No se pudo preparar fontconfig en Windows:', e.message);
    }
}

const { createCanvas, loadImage, registerFont } = require('canvas');

/* ------------------------------------------------------------------ */
/* Paleta                                                              */
/* ------------------------------------------------------------------ */
const COL = {
    obsidian: '#0D0C0E',
    coal: '#17151A',
    gold: '#B89B5E',
    ivory: '#E9E2D0',
    burgundy: '#5E1A28',
    smoke: '#8A8580',
};

const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/* ------------------------------------------------------------------ */
/* Fuentes (empaquetadas en assets/fonts; licencia OFL)                */
/* ------------------------------------------------------------------ */
const FONT_FILES = [
    { file: 'CormorantSC-Regular.ttf', weight: '400' },
    { file: 'CormorantSC-Medium.ttf', weight: '500' },
    { file: 'CormorantSC-SemiBold.ttf', weight: '600' },
];
let FAMILY = 'serif';
let glyphSet = null; // Set de code points disponibles en la fuente (null = sin filtrar)

(function initFonts() {
    let registered = 0;
    for (const f of FONT_FILES) {
        try {
            const p = path.join(FONT_DIR, f.file);
            if (!fs.existsSync(p)) continue;
            registerFont(p, { family: 'Cormorant SC', weight: f.weight });
            registered++;
        } catch (e) {
            console.warn('[conclaveArt] No se pudo registrar la fuente', f.file, e.message);
        }
    }
    if (registered > 0) {
        FAMILY = '"Cormorant SC"';
        try {
            glyphSet = readCmap(path.join(FONT_DIR, 'CormorantSC-Medium.ttf'));
        } catch (e) {
            glyphSet = null;
        }
    }
})();

/** Lee la tabla cmap de un TTF (formatos 4 y 12) y devuelve un Set de code points. */
function readCmap(file) {
    const b = fs.readFileSync(file);
    const numTables = b.readUInt16BE(4);
    let cmapOff = -1;
    for (let i = 0; i < numTables; i++) {
        const o = 12 + i * 16;
        if (b.toString('ascii', o, o + 4) === 'cmap') cmapOff = b.readUInt32BE(o + 8);
    }
    if (cmapOff < 0) return null;
    const set = new Set();
    const nSub = b.readUInt16BE(cmapOff + 2);
    for (let i = 0; i < nSub; i++) {
        const off = cmapOff + b.readUInt32BE(cmapOff + 4 + i * 8 + 4);
        const fmt = b.readUInt16BE(off);
        if (fmt === 4) {
            const segCount = b.readUInt16BE(off + 6) / 2;
            const endO = off + 14;
            const startO = endO + segCount * 2 + 2;
            for (let k = 0; k < segCount; k++) {
                const end = b.readUInt16BE(endO + k * 2);
                const start = b.readUInt16BE(startO + k * 2);
                for (let c = start; c <= end && c < 0xffff; c++) set.add(c);
            }
        } else if (fmt === 12) {
            const nGroups = b.readUInt32BE(off + 12);
            for (let k = 0; k < nGroups; k++) {
                const start = b.readUInt32BE(off + 16 + k * 12);
                const end = b.readUInt32BE(off + 20 + k * 12);
                for (let c = start; c <= end; c++) set.add(c);
            }
        }
    }
    return set.size ? set : null;
}

const fontStack = (weight, size) => `${weight} ${size}px ${FAMILY === 'serif' ? 'serif' : FAMILY + ', serif'}`;

/* ------------------------------------------------------------------ */
/* Texto: normalización y medición                                     */
/* ------------------------------------------------------------------ */
function cleanText(input, fallback = '', maxChars = 90) {
    let s = String(input == null ? '' : input);
    try { s = s.normalize('NFKC'); } catch (e) { /* noop */ }
    s = s
        .replace(/\p{Extended_Pictographic}/gu, '')
        .replace(/\p{Regional_Indicator}/gu, '')
        .replace(/[\u{1F3FB}-\u{1F3FF}\u20E3\uFE0E\uFE0F\u200D]/gu, '')
        .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ')
        .replace(/\s+/g, ' ');
    if (glyphSet) {
        let out = '';
        for (const ch of s) {
            const cp = ch.codePointAt(0);
            if (cp === 32 || glyphSet.has(cp)) out += ch;
        }
        s = out;
    }
    s = s.replace(/\s+/g, ' ').trim();
    const chars = [...s];
    if (chars.length > maxChars) s = chars.slice(0, maxChars).join('').trim();
    return s || fallback;
}

const toInt = (v, d = 0) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : d;
};

function trackedWidth(ctx, text, sp) {
    return ctx.measureText(text).width + sp * Math.max(0, [...text].length - 1);
}

/** Dibuja texto con letter-spacing (canvas v3 no soporta ctx.letterSpacing). Devuelve el ancho. */
function drawTracked(ctx, text, x, y, sp = 0, align = 'left') {
    const total = trackedWidth(ctx, text, sp);
    const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    ctx.textAlign = 'left';
    if (!sp) {
        ctx.fillText(text, x0, y);
        return total;
    }
    let prefix = '';
    let i = 0;
    for (const ch of text) {
        const off = ctx.measureText(prefix).width + i * sp;
        ctx.fillText(ch, x0 + off, y);
        prefix += ch;
        i++;
    }
    return total;
}

/** Ajusta tamaño (y elipsis en último caso) para que el texto quepa en maxWidth. */
function fitText(ctx, text, weight, maxSize, minSize, maxWidth, spTrack) {
    let size = maxSize;
    const spFor = (s) => spTrack * (s / maxSize);
    for (; size >= minSize; size -= 1) {
        ctx.font = fontStack(weight, size);
        if (trackedWidth(ctx, text, spFor(size)) <= maxWidth) return { text, size, sp: spFor(size) };
    }
    size = minSize;
    ctx.font = fontStack(weight, size);
    const chars = [...text];
    while (chars.length > 1) {
        chars.pop();
        const t = chars.join('').trimEnd() + '\u2026';
        if (trackedWidth(ctx, t, spFor(size)) <= maxWidth) return { text: t, size, sp: spFor(size) };
    }
    return { text: '\u2026', size, sp: spFor(size) };
}

/* ------------------------------------------------------------------ */
/* Superficie con supersampling (2x) y utilidades de fondo             */
/* ------------------------------------------------------------------ */
const SS = 2;

function makeSurface(w, h) {
    const big = createCanvas(w * SS, h * SS);
    const ctx = big.getContext('2d');
    ctx.scale(SS, SS);
    return { big, ctx, w, h };
}

function finish(surface) {
    const out = createCanvas(surface.w, surface.h);
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'best';
    octx.drawImage(surface.big, 0, 0, surface.w, surface.h);
    return out.toBuffer('image/png');
}

function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

let noiseTile = null;
function getNoiseTile() {
    if (noiseTile) return noiseTile;
    const n = 256;
    const c = createCanvas(n, n);
    const g = c.getContext('2d');
    const img = g.createImageData(n, n);
    const rnd = mulberry32(1871);
    for (let i = 0; i < n * n; i++) {
        const v = rnd() < 0.5 ? 255 : 0;
        img.data[i * 4] = v;
        img.data[i * 4 + 1] = v;
        img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = Math.floor(rnd() * 255);
    }
    g.putImageData(img, 0, 0);
    noiseTile = c;
    return c;
}

/** Fondo obsidiana con "terciopelo" (luz cálida muy suave), grano de papel y viñeteado. */
function paintVelvet(ctx, w, h, glow = { x: 0.3, y: 0.42 }) {
    ctx.fillStyle = COL.obsidian;
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * glow.x, h * glow.y, 0, w * glow.x, h * glow.y, Math.max(w, h) * 0.75);
    g.addColorStop(0, rgba(COL.coal, 1));
    g.addColorStop(0.55, rgba(COL.coal, 0.35));
    g.addColorStop(1, rgba(COL.coal, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Grano de muy baja opacidad
    ctx.save();
    ctx.globalAlpha = 0.045;
    ctx.fillStyle = ctx.createPattern(getNoiseTile(), 'repeat');
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Viñeteado
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
}

function hairRect(ctx, x, y, w, h, color, lw = 1) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
}

function hline(ctx, x1, x2, y, color, lw = 1) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.restore();
}

function diamond(ctx, cx, cy, r, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Assets estáticos cacheados: logo (como máscara) y sello de lacre    */
/* ------------------------------------------------------------------ */
let logoPromise = null;
function getLogo() {
    if (!logoPromise) {
        logoPromise = loadImage(path.join(__dirname, '..', 'assets', 'logo.png')).catch(() => null);
    }
    return logoPromise;
}

const maskCache = new Map();
/** Convierte el logo (oro sobre negro) en una silueta de un solo color usando la luminancia como alfa. */
async function getLogoMask(hex) {
    if (maskCache.has(hex)) return maskCache.get(hex);
    const img = await getLogo();
    let result = null;
    if (img) {
        try {
            const c = createCanvas(img.width, img.height);
            const g = c.getContext('2d');
            g.drawImage(img, 0, 0);
            const d = g.getImageData(0, 0, c.width, c.height);
            const n = parseInt(hex.slice(1), 16);
            const R = (n >> 16) & 255, G = (n >> 8) & 255, B = n & 255;
            for (let i = 0; i < d.data.length; i += 4) {
                const lum = Math.max(d.data[i], d.data[i + 1], d.data[i + 2]) / 255;
                const a = Math.max(0, Math.min(1, (lum - 0.12) / 0.5));
                d.data[i] = R; d.data[i + 1] = G; d.data[i + 2] = B;
                d.data[i + 3] = Math.round(a * 255);
            }
            g.putImageData(d, 0, 0);
            result = c;
        } catch (e) {
            result = null;
        }
    }
    maskCache.set(hex, result);
    return result;
}

/** Sello de lacre burdeos con el emblema de la casa grabado en relieve. */
function drawSeal(ctx, cx, cy, r, mask) {
    const edge = (th) => r * (1 + 0.018 * Math.sin(3 * th + 1.1) + 0.012 * Math.sin(5 * th + 2.3) + 0.007 * Math.sin(9 * th + 0.4));
    const pathSeal = () => {
        ctx.beginPath();
        const N = 96;
        for (let i = 0; i <= N; i++) {
            const th = (i / N) * Math.PI * 2;
            const rr = edge(th);
            const x = cx + Math.cos(th) * rr, y = cy + Math.sin(th) * rr;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
    };

    ctx.save();
    // sombra de contacto
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = r * 0.35;
    ctx.shadowOffsetY = r * 0.1;
    pathSeal();
    ctx.fillStyle = '#4a1320';
    ctx.fill();
    ctx.restore();

    ctx.save();
    pathSeal();
    ctx.clip();
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r * 1.05);
    g.addColorStop(0, '#7a2b3b');
    g.addColorStop(0.5, COL.burgundy);
    g.addColorStop(1, '#3a0e18');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r * 1.2, cy - r * 1.2, r * 2.4, r * 2.4);
    ctx.restore();

    // borde elevado (doble: sombra interior y luz exterior)
    ctx.save();
    ctx.lineWidth = Math.max(1.2, r * 0.035);
    ctx.strokeStyle = 'rgba(35,6,12,0.85)';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,205,205,0.14)';
    ctx.beginPath(); ctx.arc(cx + r * 0.012, cy + r * 0.02, r * 0.8 + ctx.lineWidth, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // emblema
    const size = r * 1.22;
    if (mask) {
        const off = Math.max(0.8, r * 0.025);
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.drawImage(maskCache.get('#2a0a12'), cx - size / 2 + off, cy - size / 2 + off, size, size);
        ctx.globalAlpha = 1;
        ctx.drawImage(mask, cx - size / 2, cy - size / 2, size, size);
        ctx.restore();
    } else {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.font = fontStack('600', r * 1.05);
        ctx.fillStyle = '#2a0a12';
        ctx.fillText('H', cx + 1, cy + r * 0.36 + 1);
        ctx.fillStyle = '#9b4a5a';
        ctx.fillText('H', cx, cy + r * 0.36);
        ctx.restore();
    }
}

async function prepareSealMask() {
    // tono de relieve (claro) y de hueco (oscuro); si el logo no carga ambos son null
    const light = await getLogoMask('#A8586A');
    await getLogoMask('#2a0a12');
    return light;
}

/* ------------------------------------------------------------------ */
/* Avatar                                                              */
/* ------------------------------------------------------------------ */
function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

async function safeLoadAvatar(url) {
    try {
        if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return null;
        let u = url.trim();
        if (/cdn\.discordapp\.com|media\.discordapp\.net/i.test(u)) u = u.replace(/\.webp(\?|$)/i, '.png$1');
        return await withTimeout(loadImage(u), 8000);
    } catch (e) {
        return null;
    }
}

function drawAvatar(ctx, img, cx, cy, r, name, ringColor) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (img) {
        const s = Math.min(img.width, img.height);
        const sx = (img.width - s) / 2, sy = (img.height - s) / 2;
        ctx.fillStyle = COL.coal;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.drawImage(img, sx, sy, s, s, cx - r, cy - r, r * 2, r * 2);
        // asentar el color del avatar en la paleta: velo cálido + sombra interior
        ctx.fillStyle = 'rgba(13,12,14,0.14)';
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        const iv = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
        iv.addColorStop(0, 'rgba(13,12,14,0)');
        iv.addColorStop(1, 'rgba(13,12,14,0.45)');
        ctx.fillStyle = iv;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    } else {
        // monograma neutro
        const bg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, 0, cx, cy, r * 1.1);
        bg.addColorStop(0, '#221F26');
        bg.addColorStop(1, COL.coal);
        ctx.fillStyle = bg;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        const initial = ([...(name || '')].find((ch) => /\p{L}/u.test(ch)) || 'H').toUpperCase();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = COL.gold;
        ctx.font = fontStack('500', r * 1.15);
        ctx.fillText(initial, cx, cy + r * 0.38);
    }
    ctx.restore();
    // filete fino de oro, separado por un pequeño vacío
    ctx.save();
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = ringColor;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

/* ------------------------------------------------------------------ */
/* 1) Summons                                                          */
/* ------------------------------------------------------------------ */
async function renderSummons({ candidateName, avatarUrl, seats } = {}) {
    const W = 960, H = 320;
    const name = cleanText(candidateName, 'Aspirante an\u00f3nimo');
    const nSeats = toInt(seats, 0);
    const [avatar, sealMask] = await Promise.all([safeLoadAvatar(avatarUrl), prepareSealMask()]);

    const s = makeSurface(W, H);
    const ctx = s.ctx;
    ctx.textBaseline = 'alphabetic';
    paintVelvet(ctx, W, H, { x: 0.28, y: 0.5 });

    // marco: un solo filete fino, y una línea interior apenas visible
    hairRect(ctx, 14.5, 14.5, W - 29, H - 29, rgba(COL.gold, 0.55), 1);
    hairRect(ctx, 20.5, 20.5, W - 41, H - 41, rgba(COL.gold, 0.16), 0.75);

    // avatar
    const AR = 84, ACX = 62 + 6 + AR + 6, ACY = H / 2;
    drawAvatar(ctx, avatar, ACX, ACY, AR, name, COL.gold);

    // sello de lacre centrado verticalmente a la derecha
    const sealR = 42, sealCX = W - 86, sealCY = H / 2;

    // bloque de texto
    const TX = ACX + AR + 6 + 52;
    const maxW = sealCX - sealR - 32 - TX;

    ctx.fillStyle = COL.gold;
    ctx.font = fontStack('600', 22);
    const labelW = drawTracked(ctx, 'C\u00d3NCLAVE DE ADMISI\u00d3N', TX, 98, 7);
    hline(ctx, TX, TX + 44, 116, rgba(COL.gold, 0.8), 1);

    const fit = fitText(ctx, name, '600', 66, 34, maxW, 2);
    ctx.fillStyle = COL.ivory;
    ctx.font = fontStack('600', fit.size);
    drawTracked(ctx, fit.text, TX, 190, fit.sp);

    ctx.fillStyle = COL.smoke;
    ctx.font = fontStack('500', 27);
    const sub = nSeats > 0 ? `Convocados a la urna: ${nSeats}` : 'Convocados a la urna';
    drawTracked(ctx, sub, TX, 240, 1.6);

    drawSeal(ctx, sealCX, sealCY, sealR, sealMask);

    void labelW;
    return finish(s);
}

/* ------------------------------------------------------------------ */
/* 2) Bolas                                                            */
/* ------------------------------------------------------------------ */
const ballCache = new Map();

function paintSphere(ctx, cx, cy, R, kind) {
    const black = kind === 'black';
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    // volumen principal
    const g = ctx.createRadialGradient(cx - R * 0.36, cy - R * 0.42, R * 0.04, cx - R * 0.08, cy - R * 0.1, R * 1.12);
    if (black) {
        g.addColorStop(0, '#4b464b');
        g.addColorStop(0.2, '#2b282c');
        g.addColorStop(0.55, '#151317');
        g.addColorStop(1, '#070608');
    } else {
        g.addColorStop(0, '#FBF8EE');
        g.addColorStop(0.28, '#EFE9D8');
        g.addColorStop(0.62, '#D3C8AC');
        g.addColorStop(1, '#8F8268');
    }
    ctx.fillStyle = g;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    // luz de rebote inferior (cálida), evita que la bola pierda forma
    const b = ctx.createRadialGradient(cx + R * 0.32, cy + R * 0.82, 0, cx + R * 0.32, cy + R * 0.82, R * 0.85);
    if (black) {
        b.addColorStop(0, 'rgba(138,133,128,0.34)');
        b.addColorStop(0.55, 'rgba(110,100,100,0.10)');
        b.addColorStop(1, 'rgba(110,100,100,0)');
    } else {
        b.addColorStop(0, 'rgba(214,196,150,0.55)');
        b.addColorStop(0.6, 'rgba(214,196,150,0.14)');
        b.addColorStop(1, 'rgba(214,196,150,0)');
    }
    ctx.fillStyle = b;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    // reflejo suave de ventana (difuso, sin estrellas ni destellos duros)
    ctx.save();
    ctx.translate(cx - R * 0.38, cy - R * 0.5);
    ctx.rotate(-0.62);
    ctx.scale(1, 0.58);
    const sp = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.36);
    sp.addColorStop(0, black ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.75)');
    sp.addColorStop(0.5, black ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.20)');
    sp.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sp;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.36, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();

    // borde: luz de rebote tenue en la bola negra; borde cálido en la blanca
    ctx.save();
    const rimW = black ? 2.4 : 1.4;
    const rg = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    if (black) {
        rg.addColorStop(0, 'rgba(138,133,128,0.28)');
        rg.addColorStop(0.5, 'rgba(138,133,128,0.10)');
        rg.addColorStop(1, 'rgba(176,168,160,0.55)');
    } else {
        rg.addColorStop(0, 'rgba(143,130,104,0.25)');
        rg.addColorStop(1, 'rgba(110,98,76,0.55)');
    }
    ctx.strokeStyle = rg;
    ctx.lineWidth = rimW;
    ctx.beginPath();
    ctx.arc(cx, cy, R - rimW / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function drawBallSurface(kind) {
    const s = makeSurface(320, 320);
    const ctx = s.ctx;
    const cx = 160, cy = 146, R = 124;

    // sombra de contacto leve
    ctx.save();
    ctx.translate(cx + 6, cy + R + 8);
    ctx.scale(1, 0.14);
    const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.95);
    sh.addColorStop(0, 'rgba(0,0,0,0.55)');
    sh.addColorStop(0.55, 'rgba(0,0,0,0.22)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.95, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    paintSphere(ctx, cx, cy, R, kind);
    return s;
}

async function renderBall(kind) {
    const k = kind === 'black' ? 'black' : 'white';
    if (!ballCache.has(k)) ballCache.set(k, finish(drawBallSurface(k)));
    return Buffer.from(ballCache.get(k));
}

/* ------------------------------------------------------------------ */
/* 3) Acta / veredicto                                                 */
/* ------------------------------------------------------------------ */
function miniBall(ctx, cx, cy, r, kind) {
    if (kind === 'none') {
        ctx.save();
        ctx.strokeStyle = rgba(COL.smoke, 0.55);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        return;
    }
    paintSphere(ctx, cx, cy, r, kind);
    if (kind === 'black') {
        ctx.save();
        ctx.strokeStyle = rgba(COL.smoke, 0.7);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }
}

function drawTally(ctx, x, y, maxW, white, black, empty) {
    const kinds = [];
    for (let i = 0; i < white; i++) kinds.push('white');
    for (let i = 0; i < black; i++) kinds.push('black');
    for (let i = 0; i < empty; i++) kinds.push('none');
    const n = kinds.length;
    if (!n) return 0;
    let d = 24, gap = 9;
    const rowLen = (dd, gg, cnt) => cnt * dd + (cnt - 1) * gg;
    let perRow = n;
    if (rowLen(d, gap, n) > maxW) {
        // reducir hasta 16 px; si aún no cabe, partir en filas
        d = Math.max(16, Math.floor((maxW + gap) / n) - gap);
        gap = Math.max(5, Math.min(9, Math.floor(d * 0.37)));
        if (rowLen(d, gap, n) > maxW) perRow = Math.floor((maxW + gap) / (d + gap));
    }
    const rows = Math.ceil(n / perRow);
    for (let i = 0; i < n; i++) {
        const row = Math.floor(i / perRow), col = i % perRow;
        miniBall(ctx, x + d / 2 + col * (d + gap), y + d / 2 + row * (d + 8), d / 2, kinds[i]);
    }
    return rows * (d + 8) - 8;
}

async function renderVerdict({ candidateName, avatarUrl, white, black, seats, needed, apto, dateText } = {}) {
    const W = 960, H = 540;
    const name = cleanText(candidateName, 'Aspirante an\u00f3nimo');
    const nWhite = Math.min(toInt(white, 0), 200);
    const nBlack = Math.min(toInt(black, 0), 200);
    const nSeats = toInt(seats, 0);
    const nNeeded = toInt(needed, 0);
    const date = cleanText(dateText, '', 48);
    const ok = !!apto;

    const [avatar, sealMask] = await Promise.all([safeLoadAvatar(avatarUrl), prepareSealMask()]);
    const s = makeSurface(W, H);
    const ctx = s.ctx;
    ctx.textBaseline = 'alphabetic';
    paintVelvet(ctx, W, H, { x: 0.3, y: 0.4 });

    const accent = ok ? COL.gold : '#7d2a3b'; // el burdeos de la paleta, aclarado solo para el filete fino
    const frameA = ok ? rgba(COL.gold, 0.7) : rgba('#7d2a3b', 0.95);
    const frameB = ok ? rgba(COL.gold, 0.28) : rgba('#7d2a3b', 0.5);

    // filete doble
    hairRect(ctx, 22.5, 22.5, W - 45, H - 45, frameA, 1.25);
    hairRect(ctx, 30.5, 30.5, W - 61, H - 61, frameB, 0.75);
    // esquinas sobrias: pequeño rombo macizo en cada vértice del filete exterior
    for (const [x, y] of [[22.5, 22.5], [W - 22.5, 22.5], [22.5, H - 22.5], [W - 22.5, H - 22.5]]) {
        ctx.save();
        ctx.fillStyle = COL.obsidian;
        ctx.fillRect(x - 5, y - 5, 10, 10);
        ctx.restore();
        diamond(ctx, x, y, 4.2, ok ? COL.gold : '#7d2a3b');
    }

    const L = 76, R = W - 76;

    // cabecera
    ctx.fillStyle = ok ? COL.gold : COL.smoke;
    ctx.font = fontStack('600', 24);
    drawTracked(ctx, 'ACTA DEL C\u00d3NCLAVE', L, 88, 8);
    if (date) {
        ctx.fillStyle = COL.smoke;
        ctx.font = fontStack('500', 24);
        drawTracked(ctx, date, R, 88, 1.5, 'right');
    }
    hline(ctx, L, R, 106, rgba(ok ? COL.gold : COL.smoke, ok ? 0.45 : 0.4), 0.75);

    // aspirante
    const AR = 46, ACX = L + 6 + AR, ACY = 168;
    drawAvatar(ctx, avatar, ACX, ACY, AR, name, ok ? COL.gold : '#7d2a3b');
    const TX = ACX + AR + 6 + 32;
    const sealR = 46, sealCX = R - sealR - 4, sealCY = ACY + 2;
    const maxNameW = sealCX - sealR - 28 - TX;

    ctx.fillStyle = COL.smoke;
    ctx.font = fontStack('600', 20);
    drawTracked(ctx, 'ASPIRANTE', TX, 146, 6);
    const fit = fitText(ctx, name, '600', 52, 28, maxNameW, 1.5);
    ctx.fillStyle = COL.ivory;
    ctx.font = fontStack('600', fit.size);
    drawTracked(ctx, fit.text, TX, 196, fit.sp);

    drawSeal(ctx, sealCX, sealCY, sealR, sealMask);

    // banda del veredicto
    const bandY = 244, bandH = 100;
    ctx.fillStyle = ok ? COL.coal : COL.burgundy;
    ctx.fillRect(L, bandY, R - L, bandH);
    hline(ctx, L, R, bandY + 0.5, ok ? rgba(COL.gold, 0.8) : rgba(COL.ivory, 0.22), 1);
    hline(ctx, L, R, bandY + bandH - 0.5, ok ? rgba(COL.gold, 0.8) : rgba(COL.ivory, 0.22), 1);

    const l1 = ok ? 'Admitido en la' : 'No admitido en la';
    const l2 = 'Familia Helmreich';
    const phraseR = R - 30;
    ctx.fillStyle = COL.ivory;
    ctx.font = fontStack('500', 26);
    const wL1 = trackedWidth(ctx, l1, 1.5);
    const wL2 = trackedWidth(ctx, l2, 1.5);
    const phraseLeft = phraseR - Math.max(wL1, wL2);

    const word = ok ? 'APTO' : 'NO APTO';
    const maxWordW = phraseLeft - (L + 30) - 48;
    const wordFit = fitText(ctx, word, '600', ok ? 74 : 62, 42, maxWordW, ok ? 11 : 8);
    ctx.fillStyle = ok ? COL.gold : COL.ivory;
    ctx.font = fontStack('600', wordFit.size);
    drawTracked(ctx, wordFit.text, L + 30, bandY + 72, wordFit.sp);

    // divisoria vertical sutil entre veredicto y frase
    const divX = phraseLeft - 24;
    ctx.save();
    ctx.strokeStyle = ok ? rgba(COL.gold, 0.35) : rgba(COL.ivory, 0.25);
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(divX, bandY + 20);
    ctx.lineTo(divX, bandY + bandH - 20);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = COL.ivory;
    ctx.font = fontStack('500', 26);
    drawTracked(ctx, l1, phraseR, bandY + 44, 1.5, 'right');
    drawTracked(ctx, l2, phraseR, bandY + 76, 1.5, 'right');

    // recuento
    const ty = 392;
    ctx.fillStyle = COL.ivory;
    ctx.font = fontStack('600', 27);
    const t1 = `Bolas blancas ${nWhite}`;
    const t2 = `Bolas negras ${nBlack}`;
    const w1 = drawTracked(ctx, t1, L, ty, 2.5);
    diamond(ctx, L + w1 + 22, ty - 9, 3, ok ? COL.gold : '#7d2a3b');
    drawTracked(ctx, t2, L + w1 + 44, ty, 2.5);

    const empty = nSeats > nWhite + nBlack ? nSeats - nWhite - nBlack : 0;
    const used = nWhite + nBlack + empty;
    const tallyMax = R - L;
    const cappedEmpty = used > 40 ? 0 : empty;
    drawTally(ctx, L, ty + 18, tallyMax, nWhite, nBlack, cappedEmpty);

    // pie: regla y firma
    const rule = nNeeded > 0 ? `Con ${nNeeded} bolas negras el aspirante es rechazado` : 'El aspirante es rechazado con la bola negra';
    const ruleFit = fitText(ctx, rule, '500', 21, 15, (R - 250) - L, 0.8);
    ctx.fillStyle = COL.smoke;
    ctx.font = fontStack('500', ruleFit.size);
    drawTracked(ctx, ruleFit.text, L, 478, ruleFit.sp);

    hline(ctx, R - 230, R, 452, rgba(COL.smoke, 0.5), 0.75);
    ctx.fillStyle = COL.ivory;
    ctx.font = fontStack('600', 26);
    drawTracked(ctx, 'La Corte Helmreich', R, 480, 2.5, 'right');

    return finish(s);
}

module.exports = { renderSummons, renderBall, renderVerdict };
