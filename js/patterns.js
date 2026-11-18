// 指法生成：标准调弦 EADGBE
// 弦索引 0 = 6 弦（低音 E），5 = 1 弦（高音 e）
//
// 指型系统（首调唱名）：
//   指型名称 = 这个指型最低音（第 6 弦起点）在调内的唱名。
//   do 指型 = 从主音起，re 指型 = 从二级起 …… 七声音阶共 7 个指型。
//   每个指型给出两种谱：把位（窗口 [主音-1, 主音+3]，窗口内的音一个不漏）与每弦三音（每弦正好 3 音）。

export const TUNING = {
  name: 'Standard EADGBE',
  openMidi: [40, 45, 50, 55, 59, 64],
  labels: ['E', 'A', 'D', 'G', 'B', 'e'], // 与 openMidi 同序
};

export const MAX_FRET_DEFAULT = 15;

export const SOLFEGE = ['do', 're', 'mi', 'fa', 'sol', 'la', 'ti'];

// 大调音阶的七个音级（相对主音的半音数）
const MAJOR_SEMIS = [0, 2, 4, 5, 7, 9, 11];

// 每个音阶的主音是关系大调的第几级：大调 = do，Dorian = re，小调 = la ……
const SCALE_SHIFT = {
  major: 0, ionian: 0,
  dorian: 1,
  phrygian: 2,
  lydian: 3,
  mixolydian: 4,
  minor: 5, aeolian: 5,
  locrian: 6,
  pentaMajor: 0,
  pentaMinor: 5,  // 小调五声 = 关系大调五声，唱名从 la 起
  blues: 5,
  bluesMajor: 0,
  harmonic: 5,   // 和声小调 = la 起的和声小调音阶
  melodic: 5,
};

// CAGED 五型与"主音落在哪根弦"的对应（保留，供对照）
const SHAPE_BY_STRING = ['E 型', 'A 型', 'D 型', 'G 型', 'C 型', 'E 型'];

const mod12 = (n) => ((n % 12) + 12) % 12;

/**
 * 指型名 = 该指型最低音在"关系大调"里的唱名。
 * 大调：do re mi fa sol la ti；小调：la ti do re mi fa sol。
 * 不在关系大调里的音（布鲁斯的 b5、和声小调的 b6 等）就近取唱名加升降号。
 */
export function shapeName(scale, d) {
  const shift = SCALE_SHIFT[scale.id] ?? 0;
  const label = scale.degrees[d] || String(d + 1);
  const base = Number((label.match(/\d+/) || ['1'])[0]); // 级数本体，如 b3 → 3

  // 该级数在"关系大调"里的唱名：大调 do…ti，小调 la do re mi fa sol
  const idx = (shift + base - 1) % 7;
  const natural = mod12(MAJOR_SEMIS[idx] - MAJOR_SEMIS[shift]);
  const actual = mod12(scale.offsets[d]);

  let diff = actual - natural;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;

  const acc = diff === 0 ? '' : diff > 0 ? '♯' : '♭';
  return SOLFEGE[idx] + acc;
}

/**
 * 窗口内属于音阶的音，按弦分组（窗口内有几个就留几个，教材指型就是这样切的）。
 * 四品窗口内单弦最多 3 个音，多出来的属于隔壁把位，丢掉。
 */
function notesInWindow(pcs, lo, hi, maxPerString = 3) {
  const perString = [];
  for (let s = 0; s < 6; s++) {
    const open = TUNING.openMidi[s];
    const frets = [];
    for (let f = Math.max(0, lo); f <= hi; f++) {
      const pc = mod12(open + f);
      const di = pcs.indexOf(pc);
      if (di >= 0) frets.push({ fret: f, degreeIndex: di, isRoot: di === 0, pc });
    }
    perString.push(frets.length > maxPerString ? frets.slice(0, maxPerString) : frets);
  }
  return perString;
}

/**
 * 把位指法：一个把位 = 左手四根手指各管一品，
 * 所以第 low 品用 1 指、low+3 品用 4 指；空弦不标。
 */
function positionFingers(perString, low) {
  // 空把位（有 0 品）时 1 指落在 1 品，而不是 0 品
  const base = low === 0 ? 1 : low;
  perString.forEach((notes) => {
    notes.forEach((n) => {
      n.finger = n.fret === 0 ? 0 : Math.min(4, n.fret - base + 1);
    });
  });
}

/**
 * 每弦三音的指法：最低音 1 指、最高音 4 指，
 * 中间那个音离哪个更近就用 2 或 3 指。
 */
function npsFingers(perString) {
  perString.forEach((notes) => {
    notes.forEach((n, i) => {
      if (n.fret === 0) n.finger = 0;
      else if (notes.length === 1) n.finger = 1;
      else if (i === 0) n.finger = 1;
      else if (i === notes.length - 1) n.finger = 4;
      else if (n.fret - notes[i - 1].fret === 1) n.finger = 2;
      else if (notes[i + 1].fret - n.fret === 1) n.finger = 3;
      else n.finger = 2;
    });
  });
}

/** 把 perString 拉平成演奏顺序（6 弦 → 1 弦，每弦低品 → 高品） */
function flatten(perString) {
  const out = [];
  perString.forEach((notes, s) => {
    notes.forEach((n) => out.push({ stringIndex: s, ...n }));
  });
  return out;
}

const fretRange = (perString) => {
  const frets = perString.flat().map((n) => n.fret);
  return { lo: Math.min(...frets), hi: Math.max(...frets) };
};

/**
 * 把位型（教材里的"一个把位"）。这里有两条互相独立的规则，别把它们压成一个数：
 *
 *   1) 框画在哪：窗口 = [主音−1, 主音+3]，共五格。框是给人看"手放在哪"的。
 *   2) 音从哪收：6 弦是指型的起点，只收主音及以上的品（6 弦 [主音−1] 上那个音
 *      不亮也不响，否则谱子第一个音就不是主音了）；其余五根弦从 [主音−1] 起全收。
 *
 * 之前把"框的左边界"和"取音起点"当成同一个 lo，于是要么丢 A/D/B、要么冒出
 * 6 弦 7 品的 B，怎么挪都错。现在边界和起点分开。
 */
export function positionShape(rootPc, pcs, degrees, d, opts = {}) {
  const maxFret = opts.maxFret ?? MAX_FRET_DEFAULT;
  const anchor = mod12(pcs[d] - TUNING.openMidi[0]);
  const lo = Math.max(0, anchor - 1);
  const hi = Math.min(anchor + 3, maxFret);
  const perString = notesInWindow(pcs, lo, hi, 4);

  // 6 弦从主音起：指型的第一个音必须是这一型的级数
  perString[0] = perString[0].filter((n) => n.fret >= anchor);

  // 五格框里同一个音高可能出现两次（相邻两弦差 4 或 5 品）。只留一个：
  // 留"主音那一格及右侧"的位置，左侧那一格（主音−1）上的重复音丢掉。
  // 不处理就成了"2、3 弦两个 F"那种错谱（C 大调 ti 型的 2 弦 6 品、fa 型的 2 弦 0 品）。
  const byPitch = new Map();
  perString.forEach((notes, s) => notes.forEach((n) => {
    const midi = TUNING.openMidi[s] + n.fret;
    const cur = byPitch.get(midi);
    if (!cur) byPitch.set(midi, n);
    else if (cur.fret < anchor && n.fret >= anchor) byPitch.set(midi, n);
  }));
  const keep = new Set(byPitch.values());
  for (let s = 0; s < 6; s++) perString[s] = perString[s].filter((n) => keep.has(n));

  positionFingers(perString, lo);
  const range = fretRange(perString);

  return {
    kind: 'pos',
    degree: d,
    lo: range.lo,
    hi: range.hi,
    anchorFret: anchor,
    perString,
    noteCount: perString.flat().length,
    notes: flatten(perString),
    _degrees: degrees,
  };
}

/**
 * 每弦三音型：从 6 弦该级数起，每根弦正好 3 个连续音阶音，
 * 音高必须一路往上走（换弦不回头）。
 */
export function threeNpsShape(rootPc, pcs, d, opts = {}) {
  // 每弦三音天然比把位型宽 1-2 品，多留一点余量
  const maxFret = (opts.maxFret ?? MAX_FRET_DEFAULT) + 3;
  const startMidi = 36;
  const endMidi = 110;

  const scaleMidis = [];
  for (let m = startMidi; m <= endMidi; m++) if (pcs.includes(mod12(m))) scaleMidis.push(m);

  const targetPc = pcs[d];
  let best = null;

  for (let idx = 0; idx < scaleMidis.length; idx++) {
    if (mod12(scaleMidis[idx]) !== targetPc) continue;
    const startFret = scaleMidis[idx] - TUNING.openMidi[0];
    if (startFret < 0 || startFret > 14) continue;

    const perString = [];
    let cur = idx;
    let ok = true;
    for (let s = 0; s < 6 && ok; s++) {
      const group = [];
      for (let k = 0; k < 3; k++) {
        const midi = scaleMidis[cur + k];
        if (midi === undefined) { ok = false; break; }
        const fret = midi - TUNING.openMidi[s];
        if (fret < 0 || fret > maxFret) { ok = false; break; }
        group.push({
          fret,
          degreeIndex: pcs.indexOf(mod12(midi)),
          isRoot: mod12(midi) === rootPc,
          pc: mod12(midi),
        });
      }
      // 三音跨品过多就不是能弹的指型了
      if (ok) {
        const span = group[2].fret - group[0].fret;
        if (span > 5) ok = false;
      }
      if (ok) perString.push(group);
      cur += 3;
    }
    if (!ok) continue;

    const maxUsed = Math.max(...perString.flat().map((n) => n.fret));
    if (!best || maxUsed < best.maxUsed) best = { perString, maxUsed, startFret };
  }

  if (!best) return null;
  npsFingers(best.perString);
  const range = fretRange(best.perString);
  return {
    kind: '3nps',
    degree: d,
    lo: range.lo,
    hi: range.hi,
    anchorFret: best.startFret,
    perString: best.perString,
    noteCount: best.perString.flat().length,
    notes: flatten(best.perString),
  };
}

/**
 * 生成全部指型
 * 返回 [{ degree, name, degreeLabel, noteName, anchorFret, pos, nps }]
 */
export function buildShapes(rootPc, pcs, scale, opts = {}) {
  const maxFret = opts.maxFret ?? MAX_FRET_DEFAULT;
  const names = opts.noteNames || [];
  // 不足 7 个音时，每弦三音要跨三个八度以上，琴颈上放不下，统一不生成
  const npsOk = pcs.length >= 7;

  return pcs.map((pc, d) => ({
    degree: d,
    name: shapeName(scale, d),
    degreeLabel: scale.degrees[d],
    noteName: names[d] || '',
    pos: positionShape(rootPc, pcs, scale.degrees, d, { maxFret }),
    nps: npsOk ? threeNpsShape(rootPc, pcs, d, { maxFret }) : null,
  }));
}

/**
 * 可选对照：CAGED 五型（主音落在 5 根不同弦上 → 5 个窗口）
 */
export function cagedPositions(rootPc, pcs, opts = {}) {
  const maxFret = opts.maxFret ?? MAX_FRET_DEFAULT;
  const boxes = [];

  for (let s = 0; s <= 4; s++) {
    const fret = mod12(rootPc - TUNING.openMidi[s]);
    const candA = notesInWindow(pcs, fret - 1, Math.min(fret + 2, maxFret));
    const candB = notesInWindow(pcs, fret, Math.min(fret + 3, maxFret));
    const countA = candA.flat().length;
    const countB = candB.flat().length;
    const perString = countB >= countA ? candB : candA;
    const range = fretRange(perString);

    boxes.push({
      kind: 'caged',
      anchorString: s,
      anchorFret: fret,
      shape: SHAPE_BY_STRING[s],
      lo: range.lo,
      hi: range.hi,
      perString,
      noteCount: perString.flat().length,
      notes: flatten(perString),
    });
  }

  return boxes.sort((x, y) => x.lo - y.lo || x.anchorFret - y.anchorFret);
}
