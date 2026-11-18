// 极简拨弦合成：三个振荡器叠一点低通，指板图和六线谱共用

let audioCtx = null;

export function getAudioContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  // 浏览器要求用户交互后才能出声，第一次点击时可能还是 suspended
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export function playMidi(midi, dur = 0.7) {
  const ac = getAudioContext();
  if (!ac) return;

  const t = ac.currentTime;
  const freq = 440 * Math.pow(2, (midi - 69) / 12);

  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(6000, freq * 6), t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(600, freq * 2), t + dur);

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.2, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  [
    ['triangle', 1, 0.6],
    ['sine', 1, 0.35],
    ['sawtooth', 2, 0.08], // 泛音，给一点拨弦的毛刺
  ].forEach(([type, mult, level]) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq * mult;
    g.gain.value = level;
    osc.connect(g).connect(filter);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  });

  filter.connect(gain).connect(ac.destination);
}
