// 数学消消乐新增关卡。
// 原 React 工程只有构建后的 assets/index-2_2UvlOz.js。这里用整数运算生成题目，
// 并由该构建文件在关卡列表和出题时调用 globalThis.MathMatchLevels。
// 答案使用最简有理数或「商几余几」，不用浮点数比较。

export function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

export function simplify(numerator, denominator) {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator === 0) {
    throw new Error('分数的分子分母必须是整数，且分母不能为 0');
  }
  let n = numerator;
  let d = denominator;
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return [n / g, d / g];
}

// 整数写成数字；其余写成最简分数。返回值可直接作为配对答案。
export function answerValue(numerator, denominator) {
  const [n, d] = simplify(numerator, denominator);
  if (d === 1) return n;
  return `${n}/${d}`;
}

export function formatOperand(numerator, denominator) {
  const value = answerValue(numerator, denominator);
  return String(value);
}

function readable(numerator, denominator) {
  const [n, d] = simplify(numerator, denominator);
  if (n < 0) return false;
  if (d === 1) return n <= 20;
  return n <= 12 && d <= 12;
}

function fractionPool() {
  const items = [];
  for (const denominator of [2, 3, 4, 5, 6, 8, 10]) {
    for (let numerator = 1; numerator < denominator; numerator += 1) {
      items.push([numerator, denominator]);
    }
  }
  return items;
}

function addFractions(a, b) {
  return [a[0] * b[1] + b[0] * a[1], a[1] * b[1]];
}

function subtractFractions(a, b) {
  return [a[0] * b[1] - b[0] * a[1], a[1] * b[1]];
}

function multiplyFractions(a, b) {
  return [a[0] * b[0], a[1] * b[1]];
}

function divideFractions(a, b) {
  if (b[0] === 0) throw new Error('除数不能为 0');
  return [a[0] * b[1], a[1] * b[0]];
}

function compareFractions(a, b) {
  return a[0] * b[1] - b[0] * a[1];
}

function pushUnique(list, seen, problem) {
  if (seen.has(problem.expression)) return;
  seen.add(problem.expression);
  list.push(problem);
}

function buildFractionLevel(id, categoryName, symbol, operate, { requireNonNegative = false, rejectZeroDivisor = false } = {}) {
  const list = [];
  const seen = new Set();
  for (const left of fractionPool()) {
    for (const right of fractionPool()) {
      if (rejectZeroDivisor && right[0] === 0) continue;
      if (requireNonNegative && compareFractions(left, right) < 0) continue;
      const [numerator, denominator] = operate(left, right);
      if (denominator === 0 || !readable(numerator, denominator)) continue;
      const expression = `${formatOperand(...left)} ${symbol} ${formatOperand(...right)}`;
      pushUnique(list, seen, {
        id: `${id}_${expression}`,
        expression,
        answer: answerValue(numerator, denominator),
        category: id,
        categoryName,
      });
    }
  }
  return list;
}

function buildAdd100() {
  const list = [];
  for (let left = 0; left <= 100; left += 1) {
    for (let right = 0; right <= 100 - left; right += 1) {
      list.push({
        id: `add-100_${left}+${right}`,
        expression: `${left} + ${right}`,
        answer: left + right,
        category: 'add-100',
        categoryName: '100以内加法',
      });
    }
  }
  return list;
}

function buildSub100() {
  const list = [];
  for (let left = 0; left <= 100; left += 1) {
    for (let right = 0; right <= left; right += 1) {
      list.push({
        id: `sub-100_${left}-${right}`,
        expression: `${left} - ${right}`,
        answer: left - right,
        category: 'sub-100',
        categoryName: '100以内减法',
      });
    }
  }
  return list;
}

function buildAddSub100() {
  return [...buildAdd100(), ...buildSub100()].map((problem) => ({
    ...problem,
    id: `addsub-100_${problem.expression}`,
    category: 'addsub-100',
    categoryName: '100以内加减',
  }));
}

function buildRemainderDivision() {
  const list = [];
  for (let divisor = 2; divisor <= 9; divisor += 1) {
    for (let dividend = divisor + 1; dividend <= 100; dividend += 1) {
      const quotient = Math.floor(dividend / divisor);
      const remainder = dividend % divisor;
      if (quotient < 1 || remainder <= 0 || remainder >= divisor) continue;
      list.push({
        id: `rem-div_${dividend}/${divisor}`,
        expression: `${dividend} ÷ ${divisor}（有余数）`,
        answer: `商${quotient}余${remainder}`,
        category: 'rem-div',
        categoryName: '有余数的除法',
        quotient,
        remainder,
        dividend,
        divisor,
      });
    }
  }
  return list;
}

const builders = {
  'add-100': buildAdd100,
  'sub-100': buildSub100,
  'addsub-100': buildAddSub100,
  'rem-div': buildRemainderDivision,
  'frac-add': () => buildFractionLevel('frac-add', '分数加法', '+', addFractions),
  'frac-sub': () => buildFractionLevel('frac-sub', '分数减法', '-', subtractFractions, { requireNonNegative: true }),
  'frac-mul': () => buildFractionLevel('frac-mul', '分数乘法', '×', multiplyFractions),
  'frac-div': () => buildFractionLevel('frac-div', '分数除法', '÷', divideFractions, { rejectZeroDivisor: true }),
};

const cache = new Map();

export const levels = [
  {
    id: 'add-100',
    name: '100以内加法',
    shortName: '100加法',
    description: '两个加数都在 0～100，和也在 0～100。',
    grade: '二年级',
    iconName: 'PlusSquare',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  },
  {
    id: 'sub-100',
    name: '100以内减法',
    shortName: '100减法',
    description: '被减数和减数都在 0～100，结果不为负数。',
    grade: '二年级',
    iconName: 'MinusSquare',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
  },
  {
    id: 'addsub-100',
    name: '100以内加减',
    shortName: '100加减',
    description: '加法和减法混合。范围 0～100，减法结果不为负数。',
    grade: '二年级',
    iconName: 'PlusSquare',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  },
  {
    id: 'rem-div',
    name: '有余数的除法',
    shortName: '有余数',
    description: '被除数 1～100，除数 2～9。余数大于 0 且小于除数，请匹配「商几余几」，不能只看商。',
    grade: '三年级',
    iconName: 'DivideSquare',
    badgeColor: 'bg-violet-100 text-violet-800 border-violet-300',
  },
  {
    id: 'frac-add',
    name: '分数加法',
    shortName: '分数加',
    description: '小分子、小分母。答案是最简分数，整数会直接写成整数。',
    grade: '四年级',
    iconName: 'PlusCircle',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  {
    id: 'frac-sub',
    name: '分数减法',
    shortName: '分数减',
    description: '小分子、小分母，结果不为负数。答案是最简分数，整数会直接写成整数。',
    grade: '四年级',
    iconName: 'MinusCircle',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
  },
  {
    id: 'frac-mul',
    name: '分数乘法',
    shortName: '分数乘',
    description: '小分子、小分母相乘。答案先约分，整数会直接写成整数。',
    grade: '四年级',
    iconName: 'XSquare',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  },
  {
    id: 'frac-div',
    name: '分数除法',
    shortName: '分数除',
    description: '除数不能为 0。答案是最简分数，整数会直接写成整数。',
    grade: '四年级',
    iconName: 'DivideSquare',
    badgeColor: 'bg-violet-100 text-violet-800 border-violet-300',
  },
];

export function problems(id) {
  if (!builders[id]) return [];
  if (!cache.has(id)) cache.set(id, builders[id]());
  return cache.get(id).map((problem) => ({ ...problem }));
}

function shuffle(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

// 与原游戏同一规则：同一轮答案按字符串去重，避免 1/2 和 2/4、或「商3余1」和「商3余2」发生错配。
export function selectRound(list, count = 6) {
  const picked = [];
  const seen = new Set();
  for (const problem of shuffle(list)) {
    const key = String(problem.answer);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(problem);
    if (picked.length >= count) break;
  }
  return picked;
}

export function isImportableMistake(record) {
  if (!record || typeof record !== 'object') return false;
  const answerOk = typeof record.correctAnswer === 'number' || typeof record.correctAnswer === 'string';
  return typeof record.id === 'string' && typeof record.expression === 'string' && answerOk;
}

export function findProblem(id, expression) {
  return problems(id).find((problem) => problem.expression === expression) || null;
}

const api = { levels, problems, selectRound, isImportableMistake, findProblem, answerValue, gcd, simplify };
globalThis.MathMatchLevels = api;
