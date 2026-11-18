// 用 VexFlow 把指法数据画成六线谱
import { TUNING } from './patterns.js';
import { playMidi } from './audio.js';
import { renderNeck } from './fretboard.js';

const VF = window.Vex.Flow;
const PANEL_BG = '#1c1f26'; // 与 style.css 的 .card 背景一致
const patternNecks = new Set();

export function flashPatternNecks(stringIndex, fret) {
  patternNecks.forEach((neck) => neck.flash(stringIndex, fret));
}

function createCard(title, meta) {
  const card = document.createElement('div');
  card.className = 'card';
  const h = document.createElement('h2');
  h.textContent = title;
  const p = document.createElement('p');
  p.className = 'meta';
  p.textContent = meta;
  const tab = document.createElement('div');
  tab.className = 'tab';
  card.append(h, p, tab);
  return { card, tab };
}

/**
 * 画一个指型。
 * pattern.notes 按演奏顺序排列；根音标红；可选在谱下方标级数。
 */
export function renderPattern(pattern, opts) {
  const {
    degrees, showDegrees, showFingers, availWidth, onNoteClick,
    chordSet = null,
  } = opts;
  const notes = pattern.notes;

  // 谱面和指板用同一套颜色：主音红、和弦音橙、其余浅灰
  const colorOf = (n) => {
    if (n.isRoot) return '#ff6b6b';
    if (chordSet && chordSet.has(n.pc)) return '#e0a860';
    return '#e6e8ee';
  };
  // 谱宽跟着音符数走：音符少就窄一点，别把数字拉得太开
  const width = Math.max(
    460,
    Math.min((availWidth || 1000) - 40, 150 + notes.length * 62),
  );
  const height = 168;

  const { card, tab } = createCard(pattern.title, pattern.subtitle);

  if (pattern.kind === '3nps') {
    const neck = document.createElement('div');
    neck.className = 'pattern-neck three-nps-neck';
    const neckCtl = renderNeck(neck, {
      defs: opts.defs,
      maxFret: opts.maxFret,
      shapeNotes: new Set(notes.map((n) => `${n.stringIndex}-${n.fret}`)),
      shapePositions: notes,
      range: { lo: pattern.lo, hi: pattern.hi },
      labelMode: opts.labelMode,
      tempo: opts.tempo,
      onNoteClick,
      onNotePlay: flashPatternNecks,
    });
    patternNecks.add(neckCtl);
    card.insertBefore(neck, tab);
  }

  const renderer = new VF.Renderer(tab, VF.Renderer.Backends.SVG);
  renderer.resize(width, height);
  const ctx = renderer.getContext();

  // 深色底：谱线与数字都要用浅色，否则黑字看不见
  ctx.setFillStyle('#e6e8ee');
  ctx.setStrokeStyle('#8a93a6');
  ctx.setFont('Arial', 12, 'normal');

  const stave = new VF.TabStave(10, 14, width - 24);
  stave.addTabGlyph();
  // 给 TAB 谱号留出位置，第一个音别压在谱号上
  stave.setNoteStartX(stave.getNoteStartX() + 26);
  stave.setContext(ctx).draw();

  const vfNotes = notes.map((n) => {
    const note = new VF.TabNote({
      positions: [{ str: 6 - n.stringIndex, fret: n.fret }],
      duration: 'q',
    });
    note.setStyle({
      fillStyle: colorOf(n),
      strokeStyle: colorOf(n),
    });
    return note;
  });

  ctx.setFillStyle('#e6e8ee');
  VF.Formatter.FormatAndDraw(ctx, stave, vfNotes);

  // VexFlow 会给每个品号垫一块矩形，用来遮住穿过数字的弦线。
  // 默认尺寸偏小且位置偏下，这里按"音符所在弦线"重算，并换成卡片底色；
  // 开了指法标注时，遮罩往左多留一格放指法号。
  const boxes = [];
  tab.querySelectorAll('.vf-tabnote').forEach((g, i) => {
    const text = g.querySelector('text');
    const rect = g.querySelector('rect');
    if (!text || !rect) return;

    const n = notes[i];
    // TabStave 画出来的弦线和 getYForLine 差了一截（TAB 谱号占位），
    // 用 VexFlow 自己算好的基线反推弦线位置最可靠
    const lineY = Number(text.getAttribute('y')) - 5;
    text.setAttribute('y', lineY + 4.5); // 数字压在弦线正中

    // 按文字实际宽度算遮罩（getBBox 在这个 SVG 里拿不到绝对坐标）
    const tx = Number(text.getAttribute('x'));
    ctx.setFont('Arial', 13, 'normal');
    const tw = ctx.measureText(text.textContent).width;
    ctx.setFont('Arial', 12, 'normal');

    const padLeft = showFingers && n.finger ? 16 : 3;
    rect.setAttribute('x', tx - tw / 2 - padLeft);
    rect.setAttribute('y', lineY - 6);
    rect.setAttribute('width', tw + padLeft + 3);
    rect.setAttribute('height', 12);
    rect.setAttribute('fill', PANEL_BG);

    // 给上"弦-品"标记：点指板圆点时要能在谱里找到它
    g.classList.add('tab-note');
    g.dataset.string = String(n.stringIndex);
    g.dataset.fret = String(n.fret);
    g.style.cursor = 'pointer';
    g.addEventListener('click', () => {
      playMidi(TUNING.openMidi[n.stringIndex] + n.fret);
      if (onNoteClick) onNoteClick(n.stringIndex, n.fret);
    });

    boxes.push({ n, x: tx, lineY });
  });

  // 指法编号：1–4 指，标在品号左边，空弦不标
  if (showFingers) {
    ctx.save();
    ctx.setFont('Arial', 8, 'normal');
    ctx.setFillStyle('#8a93a6');
    boxes.forEach(({ n, x, lineY }) => {
      if (!n.finger) return;
      ctx.fillText(String(n.finger), x - 14, lineY + 3);
    });
    ctx.restore();
  }

  if (showDegrees) {
    ctx.save();
    ctx.setFont('Arial', 10, 'normal');
    const y = stave.getYForLine(5) + 17;
    vfNotes.forEach((note, i) => {
      const n = notes[i];
      const text = degrees[n.degreeIndex] || '';
      // SVG 文本默认左对齐，手动按字宽居中
      const w = ctx.measureText(text).width;
      ctx.setFillStyle(
        n.isRoot ? '#ff6b6b' : (chordSet && chordSet.has(n.pc) ? '#c9873c' : '#7f8798'),
      );
      ctx.fillText(text, note.getAbsoluteX() - w / 2, y);
    });
    ctx.restore();
  }

  return card;
}

export function renderAll(groups, opts) {
  const out = document.getElementById('out');
  patternNecks.forEach((neck) => neck.stop());
  patternNecks.clear();
  out.innerHTML = '';
  const frag = document.createDocumentFragment();
  const availWidth = out.clientWidth;
  const fullOpts = { ...opts, availWidth };
  const patterns = groups.flatMap((group) => group.items);
  const sections = [
    ['把位谱', document.createElement('section')],
    ['每弦三音指板', document.createElement('section')],
    ['每弦三音谱', document.createElement('section')],
  ];
  sections.forEach(([, section]) => {
    section.className = 'pattern-section';
  });
  const appendCardHeader = (target, card) => {
    target.append(card.querySelector('h2').cloneNode(true), card.querySelector('.meta').cloneNode(true));
  };

  patterns.forEach((pattern) => {
    const card = renderPattern(pattern, fullOpts);
    if (pattern.kind !== '3nps') {
      sections[0][1].append(card);
      return;
    }

    const neck = card.querySelector('.pattern-neck');
    const tab = card.querySelector('.tab');
    const neckCard = document.createElement('article');
    neckCard.className = 'card';
    appendCardHeader(neckCard, card);
    neckCard.append(neck);
    sections[1][1].append(neckCard);

    const tabCard = document.createElement('article');
    tabCard.className = 'card';
    appendCardHeader(tabCard, card);
    tabCard.append(tab);
    sections[2][1].append(tabCard);
  });

  sections.forEach(([title, section]) => {
    if (!section.children.length) return;
    const heading = document.createElement('h2');
    heading.className = 'pattern-section-title';
    heading.textContent = title;
    section.prepend(heading);
    frag.append(section);
  });
  out.append(frag);
}

/**
 * 反向定位：把谱上某个"弦-品"的音闪一下（可能同时出现在好几张卡里）。
 * @returns {number} 命中的音符数量，0 表示这个音不在当前展示的谱里
 */
export function flashNoteOnTabs(stringIndex, fret, { scroll = true } = {}) {
  const nodes = [...document.querySelectorAll(
    `.tab-note[data-string="${stringIndex}"][data-fret="${fret}"]`,
  )];
  if (!nodes.length) return 0;

  nodes.forEach((g) => {
    g.classList.remove('flash');
    void g.getBoundingClientRect(); // 强制重排，连续点同一个音也能重播动画
    g.classList.add('flash');
  });
  setTimeout(() => nodes.forEach((g) => g.classList.remove('flash')), 1200);

  // 只滚够用的那一点：保证音符离视口边至少 60px。
  // scrollIntoView('nearest') 会把它停在视口最底边，看着像没反应。
  if (scroll) {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const margin = 60;
    const r = nodes[0].getBoundingClientRect();
    if (r.bottom > vh - margin) {
      window.scrollBy({ top: r.bottom - (vh - margin), behavior: 'smooth' });
    } else if (r.top < margin) {
      window.scrollBy({ top: r.top - margin, behavior: 'smooth' });
    }
  }
  return nodes.length;
}
