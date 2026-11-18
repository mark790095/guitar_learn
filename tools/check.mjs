// 命令行抽查：node tools/check.mjs <主音pc> <音阶id> [指型级数]
import { getScale, spellScale, scalePitchClasses } from '../js/theory.js';
import { buildShapes } from '../js/patterns.js';

const [, , rootArg = '0', scaleId = 'major', shapeArg] = process.argv;
const rootPc = Number(rootArg);
const scale = getScale(scaleId);
const pcs = scalePitchClasses(rootPc, scale);
const names = spellScale(rootPc, scale, false);
const shapes = buildShapes(rootPc, pcs, scale, { maxFret: 15, noteNames: names });

const STRINGS = ['E', 'A', 'D', 'G', 'B', 'e'];

function draw(label, p) {
  console.log(`\n[${label}] 窗口 ${p.lo}–${p.hi} 品 · ${p.noteCount} 音`);
  p.perString.forEach((notes, s) => {
    if (!notes.length) { console.log(`${STRINGS[s]}| -`); return; }
    let line = '';
    let cur = 0;
    notes.forEach((n) => {
      while (cur < n.fret) { line += '---'; cur++; }
      line += `${n.isRoot ? '*' : ' '}${String(n.fret).padStart(2)}`;
      cur++;
    });
    console.log(`${STRINGS[s]}|${line}`);
  });
}

const picked = shapeArg ? shapes.filter((s) => String(s.degree) === shapeArg) : shapes;

picked.forEach((s) => {
  console.log(`\n=== ${s.name} 指型（${s.degreeLabel} 级，最低音 ${s.noteName}） ===`);
  draw('把位', s.pos);
  if (s.nps) draw('每弦三音', s.nps);
  else console.log('\n[每弦三音] 超出最高品，未生成');
});
