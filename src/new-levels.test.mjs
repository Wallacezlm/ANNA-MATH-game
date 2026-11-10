import assert from 'node:assert/strict';
import test from 'node:test';
import {
  answerValue,
  findProblem,
  gcd,
  isImportableMistake,
  levels,
  problems,
  selectRound,
  simplify,
} from './new-levels.mjs';

const ids = levels.map((level) => level.id);

function valueOf(answer) {
  if (typeof answer === 'number') return answer;
  if (typeof answer === 'string' && answer.includes('/')) {
    const [numerator, denominator] = answer.split('/').map(Number);
    return numerator / denominator;
  }
  return null;
}

test('最简分数不用浮点，等值分数得到同一答案', () => {
  assert.equal(gcd(12, 18), 6);
  assert.deepEqual(simplify(2, 4), [1, 2]);
  assert.deepEqual(simplify(4, 2), [2, 1]);
  assert.deepEqual(simplify(0, 5), [0, 1]);
  assert.equal(answerValue(2, 4), '1/2');
  assert.equal(answerValue(4, 2), 2);
  assert.equal(answerValue(6, 12), '1/2');
  assert.equal(answerValue(2, 4), answerValue(6, 12));
  assert.throws(() => simplify(1, 0));
});

test('每种新关卡都有足够的不重复答案', () => {
  assert.equal(ids.length, 8);
  for (const level of levels) {
    const list = problems(level.id);
    assert.ok(list.length >= 12, level.id);
    const answers = new Set(list.map((problem) => String(problem.answer)));
    assert.ok(answers.size >= 12, level.id);
    for (const problem of list) {
      assert.equal(problem.category, level.id);
      assert.equal(problem.categoryName, level.name);
      assert.equal(typeof problem.expression, 'string');
      assert.ok(problem.expression.length > 0);
    }
  }
});

test('100以内加法的操作数与和都在 0～100', () => {
  const list = problems('add-100');
  assert.ok(findProblem('add-100', '0 + 0'));
  assert.ok(findProblem('add-100', '0 + 100'));
  assert.ok(findProblem('add-100', '100 + 0'));
  assert.ok(findProblem('add-100', '50 + 50'));
  assert.equal(findProblem('add-100', '49 + 52'), null);
  assert.equal(findProblem('add-100', '100 + 1'), null);
  for (const problem of list) {
    const match = problem.expression.match(/^(\d+) \+ (\d+)$/);
    assert.ok(match, problem.expression);
    const left = Number(match[1]);
    const right = Number(match[2]);
    assert.ok(left >= 0 && left <= 100 && right >= 0 && right <= 100);
    assert.equal(problem.answer, left + right);
    assert.ok(problem.answer >= 0 && problem.answer <= 100);
  }
});

test('100以内减法结果不为负', () => {
  const list = problems('sub-100');
  assert.equal(findProblem('sub-100', '100 - 0').answer, 100);
  assert.equal(findProblem('sub-100', '100 - 100').answer, 0);
  assert.equal(findProblem('sub-100', '0 - 1'), null);
  for (const problem of list) {
    const match = problem.expression.match(/^(\d+) - (\d+)$/);
    assert.ok(match, problem.expression);
    const left = Number(match[1]);
    const right = Number(match[2]);
    assert.ok(left >= 0 && left <= 100 && right >= 0 && right <= left);
    assert.equal(problem.answer, left - right);
    assert.ok(problem.answer >= 0);
  }
});

test('100以内加减混合同时包含加法和减法', () => {
  const list = problems('addsub-100');
  assert.ok(list.some((problem) => problem.expression.includes('+')));
  assert.ok(list.some((problem) => problem.expression.includes('-')));
  assert.equal(findProblem('addsub-100', '80 + 20').answer, 100);
  assert.equal(findProblem('addsub-100', '80 - 20').answer, 60);
  assert.equal(findProblem('addsub-100', '20 - 80'), null);
});

test('有余数除法按商和余数匹配，不能只看商', () => {
  const list = problems('rem-div');
  const seventeen = findProblem('rem-div', '17 ÷ 5（有余数）');
  assert.equal(seventeen.answer, '商3余2');
  assert.equal(seventeen.quotient, 3);
  assert.equal(seventeen.remainder, 2);
  assert.equal(findProblem('rem-div', '100 ÷ 9（有余数）').answer, '商11余1');
  assert.equal(findProblem('rem-div', '7 ÷ 3（有余数）').answer, '商2余1');
  assert.equal(findProblem('rem-div', '8 ÷ 4（有余数）'), null);
  assert.equal(findProblem('rem-div', '3 ÷ 5（有余数）'), null);
  const sameQuotient = list.filter((problem) => problem.quotient === 3);
  const remainders = new Set(sameQuotient.map((problem) => problem.remainder));
  assert.ok(remainders.size > 1);
  for (const problem of list) {
    assert.ok(problem.dividend >= 1 && problem.dividend <= 100);
    assert.ok(problem.divisor >= 2 && problem.divisor <= 9);
    assert.ok(problem.remainder > 0 && problem.remainder < problem.divisor);
    assert.equal(problem.dividend, problem.quotient * problem.divisor + problem.remainder);
    assert.match(problem.answer, /^商\d+余\d+$/);
    assert.notEqual(problem.answer, String(problem.quotient));
  }
  const round = selectRound([
    { expression: '17 ÷ 5（有余数）', answer: '商3余2' },
    { expression: '13 ÷ 4（有余数）', answer: '商3余1' },
  ], 2);
  assert.equal(round.length, 2);
});

test('四种分数运算约分后一致，减法非负，除数非零', () => {
  assert.equal(findProblem('frac-add', '1/2 + 1/2').answer, 1);
  assert.equal(findProblem('frac-add', '1/4 + 1/4').answer, '1/2');
  assert.equal(findProblem('frac-add', '1/6 + 1/3').answer, '1/2');
  assert.equal(findProblem('frac-sub', '3/4 - 1/4').answer, '1/2');
  assert.equal(findProblem('frac-sub', '1/2 - 1/2').answer, 0);
  assert.equal(findProblem('frac-sub', '1/4 - 1/2'), null);
  assert.equal(findProblem('frac-mul', '2/3 × 3/4').answer, '1/2');
  assert.equal(findProblem('frac-div', '1/2 ÷ 1/4').answer, 2);
  assert.equal(findProblem('frac-div', '1/2 ÷ 0/1'), null);

  for (const id of ['frac-add', 'frac-sub', 'frac-mul', 'frac-div']) {
    for (const problem of problems(id)) {
      assert.equal(problem.expression.includes('/0'), false);
      if (typeof problem.answer === 'string') {
        assert.match(problem.answer, /^\d+\/\d+$/);
        const [numerator, denominator] = problem.answer.split('/').map(Number);
        assert.equal(gcd(numerator, denominator), 1);
        assert.ok(denominator > 1);
      } else {
        assert.equal(Number.isInteger(problem.answer), true);
        assert.ok(problem.answer >= 0);
      }
      assert.ok(valueOf(problem.answer) >= 0);
    }
  }
});

test('同一轮不会留下等价答案', () => {
  const collided = selectRound([
    { expression: '1/4 + 1/4', answer: '1/2' },
    { expression: '1/6 + 1/3', answer: '1/2' },
    { expression: '2/4 + 0/1', answer: '1/2' },
    { expression: '1/3 + 1/3', answer: '2/3' },
    { expression: '整数 2', answer: 2 },
    { expression: '同样是 2', answer: '2' },
  ], 6);
  const keys = collided.map((problem) => String(problem.answer));
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(keys.filter((key) => key === '1/2').length, 1);
  assert.equal(keys.filter((key) => key === '2').length, 1);

  for (const level of levels) {
    for (let roundIndex = 0; roundIndex < 30; roundIndex += 1) {
      const round = selectRound(problems(level.id), 6);
      assert.equal(round.length, 6, level.id);
      const keysInRound = round.map((problem) => String(problem.answer));
      assert.equal(new Set(keysInRound).size, 6, level.id);
    }
  }
});

test('旧错题仍是可导入记录，新答案也可以保留', () => {
  assert.equal(isImportableMistake({
    id: 'mistake_keep_7plus8',
    expression: '7+8',
    correctAnswer: 15,
  }), true);
  assert.equal(isImportableMistake({
    id: 'mistake_remainder',
    expression: '17 ÷ 5（有余数）',
    correctAnswer: '商3余2',
  }), true);
  assert.equal(isImportableMistake({
    id: 'mistake_fraction',
    expression: '1/4 + 1/4',
    correctAnswer: '1/2',
  }), true);
  assert.equal(isImportableMistake({ id: 'x', expression: '1+1' }), false);
  assert.equal(isImportableMistake(null), false);
});
