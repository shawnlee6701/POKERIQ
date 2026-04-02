import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculateOuts } from '../engine/outs-calculator.js';
import { generateQuestions } from '../engine/question-generator.js';

type GeneratedQuestion = ReturnType<typeof generateQuestions>[number];

type SetterReview = {
  score: number;
  issues: string[];
};

type AnswerResult = {
  selectedOptionId: string;
  isCorrect: boolean;
  strategy: string;
};

type DuplicatePair = {
  i: number;
  j: number;
  similarity: number;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEBAPP_ROOT = path.resolve(__dirname, '..', '..');
const REPORT_DIR = path.join(WEBAPP_ROOT, 'reports');

const VALID_TYPES = new Set(['outs', 'equity', 'odds', 'preflop', 'position', 'ev', 'bluff', 'style']);
const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

function getNumberArg(name: string, defaultValue: number): number {
  const arg = process.argv.find(a => a.startsWith(`${name}=`));
  if (!arg) return defaultValue;
  const value = Number(arg.split('=')[1]);
  if (!Number.isFinite(value) || value <= 0) return defaultValue;
  return Math.floor(value);
}

function getCountArg(defaultCount: number): number {
  return getNumberArg('--count', defaultCount);
}

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。！？；：、,.!?;:'"()（）[\]{}<>《》【】\-_/\\|]/g, '');
}

function toShingles(input: string, size = 3): Set<string> {
  const normalized = normalizeText(input);
  const result = new Set<string>();
  if (normalized.length <= size) {
    if (normalized) result.add(normalized);
    return result;
  }
  for (let i = 0; i <= normalized.length - size; i++) {
    result.add(normalized.slice(i, i + size));
  }
  return result;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const token of a) {
    if (b.has(token)) inter++;
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function extractFirstNumber(text: string): number | null {
  const match = text.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseOddsValue(text: string): number | null {
  const match = text.match(/(\d+(\.\d+)?)\s*:\s*1/);
  return match ? Number(match[1]) : null;
}

function parseRange(text: string): { low: number; high: number } | null {
  const match = text.match(/(\d+)\s*%\s*[~\-]\s*(\d+)\s*%/);
  if (!match) return null;
  return { low: Number(match[1]), high: Number(match[2]) };
}

function parsePlayerCount(situation: string): number {
  const match = situation.match(/(\d+)\s*人桌/);
  if (!match) return 6;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 2) return 6;
  return value;
}

function parsePotAndBet(situation: string): { potBB: number; betBB: number } | null {
  const compact = situation.replace(/\s+/g, '');

  const potPatterns: RegExp[] = [
    /底池(?:共有|经过积累达到了|里已经有了|刚好凑满|已经有)?(\d+(?:\.\d+)?)BB/,
    /底池(\d+(?:\.\d+)?)BB/,
  ];
  const betPatterns: RegExp[] = [
    /下注(?:了)?(\d+(?:\.\d+)?)BB/,
    /主动下注(\d+(?:\.\d+)?)BB/,
    /用(\d+(?:\.\d+)?)BB的下注/,
  ];

  let potBB: number | null = null;
  let betBB: number | null = null;

  for (const pattern of potPatterns) {
    const match = compact.match(pattern);
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) {
        potBB = value;
        break;
      }
    }
  }

  for (const pattern of betPatterns) {
    const match = compact.match(pattern);
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > 0) {
        betBB = value;
        break;
      }
    }
  }

  if (potBB !== null && betBB !== null) {
    return { potBB, betBB };
  }

  return null;
}

function optionValueSet(options: GeneratedQuestion['options']): string[] {
  return options.map(o => normalizeText(String(o.value))).sort();
}

function canonicalCards(cards: { rank: string; suit: string }[]): string {
  return cards.map(c => `${c.rank}-${c.suit}`).sort().join('|');
}

function getCorrectOption(question: GeneratedQuestion) {
  return question.options.find(o => o.id === question.correctOptionId);
}

function reviewQuestion(question: GeneratedQuestion): SetterReview {
  let penalty = 0;
  const issues: string[] = [];

  if (!VALID_TYPES.has(question.type)) {
    penalty += 12;
    issues.push(`未知题型: ${String(question.type)}`);
  }

  if (!VALID_DIFFICULTIES.has(question.difficulty)) {
    penalty += 8;
    issues.push(`未知难度: ${String(question.difficulty)}`);
  }

  if (!question.question?.trim()) {
    penalty += 20;
    issues.push('题干为空');
  } else if (question.question.trim().length < 6) {
    penalty += 6;
    issues.push('题干过短');
  }

  if (!question.situation?.trim()) {
    penalty += 18;
    issues.push('场景描述为空');
  } else if (question.situation.trim().length < 12) {
    penalty += 5;
    issues.push('场景描述过短');
  }

  if (!question.explanation?.trim()) {
    penalty += 14;
    issues.push('解析为空');
  } else if (question.explanation.trim().length < 20) {
    penalty += 4;
    issues.push('解析过短');
  }

  if (!Array.isArray(question.options) || question.options.length < 3) {
    penalty += 30;
    issues.push('选项不足（至少3项）');
  }

  const optionIds = new Set(question.options.map(o => o.id));
  if (optionIds.size !== question.options.length) {
    penalty += 12;
    issues.push('选项 ID 重复');
  }

  const optionValues = optionValueSet(question.options);
  if (new Set(optionValues).size !== optionValues.length) {
    penalty += 12;
    issues.push('选项文本重复');
  }

  const correct = getCorrectOption(question);
  if (!correct) {
    penalty += 35;
    issues.push('correctOptionId 不存在于选项中');
  }

  if (!Array.isArray(question.hand) || !Array.isArray(question.board)) {
    penalty += 12;
    issues.push('手牌或公共牌结构异常');
  } else {
    if (question.hand.length !== 0 && question.hand.length !== 2) {
      penalty += 7;
      issues.push(`手牌数量异常: ${question.hand.length}`);
    }
    if (question.board.length < 0 || question.board.length > 5) {
      penalty += 7;
      issues.push(`公共牌数量异常: ${question.board.length}`);
    }
  }

  if (correct && question.type === 'outs' && question.hand.length === 2 && question.board.length >= 3) {
    const expectedOuts = calculateOuts(question.hand, question.board, parsePlayerCount(question.situation)).outs;
    const selectedOuts = extractFirstNumber(String(correct.value));
    if (selectedOuts === null) {
      penalty += 10;
      issues.push('outs 题正确选项不是数字');
    } else if (Math.abs(selectedOuts - expectedOuts) > 0.01) {
      penalty += 22;
      issues.push(`outs 答案不一致: expected=${expectedOuts}, actual=${selectedOuts}`);
    }
  }

  if (correct && question.type === 'equity' && question.hand.length === 2 && question.board.length >= 3) {
    const expectedWin = Math.round(calculateOuts(question.hand, question.board, parsePlayerCount(question.situation)).win);
    const range = parseRange(String(correct.value));
    if (!range) {
      penalty += 10;
      issues.push('equity 题正确选项不是区间');
    } else if (expectedWin < range.low || expectedWin > range.high) {
      penalty += 22;
      issues.push(`equity 答案区间不一致: expected=${expectedWin}% in [${range.low}, ${range.high}]`);
    }
  }

  if (correct && question.type === 'odds') {
    const potBet = parsePotAndBet(question.situation);
    const odds = parseOddsValue(String(correct.value));
    if (!potBet) {
      penalty += 6;
      issues.push('odds 题无法解析底池与下注');
    } else if (odds === null) {
      penalty += 10;
      issues.push('odds 题正确选项格式异常');
    } else {
      const expected = Number(((potBet.potBB + potBet.betBB) / potBet.betBB).toFixed(1));
      if (Math.abs(odds - expected) > 0.11) {
        penalty += 20;
        issues.push(`odds 答案不一致: expected=${expected}, actual=${odds}`);
      }
    }
  }

  return { score: Math.max(0, 100 - penalty), issues };
}

function chooseClosestOptionByNumber(options: GeneratedQuestion['options'], target: number): string | null {
  const parsed = options
    .map(o => ({ id: o.id, value: extractFirstNumber(String(o.value)) }))
    .filter((o): o is { id: string; value: number } => o.value !== null);
  if (!parsed.length) return null;
  parsed.sort((a, b) => Math.abs(a.value - target) - Math.abs(b.value - target));
  return parsed[0].id;
}

function answerQuestion(question: GeneratedQuestion): AnswerResult {
  if (question.type === 'odds') {
    const potBet = parsePotAndBet(question.situation);
    if (potBet) {
      const expectedOdds = (potBet.potBB + potBet.betBB) / potBet.betBB;
      const candidates = question.options
        .map(o => ({ id: o.id, odds: parseOddsValue(String(o.value)) }))
        .filter((o): o is { id: string; odds: number } => o.odds !== null);
      if (candidates.length) {
        candidates.sort((a, b) => Math.abs(a.odds - expectedOdds) - Math.abs(b.odds - expectedOdds));
        const selectedOptionId = candidates[0].id;
        return {
          selectedOptionId,
          isCorrect: selectedOptionId === question.correctOptionId,
          strategy: 'formula_odds',
        };
      }
    }
  }

  if (question.type === 'outs' && question.hand.length === 2 && question.board.length >= 3) {
    const expectedOuts = calculateOuts(question.hand, question.board, parsePlayerCount(question.situation)).outs;
    const selectedOptionId = chooseClosestOptionByNumber(question.options, expectedOuts);
    if (selectedOptionId) {
      return {
        selectedOptionId,
        isCorrect: selectedOptionId === question.correctOptionId,
        strategy: 'formula_outs',
      };
    }
  }

  if (question.type === 'equity' && question.hand.length === 2 && question.board.length >= 3) {
    const expectedWin = Math.round(calculateOuts(question.hand, question.board, parsePlayerCount(question.situation)).win);
    const rangeHit = question.options.find(o => {
      const range = parseRange(String(o.value));
      if (!range) return false;
      return expectedWin >= range.low && expectedWin <= range.high;
    });
    if (rangeHit) {
      return {
        selectedOptionId: rangeHit.id,
        isCorrect: rangeHit.id === question.correctOptionId,
        strategy: 'formula_equity',
      };
    }
  }

  const idx = Math.floor(Math.random() * question.options.length);
  const selectedOptionId = question.options[idx]?.id || question.correctOptionId;
  return {
    selectedOptionId,
    isCorrect: selectedOptionId === question.correctOptionId,
    strategy: 'random_fallback',
  };
}

function buildFingerprint(question: GeneratedQuestion): string {
  const correctValue = getCorrectOption(question)?.value || '';
  return [
    question.type,
    question.difficulty,
    normalizeText(question.question || ''),
    normalizeText(question.situation || ''),
    normalizeText(String(correctValue)),
    optionValueSet(question.options).join('|'),
    canonicalCards(question.hand || []),
    canonicalCards(question.board || []),
  ].join('||');
}

function findExactDuplicates(questions: GeneratedQuestion[]) {
  const bucket = new Map<string, number[]>();
  questions.forEach((q, idx) => {
    const fp = buildFingerprint(q);
    const arr = bucket.get(fp) || [];
    arr.push(idx);
    bucket.set(fp, arr);
  });
  const groups = [...bucket.values()].filter(g => g.length > 1);
  const duplicateHits = groups.reduce((sum, g) => sum + (g.length - 1), 0);
  return { groups, duplicateHits };
}

function findNearDuplicates(questions: GeneratedQuestion[], threshold = 0.85): DuplicatePair[] {
  const shingles = questions.map(q => toShingles(`${q.type}|${q.question}|${q.situation}`));
  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < questions.length; i++) {
    for (let j = i + 1; j < questions.length; j++) {
      if (questions[i].type !== questions[j].type) continue;
      const sim = jaccard(shingles[i], shingles[j]);
      if (sim >= threshold) {
        pairs.push({ i, j, similarity: Number(sim.toFixed(3)) });
      }
    }
  }
  pairs.sort((a, b) => b.similarity - a.similarity);
  return pairs;
}

function groupCount(values: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) {
    result[value] = (result[value] || 0) + 1;
  }
  return result;
}

function formatPercent(part: number, total: number): string {
  if (total <= 0) return '0.0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

function nowStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

type AnalysisResult = {
  setterReviews: SetterReview[];
  answerResults: AnswerResult[];
  exactDup: { groups: number[][]; duplicateHits: number };
  nearDup: DuplicatePair[];
  avgSetterScore: number;
  medianSetterScore: number;
  answerCorrect: number;
  lowestScored: Array<{ index: number; score: number; issues: string[]; type: string }>;
};

function analyzeQuestions(questions: GeneratedQuestion[]): AnalysisResult {
  const setterReviews = questions.map(q => reviewQuestion(q));
  const answerResults = questions.map(q => answerQuestion(q));
  const exactDup = findExactDuplicates(questions);
  const nearDup = findNearDuplicates(questions);
  const avgSetterScore = Number(
    (setterReviews.reduce((sum, r) => sum + r.score, 0) / Math.max(questions.length, 1)).toFixed(2)
  );
  const medianSetterScore = median(setterReviews.map(r => r.score));
  const answerCorrect = answerResults.filter(r => r.isCorrect).length;
  const lowestScored = setterReviews
    .map((r, index) => ({ index, score: r.score, issues: r.issues, type: questions[index].type }))
    .sort((a, b) => a.score - b.score);

  return {
    setterReviews,
    answerResults,
    exactDup,
    nearDup,
    avgSetterScore,
    medianSetterScore,
    answerCorrect,
    lowestScored,
  };
}

function toMarkdown(report: any): string {
  const lines: string[] = [];
  lines.push(`# Challenge 题库评测报告`);
  lines.push('');
  if (report.summary.weeks && report.summary.perWeek) {
    lines.push(`- 模拟用户: 1人（连续 ${report.summary.weeks} 周）`);
    lines.push(`- 每周题量: ${report.summary.perWeek}`);
  }
  lines.push(`- 题目总量: ${report.summary.total}`);
  lines.push(`- 出题质量均分: ${report.summary.avgSetterScore}`);
  lines.push(`- 出题质量中位数: ${report.summary.medianSetterScore}`);
  lines.push(`- 答题者正确率: ${report.summary.answerAccuracy}`);
  lines.push(`- 精确重复率: ${report.summary.exactDuplicateRate}`);
  lines.push(`- 近似重复对数: ${report.summary.nearDuplicatePairs}`);
  lines.push('');

  if (Array.isArray(report.weeklyBreakdown) && report.weeklyBreakdown.length > 0) {
    lines.push(`## 每周结果`);
    for (const w of report.weeklyBreakdown) {
      lines.push(
        `- Week ${w.week}: 正确率=${w.answerAccuracy}, 精确重复率=${w.exactDuplicateRate}, 近似重复对数=${w.nearDuplicatePairs}`
      );
    }
    lines.push('');
  }

  lines.push(`## 分布统计`);
  lines.push('');
  lines.push(`### 题型分布`);
  for (const [k, v] of Object.entries(report.distribution.byType)) {
    lines.push(`- ${k}: ${v}`);
  }
  lines.push('');
  lines.push(`### 难度分布`);
  for (const [k, v] of Object.entries(report.distribution.byDifficulty)) {
    lines.push(`- ${k}: ${v}`);
  }
  lines.push('');
  lines.push(`### 答题策略分布`);
  for (const [k, v] of Object.entries(report.answerer.byStrategy)) {
    lines.push(`- ${k}: ${v}`);
  }

  lines.push('');
  lines.push(`## 低分题（前10）`);
  const low = report.quality.lowestScored.slice(0, 10);
  if (!low.length) {
    lines.push(`- 无`);
  } else {
    for (const item of low) {
      lines.push(`- Q${item.index + 1} [${item.type}] score=${item.score}, issues=${item.issues.join(' | ') || '无'}`);
    }
  }

  lines.push('');
  lines.push(`## 近似重复（前10）`);
  const near = report.duplicates.nearPairs.slice(0, 10);
  if (!near.length) {
    lines.push(`- 无`);
  } else {
    for (const pair of near) {
      lines.push(`- Q${pair.i + 1} vs Q${pair.j + 1}, sim=${pair.similarity}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
}

function main() {
  const weeks = getNumberArg('--weeks', 1);
  const perWeek = getNumberArg('--per-week', getCountArg(100));
  const allQuestions: GeneratedQuestion[] = [];
  const weekRanges: Array<{ week: number; start: number; end: number }> = [];
  let cursor = 0;

  for (let week = 1; week <= weeks; week++) {
    const weekQuestions = generateQuestions(perWeek);
    allQuestions.push(...weekQuestions);
    weekRanges.push({ week, start: cursor, end: cursor + weekQuestions.length });
    cursor += weekQuestions.length;
  }

  const overall = analyzeQuestions(allQuestions);
  const weeklyBreakdown = weekRanges.map(range => {
    const weekQuestions = allQuestions.slice(range.start, range.end);
    const analyzed = analyzeQuestions(weekQuestions);
    return {
      week: range.week,
      total: weekQuestions.length,
      answerCorrect: analyzed.answerCorrect,
      answerAccuracy: formatPercent(analyzed.answerCorrect, weekQuestions.length),
      avgSetterScore: analyzed.avgSetterScore,
      exactDuplicateHits: analyzed.exactDup.duplicateHits,
      exactDuplicateRate: formatPercent(analyzed.exactDup.duplicateHits, weekQuestions.length),
      nearDuplicatePairs: analyzed.nearDup.length,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      weeks,
      perWeek,
      total: allQuestions.length,
      nearDuplicateThreshold: 0.85,
      mode: 'single-user-consecutive-weeks',
    },
    summary: {
      weeks,
      perWeek,
      total: allQuestions.length,
      avgSetterScore: overall.avgSetterScore,
      medianSetterScore: overall.medianSetterScore,
      answerCorrect: overall.answerCorrect,
      answerAccuracy: formatPercent(overall.answerCorrect, allQuestions.length),
      exactDuplicateHits: overall.exactDup.duplicateHits,
      exactDuplicateRate: formatPercent(overall.exactDup.duplicateHits, allQuestions.length),
      nearDuplicatePairs: overall.nearDup.length,
    },
    weeklyBreakdown,
    distribution: {
      byType: groupCount(allQuestions.map(q => q.type)),
      byDifficulty: groupCount(allQuestions.map(q => q.difficulty)),
    },
    answerer: {
      byStrategy: groupCount(overall.answerResults.map(r => r.strategy)),
      wrongIndices: overall.answerResults
        .map((r, i) => ({ i, isCorrect: r.isCorrect, strategy: r.strategy }))
        .filter(x => !x.isCorrect),
    },
    quality: {
      lowestScored: overall.lowestScored,
    },
    duplicates: {
      exactGroups: overall.exactDup.groups,
      nearPairs: overall.nearDup,
    },
    questions: allQuestions.map((q, i) => ({
      index: i + 1,
      week: Math.floor(i / perWeek) + 1,
      weekQuestionIndex: (i % perWeek) + 1,
      type: q.type,
      difficulty: q.difficulty,
      question: q.question,
      situation: q.situation,
      options: q.options,
      correctOptionId: q.correctOptionId,
      setterReview: overall.setterReviews[i],
      answererResult: overall.answerResults[i],
    })),
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = nowStamp();
  const jsonPath = path.join(REPORT_DIR, `challenge-eval-${weeks}w-${perWeek}q-${stamp}.json`);
  const mdPath = path.join(REPORT_DIR, `challenge-eval-${weeks}w-${perWeek}q-${stamp}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
  fs.writeFileSync(mdPath, toMarkdown(report), 'utf-8');

  console.log(`✅ 已完成 1名用户连续${weeks}周模拟（每周${perWeek}题，共${report.summary.total}题）`);
  console.log(`- 出题质量均分: ${report.summary.avgSetterScore}`);
  console.log(`- 出题质量中位数: ${report.summary.medianSetterScore}`);
  console.log(`- 答题者正确率: ${report.summary.answerAccuracy}`);
  console.log(`- 精确重复率: ${report.summary.exactDuplicateRate}`);
  console.log(`- 近似重复对数: ${report.summary.nearDuplicatePairs}`);
  console.log(`- JSON 报告: ${jsonPath}`);
  console.log(`- Markdown 报告: ${mdPath}`);
}

main();
