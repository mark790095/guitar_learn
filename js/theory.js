// 乐理核心：音名、音阶定义、和弦定义、拼写
// 音高用 0-11 的 pitch class，C = 0

export const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// 12 个主音，每个给升号名与降号名，用于正确拼写
export const ROOTS = [
  { pc: 0,  sharp: 'C',  flat: 'C'  },
  { pc: 1,  sharp: 'C#', flat: 'Db' },
  { pc: 2,  sharp: 'D',  flat: 'D'  },
  { pc: 3,  sharp: 'D#', flat: 'Eb' },
  { pc: 4,  sharp: 'E',  flat: 'E'  },
  { pc: 5,  sharp: 'F',  flat: 'F'  },
  { pc: 6,  sharp: 'F#', flat: 'Gb' },
  { pc: 7,  sharp: 'G',  flat: 'G'  },
  { pc: 8,  sharp: 'G#', flat: 'Ab' },
  { pc: 9,  sharp: 'A',  flat: 'A'  },
  { pc: 10, sharp: 'A#', flat: 'Bb' },
  { pc: 11, sharp: 'B',  flat: 'B'  },
];

// 音阶库。degrees 用级数标记，UI 直接显示
// sound = 听感，use = 什么时候用（下拉旁边那行说明就是从这两个字段来的）
export const SCALE_GROUPS = [
  {
    group: '大小调',
    scales: [
      {
        id: 'major', name: '大调（自然大调 Ionian）',
        offsets: [0, 2, 4, 5, 7, 9, 11], degrees: ['1', '2', '3', '4', '5', '6', '7'],
        sound: '明亮、稳定，所有调式的参照系',
        use: '先当标尺用：另外六个指型都能在它里面找到对应把位',
      },
      {
        id: 'minor', name: '自然小调（Aeolian）',
        offsets: [0, 2, 3, 5, 7, 8, 10], degrees: ['1', '2', 'b3', '4', '5', 'b6', 'b7'],
        sound: '暗淡、抒情，最常用的"小调"',
        use: '流行/摇滚抒情段的主力；要回大调主和弦时再切和声小调',
      },
      {
        id: 'harmonic', name: '和声小调',
        offsets: [0, 2, 3, 5, 7, 8, 11], degrees: ['1', '2', 'b3', '4', '5', 'b6', '7'],
        sound: '带古典/异域味，b6 到 7 之间有个增二度',
        use: '配 V7（Am 里的 E7）时用；在 Im 上久停会显得"发酸"',
      },
      {
        id: 'melodic', name: '旋律小调（上行）',
        offsets: [0, 2, 3, 5, 7, 9, 11], degrees: ['1', '2', 'b3', '4', '5', '6', '7'],
        sound: '小调里"变亮"的版本，6、7 级都升高',
        use: '爵士小调即兴的默认音阶；古典演奏下行要还原成自然小调',
      },
      {
        id: 'harmMajor', name: '和声大调',
        offsets: [0, 2, 4, 5, 7, 8, 11], degrees: ['1', '2', '3', '4', '5', 'b6', '7'],
        sound: '大调里冒出个 b6，听着"悬"',
        use: '少见；配 IVm 或 bVI 和弦时才有意义',
      },
    ],
  },
  {
    group: '教会调式',
    scales: [
      {
        id: 'dorian', name: 'Dorian',
        offsets: [0, 2, 3, 5, 7, 9, 10], degrees: ['1', '2', 'b3', '4', '5', '6', 'b7'],
        sound: '小调但 6 级是大的，偏"酷"不悲',
        use: 'funk / 爵士里配 m7：Dm7 就用 D Dorian',
      },
      {
        id: 'phrygian', name: 'Phrygian',
        offsets: [0, 1, 3, 5, 7, 8, 10], degrees: ['1', 'b2', 'b3', '4', '5', 'b6', 'b7'],
        sound: 'b2 带来的西班牙 / 弗拉门戈味',
        use: '配 m7 或 sus4(b9)；金属 riff 常用',
      },
      {
        id: 'lydian', name: 'Lydian',
        offsets: [0, 2, 4, 6, 7, 9, 11], degrees: ['1', '2', '3', '#4', '5', '6', '7'],
        sound: '#4 让它"飘"，大调里最梦幻的',
        use: '配 maj7(#11)；电影配乐里到处都是',
      },
      {
        id: 'mixolydian', name: 'Mixolydian',
        offsets: [0, 2, 4, 5, 7, 9, 10], degrees: ['1', '2', '3', '4', '5', '6', 'b7'],
        sound: '大调但 b7，属七和弦的"母音阶"',
        use: '配 X7：blues、摇滚 riff 的主力',
      },
      {
        id: 'locrian', name: 'Locrian',
        offsets: [0, 1, 3, 5, 6, 8, 10], degrees: ['1', 'b2', 'b3', '4', 'b5', 'b6', 'b7'],
        sound: 'b5 让它最不稳定，几乎没有"家"',
        use: '配 m7b5；多数时候只是 ii° 上的短暂经过',
      },
    ],
  },
  {
    group: '五声 / 布鲁斯',
    scales: [
      {
        id: 'pentaMajor', name: '大调五声',
        offsets: [0, 2, 4, 7, 9], degrees: ['1', '2', '3', '5', '6'],
        sound: '干净、开阔，没有半音冲突',
        use: '大调/属和弦上怎么弹都不难听，solo 入门首选',
      },
      {
        id: 'pentaMinor', name: '小调五声',
        offsets: [0, 3, 5, 7, 10], degrees: ['1', 'b3', '4', '5', 'b7'],
        sound: '摇滚 / 布鲁斯的"母语"',
        use: '配 m7，也配大调里的 vi；加 b5 就是布鲁斯音阶',
      },
      {
        id: 'blues', name: '布鲁斯音阶',
        offsets: [0, 3, 5, 6, 7, 10], degrees: ['1', 'b3', '4', 'b5', '5', 'b7'],
        sound: 'b5 那个"脏音"就是味道来源',
        use: '小调布鲁斯；b5 当经过音用，别在上面停',
      },
      {
        id: 'bluesMajor', name: '大调布鲁斯',
        offsets: [0, 2, 3, 4, 7, 9], degrees: ['1', '2', 'b3', '3', '5', '6'],
        sound: '大调里掺 b3，乡村 / 摇滚味',
        use: '配 I7、IV7，和 Mixolydian 换着用',
      },
    ],
  },
  {
    group: '对称 / 变化音阶',
    scales: [
      {
        id: 'wholeTone', name: '全音音阶',
        offsets: [0, 2, 4, 6, 8, 10], degrees: ['1', '2', '3', '#4', '#5', 'b7'],
        sound: '全是大二度，方向感被抹平，像"悬浮"',
        use: '配 7#5；一个和弦上别停超过两拍',
      },
      {
        id: 'diminished', name: '减音阶（全半）',
        offsets: [0, 2, 3, 5, 6, 8, 9, 11], degrees: ['1', '2', 'b3', '4', 'b5', 'b6', '6', '7'],
        sound: '对称：每三个半音重复一次',
        use: '配 7b9 / 减和弦；对称意味着同一个指型可用三个位置',
      },
      {
        id: 'lydianDom', name: 'Lydian Dominant',
        offsets: [0, 2, 4, 6, 7, 9, 10], degrees: ['1', '2', '3', '#4', '5', '6', 'b7'],
        sound: '#4 + b7，属七里最"现代"的一个',
        use: '配 7#11；旋律小调的第四模式',
      },
      {
        id: 'altered', name: '变化音阶（Super Locrian）',
        offsets: [0, 1, 3, 4, 6, 8, 10], degrees: ['1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'],
        sound: '所有变化音都往里塞，最紧张',
        use: '配 7alt，解决到 I 之前那一两拍用',
      },
      {
        id: 'phrygianDom', name: 'Phrygian Dominant',
        offsets: [0, 1, 4, 5, 7, 8, 10], degrees: ['1', 'b2', '3', '4', '5', 'b6', 'b7'],
        sound: 'b2 + 大三度，西班牙 / 中东味最重',
        use: '配 7b9（比如 Am 里的 E7）',
      },
    ],
  },
];

export const ALL_SCALES = SCALE_GROUPS.flatMap((g) => g.scales);

// 曾经作为独立条目存在过的两个名字，老存档和老链接仍然能用
const SCALE_ALIASES = { ionian: 'major', aeolian: 'minor' };

export const getScale = (id) => {
  const key = SCALE_ALIASES[id] || id;
  return ALL_SCALES.find((s) => s.id === key) || ALL_SCALES[0];
};

/** 音阶所属的家族（下拉里的分组名），给说明文案用 */
export function scaleFamily(scale) {
  const g = SCALE_GROUPS.find((x) => x.scales.includes(scale));
  return g ? g.group : '';
}

// ---- 和弦 --------------------------------------------------------------
// degrees 是和弦内部的音级写法（R / b3 / 5 / b7 …），和音阶级数的 1..7 区分开
export const CHORDS = [
  { id: 'maj',   name: '大三和弦',  suffix: '',     intervals: [0, 4, 7],      degrees: ['R', '3', '5'] },
  { id: 'min',   name: '小三和弦',  suffix: 'm',    intervals: [0, 3, 7],      degrees: ['R', 'b3', '5'] },
  { id: 'dom7',  name: '属七和弦',  suffix: '7',    intervals: [0, 4, 7, 10],  degrees: ['R', '3', '5', 'b7'] },
  { id: 'maj7',  name: '大七和弦',  suffix: 'maj7', intervals: [0, 4, 7, 11],  degrees: ['R', '3', '5', '7'] },
  { id: 'min7',  name: '小七和弦',  suffix: 'm7',   intervals: [0, 3, 7, 10],  degrees: ['R', 'b3', '5', 'b7'] },
  { id: 'dim',   name: '减三和弦',  suffix: 'dim',  intervals: [0, 3, 6],      degrees: ['R', 'b3', 'b5'] },
  { id: 'm7b5',  name: '半减七和弦', suffix: 'm7b5', intervals: [0, 3, 6, 10], degrees: ['R', 'b3', 'b5', 'b7'] },
  { id: 'aug',   name: '增三和弦',  suffix: 'aug',  intervals: [0, 4, 8],      degrees: ['R', '3', '#5'] },
  { id: 'sus4',  name: '挂四和弦',  suffix: 'sus4', intervals: [0, 5, 7],      degrees: ['R', '4', '5'] },
  { id: 'six',   name: '六和弦',    suffix: '6',    intervals: [0, 4, 7, 9],   degrees: ['R', '3', '5', '6'] },
  { id: 'm6',    name: '小六和弦',  suffix: 'm6',   intervals: [0, 3, 7, 9],   degrees: ['R', 'b3', '5', '6'] },
];

export const getChord = (id) => CHORDS.find((c) => c.id === id) || CHORDS[0];

/** 和弦包含的 pitch class，第一个是和弦根音 */
export function chordPitchClasses(rootPc, chord) {
  return chord.intervals.map((o) => (rootPc + o) % 12);
}

/** 和弦里每个音对应的音级写法，pc → 'R' / 'b3' … */
export function chordDegreeMap(rootPc, chord) {
  const m = new Map();
  chordPitchClasses(rootPc, chord).forEach((pc, i) => {
    if (!m.has(pc)) m.set(pc, chord.degrees[i]);
  });
  return m;
}

/** 音阶包含的 pitch class 集合，保持从主音起的顺序 */
export function scalePitchClasses(rootPc, scale) {
  return scale.offsets.map((o) => (rootPc + o) % 12);
}

export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT_NAMES  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const pcName = (pc, preferFlat) => (preferFlat ? FLAT_NAMES : SHARP_NAMES)[((pc % 12) + 12) % 12];

/**
 * 拼写音阶音名。
 * 七声音阶用字母逐级拼写（C 大调 = C D E F G A B，不会出现 A# 这种错拼）；
 * 非七声（五声、布鲁斯、全音等）无法一一对应字母，退回升/降号命名。
 */
export function spellScale(rootPc, scale, preferFlat) {
  const rootName = preferFlat ? ROOTS[rootPc].flat : ROOTS[rootPc].sharp;
  const out = [];
  const n = scale.offsets.length;

  if (n === 7) {
    const rootLetter = rootName[0];
    const li = LETTERS.indexOf(rootLetter);
    for (let i = 0; i < 7; i++) {
      const letter = LETTERS[(li + i) % 7];
      const pc = (rootPc + scale.offsets[i]) % 12;
      let diff = (pc - LETTER_PC[letter] + 12) % 12; // 0..11
      if (diff > 6) diff -= 12;                      // -5..6
      const acc = diff === 0 ? '' : diff === 1 ? '#' : diff === 2 ? '##' : diff === -1 ? 'b' : diff === -2 ? 'bb' : '';
      out.push(letter + acc);
    }
    return out;
  }

  return scale.offsets.map((o) => pcName(rootPc + o, preferFlat));
}
