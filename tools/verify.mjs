// 结构断言：node tools/verify.mjs
import {
  ALL_SCALES, CHORDS, scalePitchClasses, getScale, getChord,
  chordPitchClasses, chordDegreeMap, scaleFamily,
} from '../js/theory.js';
import { buildShapes } from '../js/patterns.js';

let fails = 0;
const fail = (msg) => { fails++; console.log('  ✗ ' + msg); };
const OPEN = [40, 45, 50, 55, 59, 64];
const mod12 = (n) => ((n % 12) + 12) % 12;

// ---- 0. 音阶库卫生：不许有重复条目，每条都要有说明 ----
const ids = ALL_SCALES.map((s) => s.id);
const names = ALL_SCALES.map((s) => s.name);
if (new Set(ids).size !== ids.length) fail('音阶 id 有重复');
if (new Set(names).size !== names.length) fail('音阶名有重复');

// 音集完全相同 = 同一条音阶换了个名字，下拉里出现两次是 bug
const seen = new Map();
ALL_SCALES.forEach((s) => {
  const key = [...s.offsets].sort((a, b) => a - b).join(',');
  if (seen.has(key)) fail(`音集重复：${s.name} 与 ${seen.get(key)}`);
  seen.set(key, s.name);
  if (!s.sound || !s.use) fail(`${s.name}: 缺 sound / use 说明`);
  if (!scaleFamily(s)) fail(`${s.name}: 没有家族分组`);
  if (s.degrees.length !== s.offsets.length) fail(`${s.name}: 级数与音数不匹配`);
});

// 老名字仍然能取到（存档兼容）
if (getScale('aeolian').id !== 'minor') fail('别名 aeolian 没映射到 minor');
if (getScale('ionian').id !== 'major') fail('别名 ionian 没映射到 major');

// ---- 0b. 和弦定义 ----
CHORDS.forEach((c) => {
  if (c.intervals[0] !== 0) fail(`${c.id}: 根音不是 0`);
  if (c.degrees.length !== c.intervals.length) fail(`${c.id}: 级数数量与音数不符`);
  if (new Set(c.intervals).size !== c.intervals.length) fail(`${c.id}: 音重复`);
  [0, 7, 11].forEach((root) => {
    const pcs = chordPitchClasses(root, c);
    if (pcs.length !== c.intervals.length) fail(`${c.id}@${root}: 音数不对`);
    c.intervals.forEach((o, i) => {
      if (pcs[i] !== (root + o) % 12) fail(`${c.id}@${root}: 第 ${i} 个音算错`);
    });
  });
});
const cmaj7 = chordPitchClasses(0, getChord('maj7')).join(',');
if (cmaj7 !== '0,4,7,11') fail(`Cmaj7 应为 0,4,7,11，实际 ${cmaj7}`);
const e7 = chordPitchClasses(4, getChord('dom7')).join(',');
if (e7 !== '4,8,11,2') fail(`E7 应为 4,8,11,2，实际 ${e7}`);
if (chordDegreeMap(4, getChord('dom7')).get(8) !== '3') fail('E7 的 G# 应该写作 3');

// ---- 1. 结构断言：任何一个调、任何一种音阶 ----
for (let rootPc = 0; rootPc < 12; rootPc++) {
  for (const scale of ALL_SCALES) {
    const pcs = scalePitchClasses(rootPc, scale);
    const shapes = buildShapes(rootPc, pcs, scale, { maxFret: 15 });
    const tag = `${rootPc}/${scale.id}`;

    if (shapes.length !== pcs.length) fail(`${tag}: 指型数量 ${shapes.length} ≠ ${pcs.length}`);

    shapes.forEach((s) => {
      const p = s.pos;

      // 规则 1：6 弦是指型起点 —— 第一个音就是这一型的级数，6 弦不许有更低的品
      const line6 = p.perString[0];
      const first = line6[0];
      if (!first || first.fret !== p.anchorFret) fail(`${tag} ${s.name}: 6 弦第一个音不是主音（${first ? first.fret + ' 品' : '空'}）`);
      if (!first || mod12(OPEN[0] + p.anchorFret) !== pcs[s.degree]) fail(`${tag} ${s.name}: 起点音不对`);
      if (line6.some((n) => n.fret < p.anchorFret)) fail(`${tag} ${s.name}: 6 弦在 ${p.anchorFret} 品以下还有音`);

      // 规则 2：框 = [主音−1, 主音+3]；框内（6 弦从主音起）的音阶音一个不许漏，框外一个不许有
      const boxLo = Math.max(0, p.anchorFret - 1);
      const boxHi = p.anchorFret + 3;
      p.perString.forEach((g, si) => {
        const from = si === 0 ? p.anchorFret : boxLo;
        g.forEach((n) => {
          if (n.fret < from || n.fret > boxHi) {
            fail(`${tag} ${s.name} 把位: 第 ${si + 1} 弦 ${n.fret} 品在框外（${from}–${boxHi}）`);
          }
        });
        for (let f = from; f <= boxHi; f++) {
          if (!pcs.includes(mod12(OPEN[si] + f))) continue;
          if (g.some((n) => n.fret === f)) continue;
          // 被"同音高只留一个"收走的音不算漏：同一个音高必须确实还按得到
          const midi = OPEN[si] + f;
          const kept = p.notes.some((n) => OPEN[n.stringIndex] + n.fret === midi);
          if (!kept) fail(`${tag} ${s.name} 把位: 第 ${si + 1} 弦 ${f} 品漏音`);
        }
        if (g.length < 1 || g.length > 4) fail(`${tag} ${s.name} 把位: 第 ${si + 1} 弦 ${g.length} 音`);
      });

      // 同一个音高不许在两根弦上各出现一次（"2、3 弦两个 F"就是这么来的）
      const midis = p.notes.map((n) => OPEN[n.stringIndex] + n.fret);
      if (new Set(midis).size !== midis.length) {
        const dup = midis.filter((m, i) => midis.indexOf(m) !== i);
        fail(`${tag} ${s.name} 把位: 音高重复（midi ${[...new Set(dup)].join(',')}）`);
      }

      const have = new Set(p.notes.map((n) => n.pc));
      if (have.size !== pcs.length) fail(`${tag} ${s.name} 把位: 只含 ${have.size}/${pcs.length} 个音阶音`);

      // 指法编号必须落在 1–4（空弦记 0）
      p.notes.forEach((n) => {
        if (n.fret > 0 && (n.finger < 1 || n.finger > 4)) fail(`${tag} ${s.name} 把位: 指法 ${n.finger}`);
      });

      // 每弦三音
      if (s.nps) {
        const q = s.nps;
        q.perString.forEach((g, si) => {
          if (g.length !== 3) fail(`${tag} ${s.name} 3NPS: 第 ${si + 1} 弦 ${g.length} 音`);
        });
        const flat = q.notes.map((n) => n.fret + OPEN[n.stringIndex]);
        for (let i = 1; i < flat.length; i++) {
          if (flat[i] <= flat[i - 1]) fail(`${tag} ${s.name} 3NPS: 音高未递增 @${i}`);
        }
      }
    });
  }
}

// ---- 2. 对照标准教材：C 大调六型（Do / Mi / Sol / La / Si / Re）----
// 数据取自通行的五个把位图，用来反查算法切得对不对
const C_MAJOR_BOOK = {
  do:  [[8, 10], [7, 8, 10], [9, 10], [9, 10], [8, 10], [8, 10]],
  mi:  [[0, 1, 3], [0, 2, 3], [0, 2, 3], [0, 2], [0, 1, 3], [0, 1, 3]],
  sol: [[3, 5], [3, 5], [3, 5], [4, 5], [5, 6], [3, 5]],
  la:  [[5, 7, 8], [5, 7, 8], [5, 7], [5, 7], [5, 6, 8], [5, 7, 8]],
  si:  [[7, 8, 10], [7, 8, 10], [7, 9, 10], [7, 9], [8, 10], [7, 8, 10]],
  re:  [[10, 12], [10, 12], [10, 12], [10, 12], [10, 12, 13], [10, 12]],
};

const cMajor = getScale('major');
const cShapes = buildShapes(0, scalePitchClasses(0, cMajor), cMajor, { maxFret: 15 });
const byAnchor = {};
cShapes.forEach((s) => { byAnchor[s.pos.anchorFret] = s; });

const ANCHOR_OF = { do: 8, mi: 0, sol: 3, la: 5, si: 7, re: 10 };
Object.entries(C_MAJOR_BOOK).forEach(([name, book]) => {
  const s = byAnchor[ANCHOR_OF[name]];
  if (!s) { fail(`对照 ${name} 型: 没生成`); return; }
  const got = s.pos.perString.map((g) => g.map((n) => n.fret));
  // 教材的 CAGED 五型会剪掉四品窗口边上的重复音，所以只要求"教材的音全都有"。
  // 多出来的音必须是同一把位窗口内的，不能跑到别的把位去。
  book.forEach((expectLine, si) => {
    const gotLine = got[si];
    expectLine.forEach((f) => {
      if (!gotLine.includes(f)) {
        fail(`对照 ${name} 型 第 ${6 - si} 弦: 缺 ${f} 品（生成 [${gotLine.join(',')}]）`);
      }
    });
    gotLine.forEach((f) => {
      if (f < s.pos.lo || f > s.pos.hi) {
        fail(`对照 ${name} 型 第 ${6 - si} 弦: ${f} 品超出把位 ${s.pos.lo}–${s.pos.hi}`);
      }
    });
  });
});

console.log(fails === 0
  ? `全部通过：12 调 × ${ALL_SCALES.length} 音阶 + ${CHORDS.length} 种和弦 + C 大调六型对照`
  : `失败 ${fails} 项`);
