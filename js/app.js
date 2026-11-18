import {
  ROOTS, SCALE_GROUPS, CHORDS, getScale, getChord, spellScale, scalePitchClasses,
  chordPitchClasses, chordDegreeMap, scaleFamily, pcName,
} from './theory.js';
import { buildShapes as makeShapes, cagedPositions, shapeName, TUNING } from './patterns.js';
import { renderAll, flashNoteOnTabs, flashPatternNecks } from './render.js';
import { renderNeck } from './fretboard.js';

const mod12 = (n) => ((n % 12) + 12) % 12;

const state = {
  rootPc: 0,
  scaleId: 'major',
  shape: 'all',      // 'all' 或指型的级数索引
  view: 'both',      // both | pos | 3nps
  maxFret: 15,
  flat: false,
  showDegrees: true,
  showFingers: true,
  showCaged: false,
  neckLabel: 'note',  // 指板圆点显示音名还是级数
  neckMode: 'scale',  // scale 画音阶 / arpeggio 只画和弦音
  chordOn: true,      // 默认就把和弦音单独着色，不用先找开关
  chordRoot: 'follow',// 'follow' 跟随主音，或 pitch class
  chordQuality: 'maj',
  tempo: 90,          // 播放速度 BPM
};

const $ = (id) => document.getElementById(id);
const rootBox = $('roots');
const shapeBox = $('shapes');
const scaleSel = $('scale');

// 记住上次选择
const STORE_KEY = 'scale-tab-state-v3';
try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
  if (saved && typeof saved.rootPc === 'number') {
    Object.assign(state, saved);
    // 老存档里可能有 ionian / aeolian 这类别名，统一折算成现在的 id
    state.scaleId = getScale(state.scaleId).id;
  }
} catch (e) { /* 忽略损坏的存档 */ }

function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 隐私模式下忽略 */ }
}

// --- 控件初始化 ---------------------------------------------------------
const rootLabel = (r) => (state.flat ? r.flat : r.sharp);

function buildRoots() {
  rootBox.innerHTML = '';
  ROOTS.forEach((r) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = rootLabel(r);
    b.dataset.pc = r.pc;
    if (r.pc === state.rootPc) b.classList.add('on');
    b.addEventListener('click', () => {
      state.rootPc = r.pc;
      buildRoots();
      update();
    });
    rootBox.append(b);
  });
}

function buildScales() {
  scaleSel.innerHTML = '';
  SCALE_GROUPS.forEach((g) => {
    const og = document.createElement('optgroup');
    og.label = g.group;
    g.scales.forEach((s) => {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = s.name;
      og.append(o);
    });
    scaleSel.append(og);
  });
  scaleSel.value = state.scaleId;
}

// 和弦控件：根音（可跟随主音）+ 性质
function buildChordControls() {
  const rootSel = $('chordRoot');
  rootSel.innerHTML = '';
  const follow = document.createElement('option');
  follow.value = 'follow';
  follow.textContent = '跟随主音';
  rootSel.append(follow);
  ROOTS.forEach((r) => {
    const o = document.createElement('option');
    o.value = String(r.pc);
    o.textContent = r.sharp === r.flat ? r.sharp : `${r.sharp}/${r.flat}`;
    rootSel.append(o);
  });

  const qSel = $('chordQuality');
  qSel.innerHTML = '';
  CHORDS.forEach((c) => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.suffix ? `${c.name} ${c.suffix}` : c.name;
    qSel.append(o);
  });
}

/** 指型按钮：从主音所在的级数开始，按 do re mi…（小调 la ti do…）排列 */
function buildShapeButtons() {
  const scale = getScale(state.scaleId);
  const pcs = scalePitchClasses(state.rootPc, scale);
  // 按钮上要显示"do · C"这样的唱名+音名，所以这里也得把拼写传进去
  const names = spellScale(state.rootPc, scale, state.flat);
  const shapes = makeShapes(state.rootPc, pcs, scale, {
    maxFret: state.maxFret,
    noteNames: names,
  });

  shapeBox.innerHTML = '';

  const all = document.createElement('button');
  all.type = 'button';
  all.textContent = '全部';
  all.dataset.shape = 'all';
  if (state.shape === 'all') all.classList.add('on');
  all.addEventListener('click', () => {
    state.shape = 'all';
    buildShapeButtons();
    update();
  });
  shapeBox.append(all);

  // 按级数顺序排：大调 do re mi…，小调 la ti do…
  shapes.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    // 名字后面带上这个音的唱名，按钮本身就说明"这一型从哪个音起"
    b.textContent = `${s.name} · ${s.noteName}`;
    b.title = `${s.degreeLabel} 级 · ${s.noteName} · ${s.pos.lo}–${s.pos.hi} 品`;
    b.dataset.shape = String(s.degree);
    if (String(state.shape) === String(s.degree)) b.classList.add('on');
    b.addEventListener('click', () => {
      // 再点一次当前指型 = 取消，回到整条琴颈
      state.shape = String(state.shape) === String(s.degree) ? 'all' : s.degree;
      buildShapeButtons();
      update();
    });
    shapeBox.append(b);
  });
}

// --- 联动：指板 ↔ 谱 -----------------------------------------------------
// 哪边被点，两边一起亮；同时把"这个音是什么"写在指板正下方，
// 因为笔记本屏幕上谱通常在屏幕外，只闪谱等于没反馈。
let noteCtx = null;

/** 当前和弦：根音可以跟随主音，也可以独立选 */
function currentChord() {
  const rootPc = state.chordRoot === 'follow' ? state.rootPc : Number(state.chordRoot);
  const chord = getChord(state.chordQuality);
  const name = `${state.flat ? ROOTS[rootPc].flat : ROOTS[rootPc].sharp}${chord.suffix}`;
  return {
    rootPc,
    chord,
    name,
    pcs: chordPitchClasses(rootPc, chord),
    degrees: chordDegreeMap(rootPc, chord),
  };
}

function highlightSameNote(stringIndex, fret) {
  const hit = flashNoteOnTabs(stringIndex, fret);
  flashPatternNecks(stringIndex, fret);
  if (neckCtl) neckCtl.flash(stringIndex, fret);

  const info = $('neckInfo');
  if (!info || !noteCtx) return hit;

  const midi = TUNING.openMidi[stringIndex] + fret;
  const pc = mod12(midi);
  const def = noteCtx.defOf.get(pc);
  const bar = `${6 - stringIndex} 弦 ${fret} 品`;

  if (!def) {
    info.textContent = `${bar} · 这个音不在当前视图里`;
    info.classList.add('off');
    return hit;
  }

  // 音阶视图说"你点的是音阶第几级"，琶音视图说"它是和弦的哪个音"
  let what = noteCtx.mode === 'arpeggio'
    ? `${def.name}（${def.deg}）`
    : `${def.name}（${def.deg}${def.tier === 'root' ? '，主音' : ''}）`;
  if (def.tier === 'chord') what += '，和弦音';
  if (def.tier === 'outside') what += '，和弦音但不在本音阶里';

  let tail;
  if (hit) tail = `谱上亮了 ${hit} 处`;
  else if (noteCtx.shapeLabel) tail = `不在 ${noteCtx.shapeLabel} 指型里，谱上没有`;
  else tail = '';

  info.textContent = [bar, what, tail].filter(Boolean).join(' · ');
  info.classList.toggle('off', !hit);
  return hit;
}

// --- 主更新 -------------------------------------------------------------
let neckCtl = null;

function update() {
  if (neckCtl) neckCtl.stop();
  const scale = getScale(state.scaleId);
  const pcs = scalePitchClasses(state.rootPc, scale);
  const names = spellScale(state.rootPc, scale, state.flat);
  const rootName = rootLabel(ROOTS[state.rootPc]);

  const shapes = makeShapes(state.rootPc, pcs, scale, {
    maxFret: state.maxFret,
    noteNames: names,
  });
  let picked = state.shape === 'all'
    ? shapes
    : shapes.filter((s) => String(s.degree) === String(state.shape));
  // 存档里的指型在当前音阶里不存在（比如从七声切到五声）就退回全部
  if (!picked.length) {
    state.shape = 'all';
    picked = shapes;
  }

  // 指板图：整条琴颈都画，选中某个指型时其它音淡出
  let shapeNotes = null;
  let range = null;
  if (state.shape !== 'all') {
    const target = (state.view === '3nps' && picked[0].nps) ? picked[0].nps : picked[0].pos;
    shapeNotes = new Set(target.notes.map((n) => `${n.stringIndex}-${n.fret}`));
    range = { lo: target.lo, hi: target.hi };
  }
  // ---- 和弦音：三层音（音阶视图）和琶音视图都基于它 ----
  const chord = currentChord();
  const chordOn = state.chordOn || state.neckMode === 'arpeggio';
  const chordSet = new Set(chord.pcs);
  const scaleSet = new Set(pcs);

  // 指板上要画的音，带层级：root / chord / scale / outside
  const defs = [];
  if (state.neckMode === 'arpeggio') {
    // 琶音视图：只画和弦音，圆点显示 R / b3 / 5 / b7
    chord.pcs.forEach((pc, i) => {
      defs.push({
        pc,
        name: pcName(pc, state.flat),
        deg: chord.chord.degrees[i],
        tier: i === 0 ? 'root' : 'chord',
      });
    });
  } else {
    pcs.forEach((pc, i) => {
      let tier = 'scale';
      if (i === 0) tier = 'root';
      else if (chordOn && chordSet.has(pc)) tier = 'chord';
      defs.push({ pc, name: names[i], deg: scale.degrees[i], tier });
    });
    // 只有和弦根音离开主音时才可能出现"音阶外的和弦音"
    if (chordOn) {
      chord.pcs.forEach((pc, i) => {
        if (scaleSet.has(pc)) return;
        defs.push({
          pc,
          name: pcName(pc, state.flat),
          deg: chord.chord.degrees[i],
          tier: 'outside',
        });
      });
    }
  }

  neckCtl = renderNeck($('neck'), {
    defs,
    maxFret: state.maxFret,
    shapeNotes,
    range,
    labelMode: state.neckLabel,
    onNoteClick: highlightSameNote,
    onNotePlay: flashPatternNecks,
    tempo: state.tempo,
  });
  $('neckSel').textContent = `${rootName} ${scale.name}` +
    (state.neckMode === 'arpeggio' ? ` · 琶音 ${chord.name}` : '') +
    (state.shape === 'all' ? '' : ` · 只亮 ${picked[0].name} 指型`);

  // 和弦说明 + 图例（没开和弦就只留主音/音阶音两条）
  const toneNames = chord.pcs.map((pc) => pcName(pc, state.flat)).join(' ');
  const outsideCount = defs.filter((d) => d.tier === 'outside').length;
  $('chordName').textContent = chordOn
    ? `${chord.name} = ${toneNames}` + (outsideCount ? ` · ${outsideCount} 个音在音阶外` : '')
    : '';
  $('lgChord').style.display = chordOn ? '' : 'none';
  $('lgOut').style.display = chordOn && outsideCount ? '' : 'none';
  $('lgScale').style.display = state.neckMode === 'arpeggio' ? 'none' : '';

  noteCtx = {
    defOf: new Map(defs.map((d) => [d.pc, d])),
    shapeLabel: state.shape === 'all' ? '' : picked[0].name,
    mode: state.neckMode,
  };
  const info = $('neckInfo');
  info.textContent = state.neckMode === 'arpeggio'
    ? `只显示 ${chord.name} 的和弦音，圆点是它在和弦里的级数`
    : '点圆点试听，同时把下方谱上这个音点亮';
  info.classList.remove('off');

  // 播放按钮只在选中单个指型时可用（"全部"是整条琴颈，听不出东西）
  const playBtn = $('neckPlay');
  playBtn.disabled = state.shape === 'all';
  playBtn.title = state.shape === 'all'
    ? '先在上面选一个指型，再播放'
    : '按音高上行播放当前指型';

  // 概要
  const pairs = names
    .map((n, i) => `<b>${n}</b><span class="deg">(${scale.degrees[i]})</span>`)
    .join(' ');

  const npsOk = pcs.length >= 7;
  const missing = picked.filter((s) => !s.nps).map((s) => s.name);
  let note = '';
  if (!npsOk && state.view !== 'pos') {
    note = ' <span class="warn">（不足 7 个音的音阶，每弦三音要跨三个八度，不适用）</span>';
  } else if (missing.length && state.view !== 'pos') {
    note = ` <span class="warn">（${missing.join('、')} 指型超出最高品，没有每弦三音版）</span>`;
  }

  const shapeText = state.shape === 'all'
    ? `${shapes.length} 个指型`
    : `${picked[0].name} 指型`;

  $('summary').innerHTML =
    `${rootName} ${scale.name} · ${pairs} · ${shapeText}` +
    (state.view === 'pos' ? ' · 把位谱' : state.view === '3nps' ? ' · 每弦三音' : ' · 把位 + 每弦三音') +
    (chordOn ? ` · 和弦 <b>${chord.name}</b>` : '') +
    note;

  // 音阶说明：家族 + 音数 + 听感 + 用法（以前下拉里只有名字，不知道什么时候用）
  $('scaleNote').innerHTML =
    `<span class="sn-tag">${scaleFamily(scale)}</span>` +
    `<span class="sn-meta">${scale.offsets.length} 个音</span>` +
    `<span class="sn-line"><b>听感</b> ${scale.sound}</span>` +
    `<span class="sn-line"><b>用法</b> ${scale.use}</span>`;

  // 组装把位谱和每弦三音谱；对应的 3NPS 指板由 renderAll 放入独立分区
  const items = [];
  picked.forEach((s) => {
    if (state.view !== '3nps') {
      items.push({
        ...s.pos,
        kind: 'pos',
        title: `${s.name} 指型 · 把位`,
        subtitle: `主音 ${s.noteName}（${s.degreeLabel}）· 把位 ${s.pos.lo}–${s.pos.hi} 品 · ${s.pos.noteCount} 音`,
      });
    }
    if (state.view !== 'pos' && npsOk && s.nps) {
      items.push({
        ...s.nps,
        kind: '3nps',
        title: `${s.name} 指型 · 每弦三音`,
        subtitle: `最低音 ${s.noteName}（${s.degreeLabel}）· 6 弦 ${s.nps.anchorFret} 品起 · 品域 ${s.nps.lo}–${s.nps.hi} 品 · 18 音`,
      });
    }
  });

  const groups = [];
  if (items.length) groups.push({ title: '', items });

  if (state.showCaged) {
    const caged = cagedPositions(state.rootPc, pcs, { maxFret: state.maxFret }).map((b) => ({
      ...b,
      title: `对照 · CAGED ${b.shape}`,
      subtitle: `主音在 ${['E', 'A', 'D', 'G', 'B'][b.anchorString]} 弦 ${b.anchorFret} 品 · 窗口 ${b.lo}–${b.hi} 品`,
    }));
    groups.push({ title: '对照：CAGED 五型', items: caged });
  }

  renderAll(groups, {
    degrees: scale.degrees,
    showDegrees: state.showDegrees,
    showFingers: state.showFingers,
    onNoteClick: highlightSameNote,
    defs,
    maxFret: state.maxFret,
    labelMode: state.neckLabel,
    tempo: state.tempo,
    // 谱上和指板用同一套和弦音着色：橙色 = 和弦音（非根音）
    chordSet: chordOn ? chordSet : null,
    chordRootPc: chord.rootPc,
  });

  if (!groups.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '这个音阶没有可用的每弦三音指型，把「谱型」切回「把位」看看。';
    $('out').append(empty);
  }
  persist();
}

// --- 事件绑定 -----------------------------------------------------------
scaleSel.addEventListener('change', (e) => {
  state.scaleId = e.target.value;
  // 换了音阶（尤其大小调）指型名称会变，回到"全部"更直观
  state.shape = 'all';
  buildShapeButtons();
  update();
});
$('view').addEventListener('change', (e) => {
  state.view = e.target.value;
  update();
});
$('maxFret').addEventListener('change', (e) => {
  state.maxFret = Number(e.target.value);
  buildShapeButtons();
  update();
});
$('flat').addEventListener('change', (e) => {
  state.flat = e.target.checked;
  buildRoots();
  buildShapeButtons(); // 按钮上带着音名，拼写方式变了要跟着换
  update();
});
$('showDegrees').addEventListener('change', (e) => {
  state.showDegrees = e.target.checked;
  update();
});
$('showFingers').addEventListener('change', (e) => {
  state.showFingers = e.target.checked;
  update();
});
$('showCaged').addEventListener('change', (e) => {
  state.showCaged = e.target.checked;
  update();
});
$('neckLabel').addEventListener('change', (e) => {
  state.neckLabel = e.target.value;
  update();
});
$('neckMode').addEventListener('change', (e) => {
  state.neckMode = e.target.value;
  update();
});
$('tempo').addEventListener('change', (e) => {
  state.tempo = Number(e.target.value);
  update();
});
$('chordOn').addEventListener('change', (e) => {
  state.chordOn = e.target.checked;
  // 打开和弦音时默认就是"跟随主音 + 大三和弦"，保证一开就能看到东西
  update();
});
$('chordRoot').addEventListener('change', (e) => {
  state.chordRoot = e.target.value;
  update();
});
$('chordQuality').addEventListener('change', (e) => {
  state.chordQuality = e.target.value;
  update();
});
$('neckPlay').addEventListener('click', () => {
  if (neckCtl) neckCtl.play();
});

buildRoots();
buildScales();
buildChordControls();
buildShapeButtons();

// 把控件同步成（可能来自上次的）状态
$('view').value = state.view;
$('maxFret').value = String(state.maxFret);
$('flat').checked = state.flat;
$('showDegrees').checked = state.showDegrees;
$('showFingers').checked = state.showFingers;
$('showCaged').checked = state.showCaged;
$('neckLabel').value = state.neckLabel || 'note';
$('neckMode').value = state.neckMode || 'scale';
$('tempo').value = String(state.tempo || 90);
$('chordOn').checked = !!state.chordOn;
$('chordRoot').value = String(state.chordRoot);
$('chordQuality').value = state.chordQuality;

update();

// 便于排查：控制台可访问
window.__scaleTab = { state, shapeName };
