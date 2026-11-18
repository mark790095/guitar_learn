// 指板图：横向六线，最上面是 1 弦，左边画弦名，上面画品号。
// 有两种视图：
//   音阶 —— 画音阶音，并且把其中的和弦音单独着色（三层音）
//   琶音 —— 只画和弦音，圆点显示 R / 3 / 5 / b7
// 圆点的"层级"由 defs 里的 tier 决定，这里只负责画。

import { playMidi } from './audio.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// 显示顺序：1 弦在上，6 弦在下
// pat = 指型数据里的弦序号（0 = 6 弦），用来和把位谱对照
const STRINGS = [
  { pat: 5, label: 'E4', open: 64 },
  { pat: 4, label: 'B3', open: 59 },
  { pat: 3, label: 'G3', open: 55 },
  { pat: 2, label: 'D3', open: 50 },
  { pat: 1, label: 'A2', open: 45 },
  { pat: 0, label: 'E2', open: 40 },
];

const INLAY_FRETS = [3, 5, 7, 9, 15];

// 四层音的外观：主音 / 和弦音 / 普通音阶音 / 音阶外的和弦音
const TIER_STYLE = {
  root:    { fill: '#e05c5c', stroke: '#e05c5c', text: '#ffffff', weight: 600, dash: null },
  chord:   { fill: '#c9873c', stroke: '#e0a860', text: '#ffffff', weight: 600, dash: null },
  scale:   { fill: '#2b3040', stroke: '#3a4150', text: '#dfe4ee', weight: 400, dash: null },
  outside: { fill: '#1d222b', stroke: '#e0a860', text: '#e0a860', weight: 600, dash: '3 2' },
};

const el = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  return n;
};

const mod12 = (n) => ((n % 12) + 12) % 12;

/**
 * @param {HTMLElement} host
 * @param {object} opts
 *   defs       要画的音：[{ pc, name, deg, tier }]，tier 见 TIER_STYLE
 *   maxFret    画到第几品
 *   labelMode  'note' 显示音名 / 'degree' 显示级数
 *   shapeNotes 选中指型时，指型内的 "str-fret" 集合；其余音淡显
 *   range      选中指型的品域 {lo, hi}
 *   tempo      播放速度（BPM），一个音一拍
 * @returns {{ play: Function, stop: Function, flash: Function }}
 */
export function renderNeck(host, opts) {
  const {
    defs = [], maxFret = 15,
    shapeNotes = null, shapePositions: rawShapePositions = [], range = null, fretWindow = null, labelMode = 'note',
    onNoteClick = null, onNotePlay = null, tempo = 90,
  } = opts;

  const defOf = new Map(); // pc → { name, deg, tier }
  defs.forEach((d) => {
    if (!defOf.has(d.pc)) defOf.set(d.pc, d);
  });

  const padLeft = 52;   // 弦名宽度
  const padTop = 26;    // 品号行
  const padBottom = 10;
  const openW = 32;     // 空弦那一列
  const rowH = 27;
  const fretW = opts.fretWidth ?? 58;
  const firstFret = 0;
  const shapePositions = new Set(rawShapePositions.map((n) => `${n.stringIndex}-${n.fret}`));
  const inShapePosition = (stringIndex, fret) => shapePositions.has(`${stringIndex}-${fret}`);

  const lastFret = Math.max(maxFret, range ? range.hi : 0);

  const nutX = padLeft + openW;
  const width = nutX + lastFret * fretW + 6;
  const height = padTop + 5 * rowH + padBottom;

  const yOf = (i) => padTop + i * rowH;
  const xOfLine = (k) => nutX + k * fretW;
  const xOfFret = (f) => (f === 0 ? nutX - openW / 2 : nutX + (f - 0.5) * fretW);

  const svg = el('svg', {
    viewBox: `0 0 ${width} ${height}`,
    class: 'neck-svg',
    role: 'img',
    'aria-label': '指板音阶图',
  });

  // 指板底色
  svg.append(el('rect', {
    x: nutX, y: yOf(0) - 12,
    width: lastFret * fretW, height: 5 * rowH + 24,
    fill: '#171a20', rx: 4,
  }));

  // 选中的指型：用半透明色块把这一格圈出来
  if (range) {
    const x1 = range.lo === 0 ? nutX - openW + 2 : xOfLine(range.lo - 1);
    const x2 = xOfLine(Math.min(range.hi, lastFret));
    svg.append(el('rect', {
      x: x1, y: yOf(0) - 11,
      width: Math.max(12, x2 - x1), height: 5 * rowH + 22,
      fill: 'rgba(224,92,92,0.07)',
      stroke: 'rgba(224,92,92,0.35)',
      'stroke-dasharray': '4 4',
      rx: 5,
    }));
  }

  // 品丝
  for (let k = 1; k <= lastFret; k++) {
    svg.append(el('line', {
      x1: xOfLine(k), y1: yOf(0) - 10, x2: xOfLine(k), y2: yOf(5) + 10,
      stroke: '#2f3542', 'stroke-width': 1,
    }));
  }
  // 弦枕
  svg.append(el('line', {
    x1: nutX, y1: yOf(0) - 12, x2: nutX, y2: yOf(5) + 12,
    stroke: '#6b7382', 'stroke-width': 4, 'stroke-linecap': 'round',
  }));

  // 品记：3/5/7/9/15 单点，12 双点，位置在 3、4 弦之间
  const inlayY = (yOf(2) + yOf(3)) / 2;
  INLAY_FRETS.forEach((f) => {
    if (f > lastFret) return;
    svg.append(el('circle', { cx: xOfFret(f), cy: inlayY, r: 2.6, fill: '#333a47' }));
  });
  if (firstFret < 12 && lastFret >= 12) {
    [-5, 5].forEach((dx) => {
      svg.append(el('circle', { cx: xOfFret(12) + dx, cy: inlayY, r: 2.6, fill: '#333a47' }));
    });
  }

  // 琴弦：低音弦略粗
  STRINGS.forEach((s, i) => {
    svg.append(el('line', {
      x1: nutX, y1: yOf(i), x2: xOfLine(lastFret), y2: yOf(i),
      stroke: '#3a4150', 'stroke-width': 1 + i * 0.22,
    }));
    const sLabel = el('text', {
      x: padLeft - 10, y: yOf(i) + 4, 'text-anchor': 'end',
      fill: '#98a0b3', 'font-size': 11, 'font-family': 'Arial, sans-serif',
    });
    sLabel.textContent = s.label;
    svg.append(sLabel);
  });

  // 品号
  const head = el('text', {
    x: nutX - openW / 2, y: padTop - 12, 'text-anchor': 'middle',
    fill: '#6b7382', 'font-size': 10, 'font-family': 'Arial, sans-serif',
  });
  head.textContent = '0';
  svg.append(head);

  for (let f = 1; f <= lastFret; f++) {
    const t = el('text', {
      x: xOfFret(f), y: padTop - 12, 'text-anchor': 'middle',
      fill: '#6b7382', 'font-size': 10, 'font-family': 'Arial, sans-serif',
    });
    t.textContent = String(f);
    svg.append(t);
  }

  // 音符
  const noteNodes = []; // 播放时逐个点亮
  const nodeMap = new Map(); // "弦-品" → 圆点，供谱上反向定位
  STRINGS.forEach((s, i) => {
    for (let f = firstFret; f <= lastFret; f++) {
      const pc = mod12(s.open + f);
      const def = defOf.get(pc);
      if (!def) continue;

      const tier = def.tier || 'scale';
      const look = TIER_STYLE[tier] || TIER_STYLE.scale;
      const inShape = !shapeNotes || shapeNotes.has(`${s.pat}-${f}`);
      const cx = xOfFret(f);
      const cy = yOf(i);
      const text = labelMode === 'degree' ? (def.deg || def.name) : def.name;

      const g = el('g', {
        class: `neck-note tier-${tier}`,
        'data-string': s.pat,
        'data-fret': f,
      });
      g.style.cursor = 'pointer';
      g.style.opacity = inShape ? 1 : 0.18;

      const circleAttrs = {
        cx, cy, r: 10,
        fill: look.fill,
        stroke: look.stroke,
        'stroke-width': 1,
      };
      if (look.dash) circleAttrs['stroke-dasharray'] = look.dash;
      g.append(el('circle', circleAttrs));

      const label = el('text', {
        x: cx, y: cy + 3.4, 'text-anchor': 'middle',
        fill: look.text,
        'font-size': String(text).length > 2 ? 8 : (String(text).length > 1 ? 9 : 9.5),
        'font-family': 'Arial, sans-serif',
        'font-weight': look.weight,
      });
      label.textContent = text;
      g.append(label);

      const midi = s.open + f;
      g.addEventListener('click', () => {
        playMidi(midi);
        if (onNoteClick) onNoteClick(s.pat, f);
        if (onNotePlay) onNotePlay(s.pat, f);
      });
      noteNodes.push({ midi, g, inShape, stringIndex: s.pat, fret: f });
      nodeMap.set(`${s.pat}-${f}`, g);
      svg.append(g);
    }
  });

  host.innerHTML = '';
  host.append(svg);

  // ---- 播放整个指型（按音高上行，一个音一拍的速度） ----
  let timer = null;
  let flashTimer = null;
  const stop = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    noteNodes.forEach(({ g }) => g.classList.remove('lit'));
  };

  /** 谱上点音符时，把指板上同一个音闪一下 */
  const flash = (stringIndex, fret) => {
    const g = nodeMap.get(`${stringIndex}-${fret}`);
    if (!g) return false;
    if (flashTimer) clearTimeout(flashTimer);
    noteNodes.forEach((x) => x.g.classList.remove('lit'));
    g.classList.add('lit');
    flashTimer = setTimeout(() => g.classList.remove('lit'), 1100);
    return true;
  };

  const play = (shapeOnly = false) => {
    stop();
    const seq = noteNodes
      .filter((n) => shapeOnly ? inShapePosition(n.stringIndex, n.fret) : n.inShape)
      .sort((a, b) => a.midi - b.midi);
    if (!seq.length) return;

    // 一个音半拍：90 BPM 时 333ms，和之前手写的感觉接近
    const step = Math.max(80, Math.round(30000 / (tempo || 90)));
    seq.forEach((n, i) => {
      timer = setTimeout(() => {
        noteNodes.forEach((x) => x.g.classList.remove('lit'));
        n.g.classList.add('lit');
        playMidi(n.midi, 0.5);
        if (onNotePlay) onNotePlay(n.stringIndex, n.fret);
        if (i === seq.length - 1) {
          timer = setTimeout(() => n.g.classList.remove('lit'), step * 0.9);
        }
      }, i * step);
    });
  };

  return { play, stop, flash };
}
