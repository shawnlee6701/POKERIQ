/**
 * Question Generator Engine v2
 * 基于 calculateOuts 引擎驱动出题
 * 随机发牌 → 调用引擎获取正确答案 → 生成干扰选项
 */

import { calculateOuts, Card, OutsResult } from './outs-calculator.js';

// ============ 类型定义 ============

interface QuizQuestion {
  id: string;
  type: 'outs' | 'equity' | 'odds' | 'preflop' | 'position' | 'ev' | 'bluff' | 'style';
  difficulty: 'easy' | 'medium' | 'hard';
  chapter: string;
  progress: string;
  situation: string;
  question: string;
  hand: Card[];
  board: Card[];
  options: { id: string; label: string; value: string }[];
  correctOptionId: string;
  explanation: string;
}

// ============ 工具函数 ============

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const LABELS = ['A', 'B', 'C', 'D'];
const POSITIONS = ['UTG', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥️', diamonds: '♦️', clubs: '♣️', spades: '♠️',
};

function randomId(): string {
  return 'q_' + Math.random().toString(36).substring(2, 10);
}

function shuffleArray<T>(arr: T[]): T[] {
  const s = [...arr];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return shuffleArray(deck);
}

function dealCards(deck: Card[], count: number): Card[] {
  return deck.splice(0, count);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cardStr(c: Card): string {
  return `${c.rank}${SUIT_SYMBOLS[c.suit] || ''}`;
}

function handStr(cards: Card[]): string {
  return cards.map(cardStr).join(' ');
}

/** 生成不重复的干扰选项 */
function makeDistractors(correct: number, min: number, max: number, count: number): number[] {
  const set = new Set<number>([correct]);
  let attempts = 0;
  while (set.size < count + 1 && attempts < 100) {
    // 在正确值附近±50%生成干扰项
    const delta = randInt(-Math.max(3, Math.floor(correct * 0.5)), Math.max(3, Math.floor(correct * 0.5)));
    const v = Math.max(min, Math.min(max, correct + delta));
    if (v !== correct) set.add(v);
    attempts++;
  }
  // 如果不够就随机填充
  while (set.size < count + 1) {
    set.add(randInt(min, max));
  }
  const arr = Array.from(set);
  arr.splice(arr.indexOf(correct), 1);
  return shuffleArray(arr).slice(0, count);
}

// ============ 补牌计算题 ============

function generateOutsQuestion(): QuizQuestion {
  const playerCount = pick([2, 6, 9]) as 2 | 6 | 9;
  const pos = pick(POSITIONS);
  const stack = pick([25, 40, 60, 80, 100, 150]);
  
  // 反复生成直到得到有意义的 outs (1~20)
  let hand: Card[], board: Card[], result: OutsResult;
  let tries = 0;
  do {
    const deck = buildDeck();
    hand = dealCards(deck, 2);
    // 翻牌(3张)或转牌(4张)
    const boardCount = Math.random() > 0.3 ? 3 : 4;
    board = dealCards(deck, boardCount);
    result = calculateOuts(hand, board, playerCount);
    tries++;
  } while ((result.outs < 1 || result.outs > 20) && tries < 30);

  const correctOuts = result.outs;
  const distractors = makeDistractors(correctOuts, 0, 20, 2);
  const allOptions = shuffleArray([correctOuts, ...distractors]);
  const correctIdx = allOptions.indexOf(correctOuts);
  
  const stage = board.length === 3 ? '翻牌圈' : '转牌圈';
  const potBB = pick([5, 7, 10, 12, 15, 20]);
  
  // 难度：outs越少越难判断
  const difficulty = correctOuts >= 8 ? 'easy' : correctOuts >= 4 ? 'medium' : 'hard';

  let outsDetail = '';
  if (result.outsCards && result.outsCards.length > 0) {
    const cardsStr = result.outsCards.map(c => cardStr(c)).join(', ');
    outsDetail = `\n具体的补牌包括：${cardsStr}（共 ${result.outsCards.length} 张）。`;
  }

  return {
    id: randomId(),
    type: 'outs',
    difficulty: difficulty as any,
    chapter: '补牌计算',
    progress: '',
    situation: `${playerCount}人桌${stage}，你在 ${pos} 位置，筹码 ${stack}BB。底池 ${potBB}BB。`,
    question: '你有多少张补牌？',
    hand,
    board,
    options: allOptions.map((v, i) => ({
      id: LABELS[i].toLowerCase(),
      label: LABELS[i],
      value: `${v} 张`,
    })),
    correctOptionId: LABELS[correctIdx].toLowerCase(),
    explanation: `你在当前的牌面下形成了【${result.handName}】。
由于你处于听牌状态（主要为 ${result.outsType}），你有 ${correctOuts} 张确实能提升自己牌力的补牌。${outsDetail}
根据“二四法则”，在${stage}（接下来还有${stage === '翻牌圈' ? 2 : 1}张牌未发），你最终成牌的实际概率约为 ${stage === '翻牌圈' ? result.totalHit : result.riverHit}%。你可以利用这个概率来判断是否符合当前的底池赔率进行跟注。`,
  };
}

// ============ 胜率判断题 ============

function generateEquityQuestion(): QuizQuestion {
  const playerCount = pick([2, 6, 9]) as 2 | 6 | 9;
  const pos = pick(POSITIONS);
  const stack = pick([25, 40, 60, 80, 100, 150]);
  
  let hand: Card[], board: Card[], result: OutsResult;
  let tries = 0;
  do {
    const deck = buildDeck();
    hand = dealCards(deck, 2);
    board = dealCards(deck, 3);
    result = calculateOuts(hand, board, playerCount);
    tries++;
  } while (result.win < 5 && tries < 20);

  const win = Math.round(result.win);
  // 将胜率分到10%区间
  const rangeMin = Math.floor(win / 10) * 10;
  const correctRange = `${rangeMin}%~${rangeMin + 10}%`;

  const wrongRanges = shuffleArray(
    [0, 10, 20, 30, 40, 50, 60, 70, 80, 90].filter(v => v !== rangeMin)
  ).slice(0, 2).map(v => `${v}%~${v + 10}%`);

  const allOptions = shuffleArray([correctRange, ...wrongRanges]);
  const correctIdx = allOptions.indexOf(correctRange);

  const difficulty = playerCount === 2 ? 'easy' : playerCount === 6 ? 'medium' : 'hard';
  const potBB = pick([5, 7, 10, 12, 15, 20]);

  let outsDetail = '';
  if (result.outsCards && result.outsCards.length > 0) {
    const cardsStr = result.outsCards.map(c => cardStr(c)).join(', ');
    outsDetail = `\n（具体补牌包括：${cardsStr}）`;
  }

  return {
    id: randomId(),
    type: 'equity',
    difficulty: difficulty as any,
    chapter: '胜率判断',
    progress: '',
    situation: `${playerCount}人桌翻牌圈，你在 ${pos} 位置，筹码 ${stack}BB。底池 ${potBB}BB。`,
    question: `在${playerCount}人桌中，你的胜率大约在哪个范围？`,
    hand,
    board,
    options: allOptions.map((v, i) => ({
      id: LABELS[i].toLowerCase(),
      label: LABELS[i],
      value: v,
    })),
    correctOptionId: LABELS[correctIdx].toLowerCase(),
    explanation: `当前你形成的牌型为【${result.handName}】，并握有 ${result.outs} 张能够极大提升胜率的补牌（如 ${result.outsType} 等）。${outsDetail}
系统通过运行3000次蒙特卡洛模拟来分配对手盲牌和后续发牌，真实再现了当前的对抗环境。模拟结果显示，你最终获胜的概率约为 ${win}%，另外还有 ${Math.round(result.tie)}% 的平局概率和 ${Math.round(result.loss)}% 的落败风险。
此数据为你在此情况下的价值押注或诈唬提供了可靠的决策依据。`,
  };
}

// ============ 赔率计算题 ============

function generateOddsQuestion(): QuizQuestion {
  const playerCount = pick([2, 6, 9]) as 2 | 6 | 9;
  const pos = pick(POSITIONS);
  const stack = pick([40, 60, 80, 100, 150]);
  
  const potBB = pick([8, 10, 12, 15, 20, 25, 30]);
  const betBB = pick([3, 4, 5, 6, 8, 10, 12, 15]);
  const totalPot = potBB + betBB;
  const potOdds = totalPot / betBB;
  const correctOdds = `${potOdds.toFixed(1)} : 1`;

  // 干扰赔率
  const wrongOdds = shuffleArray(
    [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 6.0, 7.0, 8.0, 10.0]
      .filter(v => Math.abs(v - potOdds) > 0.5)
  ).slice(0, 2).map(v => `${v.toFixed(1)} : 1`);

  const allOptions = shuffleArray([correctOdds, ...wrongOdds]);
  const correctIdx = allOptions.indexOf(correctOdds);

  const deck = buildDeck();
  const hand = dealCards(deck, 2);
  const boardCount = pick([3, 4]);
  const board = dealCards(deck, boardCount);
  const result = calculateOuts(hand, board, playerCount);

  const difficulty = potOdds > 5 ? 'easy' : potOdds > 3 ? 'medium' : 'hard';

  let outsDetail = '';
  if (result.outsCards && result.outsCards.length > 0) {
    const cardsStr = result.outsCards.map(c => cardStr(c)).join(', ');
    outsDetail = `\n（目前你的听牌补牌包括：${cardsStr}）`;
  }

  const streetName = boardCount === 3 ? '翻牌圈' : '转牌圈';

  const templates = [
    {
      situation: `${playerCount}人桌${streetName}，你在 ${pos} 位置，筹码 ${stack}BB。你当前的牌型为【${result.handName}】并拥有 ${result.outs} 张补牌（如 ${result.outsType} 等）。\n\n此时底池共有 ${potBB}BB，对手向你下注了 ${betBB}BB。`,
      question: '面对下注，在决定是否要跟注去追牌前，请先计算你目前获得的底池赔率是多少？'
    },
    {
      situation: `盲注级别不限，这是一张标准的 ${playerCount} 人桌。你在 ${pos} 位，${streetName}发出后你在听【${result.handName}】（共 ${result.outs} 张补牌，如 ${result.outsType}）。\n\n底池经过积累达到了 ${potBB}BB，某位凶悍的对手试图用 ${betBB}BB 的下注把你打跑。`,
      question: '如果你选择强势跟注看下一张牌，你需要面临的底池赔率是多少？'
    },
    {
      situation: `你坐在 ${playerCount}人桌的 ${pos} 位，后手深度 ${stack}BB。进入${streetName}后你击中了【${result.handName}】，手里一共有 ${result.outs} 张能让你提升牌力的重磅补牌（比如 ${result.outsType}）。\n\n目前底池里已经有了 ${potBB}BB 的死钱，这时前位的对手突然开枪，下注了 ${betBB}BB。`,
      question: '为了判断强买后续的听牌到底划不划算，请算出你当前的底池赔率：'
    },
    {
      situation: `${playerCount}人桌，你的绝对位置是 ${pos}。到达${streetName}，底池刚好凑满 ${potBB}BB，遭遇某对手主动下注 ${betBB}BB。\n\n你的牌型是【${result.handName}】（听 ${result.outs} 张补牌：${result.outsType}）。`,
      question: '在暂不考虑隐含赔率的前提下，你此次跟注的直接底池赔率比值是多少？'
    }
  ];

  const selectedTemplate = pick(templates);

  return {
    id: randomId(),
    type: 'odds',
    difficulty: difficulty as any,
    chapter: '赔率计算',
    progress: '',
    situation: selectedTemplate.situation,
    question: selectedTemplate.question,
    hand,
    board,
    options: allOptions.map((v, i) => ({
      id: LABELS[i].toLowerCase(),
      label: LABELS[i],
      value: v,
    })),
    correctOptionId: LABELS[correctIdx].toLowerCase(),
    explanation: `【底池赔率计算】：（原有底池 + 所有人本轮总下注额）÷ 你需要跟注的金额。
- 当前底池 ${potBB}BB
- 加上对手下注的 ${betBB}BB，使底池涨至 ${totalPot}BB
- 你需要支付 ${betBB}BB 才能继续游戏
因此，你获得的盈亏比（底池赔率）= ${totalPot} ÷ ${betBB} = ${correctOdds}。

【实战决策指引】：计算出赔率后，我们发现你需要大约 ${Math.round(100 / (potOdds + 1))}% 的胜率才足够让你不亏钱。而根据你的手牌（${result.outs} 张补牌），实际上你的这把牌赢率约为 ${Math.round(result.win)}%。通过对比这两个数字，你就能像职业选手一样立刻做出长期盈利（+EV）的正确决定。${outsDetail}`,
  };
}

// 重构后的手牌强度评估
/**
 * GTO 6-max 开池范围表 (100bb, RFI/Open)
 * 来源: pokercoaching.com / GTO Wizard 简化版
 * 
 * 每个位置列出"可以率先加注入池"的手牌。
 * 未列出的牌 → Fold（大盲位无人加注时 Check）
 * 
 * 注: SB 面对弃到自己时，范围非常宽（约 62%）,这里取一个适中的教学范围。
 */
const GTO_RFI_RANGES: Record<string, Set<string>> = {
  // UTG (~15%): 最紧，只打强牌和一些同花连牌
  UTG: new Set([
    'AA','KK','QQ','JJ','TT','99','88','77',
    'AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s',
    'KQs','KJs','KTs','K9s',
    'QJs','QTs',
    'JTs','J9s',
    'T9s',
    '98s',
    '87s',
    'AKo','AQo','AJo','ATo',
    'KQo','KJo',
  ]),
  // MP (~18%): 比 UTG 略宽
  MP: new Set([
    'AA','KK','QQ','JJ','TT','99','88','77','66',
    'AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s',
    'KQs','KJs','KTs','K9s','K8s',
    'QJs','QTs','Q9s',
    'JTs','J9s',
    'T9s','T8s',
    '98s',
    '87s','76s',
    'AKo','AQo','AJo','ATo',
    'KQo','KJo','KTo',
    'QJo',
  ]),
  // HJ (~21%): 开池范围继续扩大
  HJ: new Set([
    'AA','KK','QQ','JJ','TT','99','88','77','66','55',
    'AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s',
    'KQs','KJs','KTs','K9s','K8s','K7s','K6s',
    'QJs','QTs','Q9s',
    'JTs','J9s',
    'T9s','T8s',
    '98s',
    '87s','76s',
    'AKo','AQo','AJo','ATo','A9o',
    'KQo','KJo','KTo',
    'QJo','QTo',
  ]),
  // CO (~28%): 后位开始明显放宽
  CO: new Set([
    'AA','KK','QQ','JJ','TT','99','88','77','66','55','44','33',
    'AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s',
    'KQs','KJs','KTs','K9s','K8s','K7s','K6s','K5s','K4s','K3s',
    'QJs','QTs','Q9s','Q8s','Q7s','Q6s',
    'JTs','J9s','J8s',
    'T9s','T8s','T7s',
    '98s','97s',
    '87s','86s',
    '76s','75s',
    '65s',
    '54s',
    'AKo','AQo','AJo','ATo','A9o','A8o',
    'KQo','KJo','KTo',
    'QJo','QTo',
    'JTo',
  ]),
  // BTN (~44%): 庄位范围最宽
  BTN: new Set([
    'AA','KK','QQ','JJ','TT','99','88','77','66','55','44','33','22',
    'AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s',
    'KQs','KJs','KTs','K9s','K8s','K7s','K6s','K5s','K4s','K3s','K2s',
    'QJs','QTs','Q9s','Q8s','Q7s','Q6s','Q5s','Q4s','Q3s',
    'JTs','J9s','J8s','J7s','J6s','J5s','J4s',
    'T9s','T8s','T7s','T6s',
    '98s','97s','96s',
    '87s','86s','85s',
    '76s','75s',
    '65s','64s',
    '54s','53s',
    'AKo','AQo','AJo','ATo','A9o','A8o','A7o','A6o','A5o','A4o',
    'KQo','KJo','KTo','K9o','K8o',
    'QJo','QTo','Q9o',
    'JTo','J9o',
    'T9o','T8o',
    '98o',
  ]),
  // SB (~50%): 面对弃到自己时很宽（这里取适中教学范围）
  SB: new Set([
    'AA','KK','QQ','JJ','TT','99','88','77','66','55','44','33','22',
    'AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s',
    'KQs','KJs','KTs','K9s','K8s','K7s','K6s','K5s','K4s','K3s','K2s',
    'QJs','QTs','Q9s','Q8s','Q7s','Q6s','Q5s','Q4s','Q3s','Q2s',
    'JTs','J9s','J8s','J7s','J6s','J5s','J4s','J3s','J2s',
    'T9s','T8s','T7s','T6s','T5s','T4s','T3s',
    '98s','97s','96s','95s','94s',
    '87s','86s','85s','84s',
    '76s','75s','74s',
    '65s','64s','63s',
    '54s','53s',
    '43s',
    'AKo','AQo','AJo','ATo','A9o','A8o','A7o','A6o','A5o','A4o','A3o','A2o',
    'KQo','KJo','KTo','K9o','K8o','K7o','K6o','K5o','K4o',
    'QJo','QTo','Q9o','Q8o','Q7o','Q6o','Q5o',
    'JTo','J9o','J8o','J7o',
    'T9o','T8o','T7o',
    '98o','97o','96o',
    '87o','86o',
    '76o',
  ]),
};

/**
 * 判断一手牌在指定位置是否在 GTO 开池范围内
 */
function isInRFIRange(handKey: string, position: string): boolean {
  const range = GTO_RFI_RANGES[position];
  if (!range) return false;
  return range.has(handKey);
}

/**
 * PREFLOP_TIERS 保留用于 facing-raise 场景和 difficulty 判断
 */
const PREFLOP_TIERS: Record<string, number> = {
  // Tier 1: 顶级牌 - 遇到任何情况都应加注/反加
  'AA': 1, 'KK': 1, 'QQ': 1, 'AKs': 1, 'AKo': 1,
  // Tier 2: 强牌 - 面对加注可以 Call 或 3-Bet
  'JJ': 2, 'TT': 2, 'AQs': 2, 'AQo': 2, 'AJs': 2, 'KQs': 2,
  // Tier 3: 中等牌 - 面对加注通常弃牌（偶尔冷跟）
  '99': 3, '88': 3, '77': 3, 'ATs': 3, 'KJs': 3, 'QJs': 3, 'JTs': 3, 'AJo': 3, 'KQo': 3,
  // 其余未列出的 → Tier 4+
};

function getHandKey(hand: Card[]): string {
  const r1 = hand[0].rank === '10' ? 'T' : hand[0].rank;
  const r2 = hand[1].rank === '10' ? 'T' : hand[1].rank;
  const suited = hand[0].suit === hand[1].suit;
  
  if (r1 === r2) return `${r1}${r2}`;
  // 按大小排序
  const v1 = RANK_VALUES_[r1] || 0;
  const v2 = RANK_VALUES_[r2] || 0;
  const [hi, lo] = v1 >= v2 ? [r1, r2] : [r2, r1];
  return `${hi}${lo}${suited ? 's' : 'o'}`;
}

const RANK_VALUES_: Record<string, number> = {
  'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
};

function generatePreflopQuestion(): QuizQuestion {
  const playerCount = pick([6, 9]) as 6 | 9;
  const pos = pick(POSITIONS);
  const stack = pick([25, 40, 60, 80, 100]);

  const deck = buildDeck();
  const hand = dealCards(deck, 2);
  const handKey = getHandKey(hand);
  const tier = PREFLOP_TIERS[handKey] || 5; // 5 = 弱牌

  const facingRaise = Math.random() > 0.5;
  let correctAction: string;
  let explanation: string;

  if (facingRaise) {
    if (tier <= 1) {
      correctAction = '3-Bet / 反加';
      explanation = `${handStr(hand)} 是顶级起手牌（Tier 1），面对前位加注，应该坚决 3-Bet 榨取价值或隔离。`;
    } else if (tier <= 2) {
      correctAction = 'Call / 跟注';
      explanation = `${handStr(hand)} 是强牌（Tier 2），面对加注可以平跟入局，或者根据具体对手和位置考虑 3-Bet，此处优选跟注看翻牌。`;
    } else {
      correctAction = 'Fold / 弃牌';
      explanation = `${handStr(hand)} 牌力不足（属于边缘牌或弱牌），面对前位玩家的加注，应该果断弃牌止损。`;
    }
  } else {
    // 前方无人加注 (Unopened Pot) → 直接查 GTO 开池范围表
    if (pos === 'BB') {
      // 大盲位无人加注 → Check
      correctAction = 'Check / 过牌';
      explanation = `坐在大盲位，前面无人加注（或全部弃牌/平跟），你已经投入了盲注，可以免费过牌看翻牌，无需额外投入。`;
    } else if (isInRFIRange(handKey, pos)) {
      correctAction = 'Raise / 加注';
      explanation = `${handStr(hand)}（${handKey}）在 ${pos} 位置属于标准 GTO 开池范围。前方无人入池时，这手牌有足够的牌力和翻后可操作性，应当率先加注（Open Raise）抢夺主动权。\n\n【翻前常识提示】现代德州扑克建议不要平跟(Limp)入池，所以一旦决定玩这手牌，就必须加注打走盲注。`;
    } else {
      correctAction = 'Fold / 弃牌';
      explanation = `${handStr(hand)}（${handKey}）不在 ${pos} 位置的标准开池范围内。在当前位置，后面仍有玩家未行动，这手牌的牌力和可操作性不足以率先入池——果断弃牌等待更好的机会。\n\n【翻前重要规则】如果你前面的人都弃牌了，你**不能直接过牌(Check)**！你要么交出盲注(跟注/加注)，要么只能弃牌。新手常犯错误是想“过牌看一眼”，实际上只有大盲位才有资格在无人加注时过牌。`;
    }
  }

  const allActions = ['Raise / 加注', 'Call / 跟注', 'Fold / 弃牌', '3-Bet / 反加', 'All-in / 全下', 'Check / 过牌'];
  let validActions = [...allActions];
  
  // Bugfix: 动态过滤非法动作
  if (facingRaise) {
    validActions = validActions.filter(a => a !== 'Check / 过牌'); // 面对加注不能过牌
  } else {
    if (pos !== 'BB') {
      validActions = validActions.filter(a => a !== 'Check / 过牌'); // 非盲位开池不能过牌
    } else {
      validActions = validActions.filter(a => a !== '3-Bet / 反加'); // 无人加注不能反加
    }
  }

  const wrongActions = shuffleArray(validActions.filter(a => a !== correctAction)).slice(0, 3);
  const finalOptions = shuffleArray([correctAction, ...wrongActions]);

  // 重构难度逻辑，让弱牌能被判定为 easy 顺利出在练习题里
  const difficulty = (tier === 1 || tier === 5) ? 'easy' : (tier === 2) ? 'medium' : 'hard';

  return {
    id: randomId(),
    type: 'preflop',
    difficulty: difficulty as any,
    chapter: '翻前策略',
    progress: '',
    situation: facingRaise
      ? `${playerCount}人桌翻前，你在 ${pos} 位置，筹码 ${stack}BB。\n\n局面上，前位有玩家率先加注到 3BB，其他人弃牌，现在轮到你行动。`
      : pos === 'BB' 
        ? `${playerCount}人桌翻前，你在 ${pos} 位置，筹码 ${stack}BB。\n\n前方玩家弃牌，小盲位（SB）平跟补齐了盲注（没有加注），现在轮到你行动。`
        : `${playerCount}人桌翻前，你在 ${pos} 位置，筹码 ${stack}BB。\n\n前方在此之前全部弃牌（无人加注），现在轮到你行动。`,
    question: '你目前的最佳行动是？',
    hand,
    board: [],
    options: finalOptions.map((v, i) => ({
      id: v.toLowerCase(),
      label: ['A', 'B', 'C', 'D'][i],
      value: v,
    })),
    correctOptionId: correctAction.toLowerCase(),
    explanation: `手牌【${cardStr(hand[0])} ${cardStr(hand[1])}】的综合强度评估：
${explanation}${!facingRaise ? '\n（德州扑克中，位置越靠后信息优势越大，因此前位需要非常紧凑的起手牌范围，而后位则可以适当放宽要求来偷盲或拿取主动权。）' : ''}`,
  };
}

// ============ 位置与行动题 ============

function generatePositionQuestion(): QuizQuestion {
  const playerCount = pick([6, 9]) as 6 | 9;
  const stack = pick([25, 40, 60, 80, 100]);

  // 选取中等强度牌来突出位置差异
  const POSITION_HANDS = ['ATo', 'KJo', 'QJs', 'JTs', '99', '88', '77', 'A9s', 'KTs', 'T9s', '66', '55', 'A8o', 'K9s', '87s'];
  const handKey = pick(POSITION_HANDS);
  
  // 根据 handKey 生成实际手牌
  const deck = buildDeck();
  const suited = handKey.endsWith('s');
  const r1Char = handKey[0];
  const r2Char = handKey[1];
  const rank1 = r1Char === 'T' ? '10' : r1Char;
  const rank2 = r2Char === 'T' ? '10' : r2Char;
  
  let hand: Card[];
  if (rank1 === rank2) {
    // 对子
    const suits = shuffleArray([...SUITS]);
    hand = [{ rank: rank1, suit: suits[0] }, { rank: rank2, suit: suits[1] }];
  } else if (suited) {
    const s = pick(SUITS);
    hand = [{ rank: rank1, suit: s }, { rank: rank2, suit: s }];
  } else {
    const suits = shuffleArray([...SUITS]);
    hand = [{ rank: rank1, suit: suits[0] }, { rank: rank2, suit: suits[1] }];
  }

  const pos = pick(POSITIONS);

  let correctAction: string;
  let explanation: string;

  // 位置策略：直接查 GTO 开池范围表
  if (pos === 'BB') {
    correctAction = 'Check / 过牌';
    explanation = `坐在大盲位（BB），前面无人加注到你，你已经投入了 1BB 盲注，可以免费过牌看翻牌。`;
  } else if (isInRFIRange(handKey, pos)) {
    correctAction = 'Raise / 加注';
    const posDesc = ['UTG', 'MP'].includes(pos)
      ? `虽然 ${pos} 是前位，但 ${handKey} 在 GTO 策略中属于该位置的标准开池范围`
      : `在 ${pos} 这个后位，${handKey} 完全属于标准开池范围`;
    explanation = `${handStr(hand)}（${handKey}）——${posDesc}。前面所有人弃牌，你应当率先加注（2.5BB）抢夺主动权。\n\n（注：现代德州扑克体系建议在翻前尽量避免平跟，用加注来最大化价值并简化翻后局面。）`;
  } else {
    correctAction = 'Fold / 弃牌';
    // 找到这手牌可以开池的最靠前位置，用来教学
    const openableFrom = ['UTG','MP','HJ','CO','BTN','SB'].find(p => isInRFIRange(handKey, p));
    const hint = openableFrom
      ? `这手牌在 ${openableFrom} 及更靠后的位置才进入 GTO 开池范围`
      : `这手牌在任何位置都不在标准开池范围内`;
    explanation = `${handStr(hand)}（${handKey}）不在 ${pos} 位置的 GTO 开池范围内。${hint}。在当前回合，考虑到你需要交出盲注才能入局，**不能直接过牌**，既然牌力不足以加注，只能果断弃牌。`;
  }

  const allActions = ['Raise / 加注', 'Call / 跟注', 'Fold / 弃牌', '3-Bet / 反加', 'Check / 过牌'];
  let validActions = [...allActions];
  
  if (pos !== 'BB') {
    validActions = validActions.filter(a => a !== 'Check / 过牌');
  } else {
    validActions = validActions.filter(a => a !== '3-Bet / 反加');
  }
  
  const wrongActions = shuffleArray(validActions.filter(a => a !== correctAction)).slice(0, 3);
  const finalOptions = shuffleArray([correctAction, ...wrongActions]);

  const inRange = isInRFIRange(handKey, 'UTG');
  const difficulty = (['CO', 'BTN'].includes(pos) && inRange) ? 'easy'
    : (['UTG', 'MP'].includes(pos) && !inRange) ? 'easy'
    : 'medium';

  return {
    id: randomId(),
    type: 'position',
    difficulty: difficulty as any,
    chapter: '位置与行动',
    progress: '',
    situation: pos === 'BB'
      ? `${playerCount}人桌翻前，你在 ${pos} 位置，筹码 ${stack}BB。\n\n前方玩家弃牌，小盲位（SB）平跟补齐了盲注（没有加注），现在轮到你行动。`
      : `${playerCount}人桌翻前，你在 ${pos} 位置，筹码 ${stack}BB。\n\n前方在此之前全部弃牌（无人加注），现在轮到你行动。`,
    question: `拿到 ${handKey}，你在 ${pos} 位置的最佳行动是？`,
    hand,
    board: [],
    options: finalOptions.map((v, i) => ({
      id: v.toLowerCase(),
      label: ['A', 'B', 'C', 'D'][i],
      value: v,
    })),
    correctOptionId: correctAction.toLowerCase(),
    explanation: `${explanation}\n\n【位置核心原则】后位（BTN/CO）拥有最大的信息优势——你能看到所有前位玩家的行动后再做决定。因此后位可以用更宽的范围入池；而前位（UTG/MP）由于后面还有很多玩家未表态，必须用极紧的范围保护自己。`,
  };
}

// ============ EV 决策题 ============

function generateEvQuestion(): QuizQuestion {
  const playerCount = pick([2, 6, 9]) as 2 | 6 | 9;
  const pos = pick(POSITIONS);
  const stack = pick([25, 40, 60, 80, 100]);

  let hand: Card[], board: Card[], result: OutsResult;
  let tries = 0;
  do {
    const deck = buildDeck();
    hand = dealCards(deck, 2);
    const boardCount = Math.random() > 0.4 ? 3 : 4;
    board = dealCards(deck, boardCount);
    result = calculateOuts(hand, board, playerCount);
    tries++;
  } while ((result.outs < 2 || result.outs > 18) && tries < 30);

  const stage = board.length === 3 ? '翻牌圈' : '转牌圈';
  
  // 构造底池与下注额
  const potBB = pick([6, 8, 10, 12, 15, 18, 20, 25]);
  const betBB = pick([3, 4, 5, 6, 8, 10, 12]);
  
  // 计算底池赔率所需的最低胜率
  const totalPotAfterCall = potBB + betBB + betBB; // pot + opponent bet + your call
  const neededEquity = Math.round((betBB / totalPotAfterCall) * 100);
  
  // 实际胜率
  const actualEquity = Math.round(result.win);
  
  // 判断 +EV 还是 -EV
  const isPosEV = actualEquity >= neededEquity;
  
  const correctAction = isPosEV ? '跟注 (+EV)' : '弃牌 (-EV)';
  const wrongOptions = isPosEV 
    ? ['弃牌 (-EV)', '加注 (Semi-Bluff)', '全下 (All-in)']
    : ['跟注 (+EV)', '加注 (Semi-Bluff)', '全下 (All-in)'];
  
  const finalOptions = shuffleArray([correctAction, ...shuffleArray(wrongOptions).slice(0, 2)]);
  const correctIdx = finalOptions.indexOf(correctAction);

  // 难度：差值越小越难
  const evGap = Math.abs(actualEquity - neededEquity);
  const difficulty = evGap >= 15 ? 'easy' : evGap >= 5 ? 'medium' : 'hard';

  let outsDetail = '';
  if (result.outsCards && result.outsCards.length > 0) {
    const cardsStr = result.outsCards.map(c => cardStr(c)).join(', ');
    outsDetail = `\n你的补牌：${cardsStr}（共 ${result.outsCards.length} 张）`;
  }

  return {
    id: randomId(),
    type: 'ev',
    difficulty: difficulty as any,
    chapter: 'EV 决策',
    progress: '',
    situation: `${playerCount}人桌${stage}，你在 ${pos} 位置，筹码 ${stack}BB。\n\n底池 ${potBB}BB，对手下注 ${betBB}BB。你需要跟注 ${betBB}BB 才能继续。`,
    question: '根据底池赔率与计算出的手牌胜率，面对这个下注你的正确决策是？',
    hand,
    board,
    options: finalOptions.map((v, i) => ({
      id: LABELS[i].toLowerCase(),
      label: LABELS[i],
      value: v,
    })),
    correctOptionId: LABELS[correctIdx].toLowerCase(),
    explanation: `【EV 计算过程】
当前牌面你形成了【${result.handName}】（${result.outsType}，${result.outs} 张补牌）。${outsDetail}

1. 底池赔率所需最低胜率 = 跟注额 ÷ (底池 + 对手下注 + 跟注额) = ${betBB} ÷ ${totalPotAfterCall} ≈ ${neededEquity}%
2. 你的实际胜率约 ${actualEquity}%
3. ${actualEquity}% ${isPosEV ? '≥' : '<'} ${neededEquity}% → ${isPosEV ? '正期望值 (+EV)，长期来看跟注是有利可图的' : '负期望值 (-EV)，长期来看跟注会亏损筹码'}

${isPosEV ? '✅ 结论：你的实际胜率超过了底池赔率要求的最低胜率，选择跟注 (+EV) 是数学上正确的决策。' : '❌ 结论：你的实际胜率达不到底池赔率要求的最低胜率，应果断选择弃牌 (-EV) 止损。'}`,
  };
}

// ============ 诈唬识别题 ============

function generateBluffQuestion(): QuizQuestion {
  const playerCount = pick([2, 6]) as 2 | 6;
  const pos = pick(POSITIONS);
  const stack = pick([25, 40, 60, 80, 100]);
  
  const deck = buildDeck();
  const hand = dealCards(deck, 2);
  const board = dealCards(deck, pick([3, 4]));
  const result = calculateOuts(hand, board, playerCount);
  const stage = board.length === 3 ? '翻牌圈' : '转牌圈';
  
  const potBB = pick([6, 8, 10, 15, 20]);
  
  // 判断场景类型
  const hasDraws = result.outs >= 4; // 有听牌
  const hasMadeHand = result.win >= 60; // 已成牌
  const isWeak = result.win < 25 && result.outs < 4; // 空气牌
  
  // 牌面纹理分析
  const suitCounts: Record<string, number> = {};
  board.forEach(c => { suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1; });
  const isWetBoard = Object.values(suitCounts).some(v => v >= 3); // 单色面
  const boardRanks = board.map(c => RANK_VALUES_[c.rank === '10' ? 'T' : c.rank] || 0).sort((a, b) => a - b);
  const isConnected = boardRanks.some((r, i) => i < boardRanks.length - 1 && boardRanks[i + 1] - r <= 2);
  
  let correctAction: string;
  let explanation: string;
  
  if (hasMadeHand) {
    correctAction = '价值下注';
    explanation = `你当前已经形成了【${result.handName}】，胜率约 ${Math.round(result.win)}%。这是一手强牌，应该通过价值下注从对手那里榨取更多筹码，而不是过牌给对手免费追牌的机会。`;
  } else if (hasDraws && ['CO', 'BTN', 'SB'].includes(pos)) {
    correctAction = '半诈唬下注';
    explanation = `你当前持有【${result.handName}】，虽然还未成牌，但拥有 ${result.outs} 张补牌（${result.outsType}）。在 ${pos} 后位，通过半诈唬下注(Semi-Bluff)，你有两种赢法：①对手弃牌你直接拿下底池；②即使被跟注，你仍有约 ${Math.round(result.totalHit)}% 的概率在后续补到强牌。`;
  } else if (isWeak && ['BTN', 'CO'].includes(pos) && (isWetBoard || isConnected)) {
    correctAction = '过牌';
    explanation = `你持有【${result.handName}】，牌力非常弱且几乎没有补牌。虽然你在 ${pos} 后位，但牌面很湿润（${isWetBoard ? '可能的同花面' : '连续牌面'}），对手在这种牌面上跟注/加注的概率很高。贸然诈唬容易被抓——此时过牌是最安全的选择。`;
  } else if (isWeak && pos === 'BTN') {
    correctAction = '诈唬下注';
    explanation = `你的牌力几乎为零（${result.handName}），但你坐在庄位(BTN)并且牌面相对干燥。在这种情况下，一次合适大小的诈唬下注（约 1/2~2/3 底池）可以迫使对手放弃更好的牌。诈唬的关键在于：选择合适的牌面 + 合适的位置 + 合适的频率。`;
  } else if (hasDraws) {
    correctAction = '过牌';
    explanation = `你持有【${result.handName}】并有 ${result.outs} 张补牌。在 ${pos} 这个位置，半诈唬的风险较大（对手可能加注把你赶走），选择过牌看免费牌是更稳妥的选择，保留追牌权利。`;
  } else {
    correctAction = '过牌';
    explanation = `你持有【${result.handName}】，牌力偏弱且补牌有限。在 ${pos} 位置不适合投入更多筹码，过牌保留止损的灵活性。`;
  }

  const allActions = ['价值下注', '半诈唬下注', '诈唬下注', '过牌', '弃牌'];
  const wrongActions = shuffleArray(allActions.filter(a => a !== correctAction)).slice(0, 3);
  const finalOptions = shuffleArray([correctAction, ...wrongActions]);
  const correctIdx = finalOptions.indexOf(correctAction);

  const difficulty = hasMadeHand ? 'easy' : isWeak ? 'medium' : 'hard';

  return {
    id: randomId(),
    type: 'bluff',
    difficulty: difficulty as any,
    chapter: '诈唬识别',
    progress: '',
    situation: `${playerCount}人桌${stage}，你在 ${pos} 位置，筹码 ${stack}BB。\n\n底池 ${potBB}BB，轮到你行动。`,
    question: '在当前牌面与位置下，你的最优行动是？',
    hand,
    board,
    options: finalOptions.map((v, i) => ({
      id: LABELS[i].toLowerCase(),
      label: LABELS[i],
      value: v,
    })),
    correctOptionId: LABELS[correctIdx].toLowerCase(),
    explanation,
  };
}

// ============ 识别对手风格题 ============

const _styleUsedIndices = new Set<number>();

function generateStyleQuestion(): QuizQuestion {
  const styles = [
    {
      id: 'calling_station',
      name: '松被动 / 跟注站 (Calling Station)',
      desc: '非常喜欢看翻牌，什么牌都舍不得弃。极少主动加注，但面对别人的下注他总是平跟（Call）看下一张牌。',
      situation: '你手持【A♥ K♥】，在一个 A♦ 7♣ 2♠ 的干燥翻牌面。由于你翻前 3Bet，底池已经有 25BB。对手（跟注站）向你过牌。你下注 12BB，他果断跟注。\n\n转牌是一张 4♠，毫无帮助。对手再次过牌。',
      question: '面对一个典型的跟注站，此时你的最佳策略是？',
      correct: '继续价值下注 (Value Bet)',
      wrongs: ['过牌控制底池 (Pot Control)', '全下 (All-in) 试图超池剥削', '做极小的下注诱使他诈唬'],
      explanation: '【剥削跟注站】\n跟注站（Calling Station）的最大特征是“极其不爱弃牌”且“缺乏主动进攻性”。面对这种对手，你的核心剥削策略永远是：**有牌就无情地榨取价值，绝不尝试诈唬他，也不需要过牌诱骗他（因为他很难主动下注诈唬）**。\n\n当前你持有顶对顶踢（TPTK），在一个极其干燥的牌面，他会用大量弱A、甚至中底对、卡顺听牌继续跟注。因此此时最佳行动是继续打出健康的价值下注（Value Bet）。',
      handCards: [{ rank: 'A', suit: 'hearts' }, { rank: 'K', suit: 'hearts' }],
      boardCards: [{ rank: 'A', suit: 'diamonds' }, { rank: '7', suit: 'clubs' }, { rank: '2', suit: 'spades' }, { rank: '4', suit: 'spades' }]
    },
    {
      id: 'maniac',
      name: '疯子 / 松凶 (Maniac)',
      desc: 'VPIP/PFR 极高，拿到任何牌都可能加注、3Bet，翻后下注频率夸张，经常做无脑的超池诈唬。',
      situation: '你手持【J♠ J♣】，在按钮位（BTN）。翻前，这位“疯子”玩家在小盲位（SB）直接做了一个 4 倍的大尺度 3Bet。',
      question: '面对一个疯狂且极度激进的对手，这手牌你目前的基调应该是？',
      correct: '平跟 (Call) 设下陷阱，准备在翻后抓他的诈唬',
      wrongs: ['弃牌 (Fold) 避免高方差', '必定 4Bet All-in 强打', '最小加注 (Min-click) 挑衅他'],
      explanation: '【剥削疯子】\n疯子（Maniac）的范围极其宽阔且充满空气牌，他们极度渴望主动权。面对疯子，你手里有一手强牌（如中大对子 JJ）时，最好的剥削方式往往是**示弱平跟（Call），让他在翻后继续拿着空气牌朝你疯狂开枪（诈唬），从而赢下巨大的底池**。\n\n直接 4Bet 可能会打飞他极宽范围里最弱的那一部分空气牌（只剩强牌和你硬刚）。既然对手喜欢送筹码，那就给他送筹码的空间。',
      handCards: [{ rank: 'J', suit: 'spades' }, { rank: 'J', suit: 'clubs' }],
      boardCards: []
    },
    {
      id: 'nit',
      name: '岩石 / 极紧 (Nit / Rock)',
      desc: '打法极其保守，几乎只玩 AA/KK/QQ/AK。长时间弃牌，一旦主动下注或加注，牌力必定如泰山般坚固。',
      situation: '你手持【K♦ Q♦】，翻牌面是 Q♠ 9♥ 4♣。你击中了顶对好踢脚。你下注半池，这位一直沉默如冰的“岩石”玩家突然过牌-加注（Check-Raise）了你 3 倍！',
      question: '面对这位著名的岩石玩家的突然爆发，你的选择是？',
      correct: '果断弃牌 (Fold)',
      wrongs: ['全下 (All-in) 测试他到底多强', '平跟 (Call) 看转牌有没有提升', '反加回去 (3-Bet) 宣誓主权'],
      explanation: '【剥削岩石】\n岩石（Rock）玩家的特征是极端紧绷，他们平时隐身，一旦在翻后做出“过牌-加注”这种极限展示力量的动作时，底牌几乎百分之百是暗三条（Set）或两对等绝对主导牌。\n\n面对这种极其稀有的信号，你的“顶对好踢脚（KQ）”瞬间变成了一手死牌。正确的剥削（对紧弱和极紧玩家的剥削就体现在绝不支付他们的大牌）就是——**毫无留恋、果断弃牌 (Fold)**。',
      handCards: [{ rank: 'K', suit: 'diamonds' }, { rank: 'Q', suit: 'diamonds' }],
      boardCards: [{ rank: 'Q', suit: 'spades' }, { rank: '9', suit: 'hearts' }, { rank: '4', suit: 'clubs' }]
    },
    {
      id: 'tag',
      name: '紧凶 / 常客玩家 (TAG)',
      desc: '纪律严明，只在前位玩强牌，但在后位擅长利用位置优势偷盲。翻后懂得 C-bet 和适机诈唬。',
      situation: '你手持【A♣ 4♣】在大盲位（BB）。全部弃牌到按钮位（BTN），那位技术稳健的 TAG 常客做了一个标准的 2.5BB 极小加注试探。你前面没有其他玩家。',
      question: '意识到这是一个利用位置常规尝试偷盲的举动，面对 TAG 常客，A4s 是一个用于（  ）的完美牌型？',
      correct: '轻 3Bet 隔离/反偷盲 (Light 3-Bet)',
      wrongs: ['老实平跟 (Call) 等翻牌', '认为自己太弱直接弃牌 (Fold)', '无脑推 All-in (Showhand)'],
      explanation: '【剥削 TAG】\n紧凶（TAG）玩家对位置的理解很深，在 BTN 按钮位他们会用非常宽的范围（包含很多普通高牌和边缘牌）进行开局偷盲（Steal）。\n\n【A♣ 4♣】这样带有 A 阻断牌（Blocker）且具备同花/顺子潜力的小牌，正是对抗宽偷盲范围进行轻 3Bet（Light 3-Bet）反击的完美候选者。面对 3Bet，TAG 如果没有真正强牌大概率会直接弃牌，你直接赢下底池；即使被跟注，翻后你依然有操作空间。',
      handCards: [{ rank: 'A', suit: 'clubs' }, { rank: '4', suit: 'clubs' }],
      boardCards: []
    },
    {
      id: 'calling_station_2',
      name: '松被动 / 跟注站 (Calling Station)',
      desc: '几乎什么牌都跟注，翻前很少加注，翻后只会过牌-跟注。几乎从不诈唬，但也不会主动弃牌。',
      situation: '你手持【K♠ 10♠】，翻牌面是 10♦ 6♥ 3♣。你击中了顶对。底池 12BB，你下注 8BB，跟注站对手跟注。\n\n转牌发出 J♦，你再次下注 15BB，对手依然跟注。河牌发出 2♠，对手依然过牌。底池已有 58BB。',
      question: '面对跟注站在河牌的过牌，你应该？',
      correct: '大额价值下注 (Value Bet)',
      wrongs: ['过牌诱使他诈唬', '最小下注试探', '弃牌放弃底池'],
      explanation: '【剥削跟注站——河牌价值下注】\n面对跟注站，河牌永远不要指望他会主动诈唬（他的进攻频率极低），所以过牌诱骗毫无意义。\n\n你的顶对在这个安全的牌面仍然很可能领先他的范围（他可能拿着底对、中对、弱10、甚至 A 高牌都在跟注你三条街）。正确做法是继续大额下注，跟注站几乎一定会继续支付。',
      handCards: [{ rank: 'K', suit: 'spades' }, { rank: '10', suit: 'spades' }],
      boardCards: [{ rank: '10', suit: 'diamonds' }, { rank: '6', suit: 'hearts' }, { rank: '3', suit: 'clubs' }, { rank: 'J', suit: 'diamonds' }, { rank: '2', suit: 'spades' }]
    },
    {
      id: 'maniac_2',
      name: '疯子 / 松凶 (Maniac)',
      desc: '几乎每手都参与翻前，翻后开枪频率极高，下注尺度夸张。做超池诈唬是家常便饭。',
      situation: '你手持【A♠ A♦】在 CO 位置翻前加注，疯子在大盲位 3Bet 到 12BB，你 4Bet 到 28BB。疯子直接 5Bet All-in（总共 95BB）！\n\n你知道这位疯子在翻前几乎什么牌都会反加。',
      question: '面对疯子的 5Bet All-in，你此时应该怎么做？',
      correct: '迅速跟注 All-in (Snap Call)',
      wrongs: ['弃牌 (Fold) 担心对手有 KK+', '再想想，然后还是弃牌', '过牌等下一手'],
      explanation: '【剥削疯子——不要怕方差】\n面对一个疯子的 5Bet All-in，你手持 AA 是德州扑克中最强的起手牌，对任何对手的任何两张牌都有 80%+ 的胜率。\n\n疯子的 5Bet 范围极其宽广（可能包含 AJ、KQ、甚至更弱的牌），你的 AA 对他的范围有巨大的权益优势。正确的做法是立刻跟注（Snap Call），最大化你的长期 EV。',
      handCards: [{ rank: 'A', suit: 'spades' }, { rank: 'A', suit: 'diamonds' }],
      boardCards: []
    },
    {
      id: 'nit_2',
      name: '岩石 / 极紧 (Nit / Rock)',
      desc: '翻前只玩超级强牌，翻后只在绝对有把握时下注。在牌桌上绝大多数时间都在弃牌。',
      situation: '6 人桌翻前，你在 CO 位加注到 2.5BB。这位平时几乎不参与翻前的岩石玩家（在 BTN 位）突然做了一个冰冷的 3Bet 到 8BB。\n\n你手持【A♠ J♠】。',
      question: '面对一个极紧玩家罕见的 3Bet，你的最佳行动是？',
      correct: '弃牌 (Fold)',
      wrongs: ['4Bet 试探性加注', '跟注看翻牌', '全下 (All-in) 测试他'],
      explanation: '【剥削岩石——翻前读牌】\n岩石/极紧玩家翻前 3Bet 的范围极其狭窄，通常只有 QQ+/AK 甚至更窄。\n\n你的 AJs 虽然是不错的牌，但对上这么紧的 3Bet 范围，你的权益处于明显劣势（对 QQ+ 和 AK 来说，AJs 基本只有 30% 左右的胜率）。正确的做法是纪律性弃牌，等待更好的机会。',
      handCards: [{ rank: 'A', suit: 'spades' }, { rank: 'J', suit: 'spades' }],
      boardCards: []
    },
    {
      id: 'tag_2',
      name: '紧凶 / 常客玩家 (TAG)',
      desc: 'C-bet 频率适中，会在好牌面做频率性的持续下注，但在被跟注后会根据转牌纹理和对手类型调整。',
      situation: 'TAG 常客在 UTG 加注到 3BB，你在 BTN 跟注。翻牌面 K♠ 8♦ 3♣（干燥牌面）。TAG 做了一个 2/3 底池的标准 C-bet，你跟注。\n\n转牌发出 2♥（又是一张空气牌）。TAG 突然过牌。你手持【Q♠ J♠】，完全没有击中。',
      question: 'TAG 在翻牌 C-bet 后在转牌过牌，你应该如何应对？',
      correct: '下注诈唬，代表大K或更强的牌',
      wrongs: ['过牌跟随，放弃底池', '全下 (All-in) 用最大压力', '跟注看河牌'],
      explanation: '【剥削 TAG——利用转牌过牌信号】\nTAG 常客通常会在有牌时持续下注。当他翻牌 C-bet 被跟注后在转牌过牌，这是一个非常强烈的"放弃信号"——他很可能拿着 AQ/AJ 这样没击中的高牌。\n\n你的 QJs 虽然也没击中，但你在 BTN 后位，拥有绝对的位置优势。此时用适当大小的下注代表大 K 进行诈唬，TAG 的大部分弱牌都会弃掉。这种"浮牌诈唬"是对抗 TAG 的经典策略。',
      handCards: [{ rank: 'Q', suit: 'spades' }, { rank: 'J', suit: 'spades' }],
      boardCards: [{ rank: 'K', suit: 'spades' }, { rank: '8', suit: 'diamonds' }, { rank: '3', suit: 'clubs' }, { rank: '2', suit: 'hearts' }]
    },
    {
      id: 'lag',
      name: '松凶 / 激进型 (LAG)',
      desc: '参与率较高且主动进攻。不像疯子那样无脑，LAG 打法有一定章法，擅长在听牌阶段施压和多条街诈唬。',
      situation: '你手持【Q♥ Q♠】在 UTG 加注，LAG 对手在 CO 位 3Bet 到 9BB。你跟注。翻牌面 J♣ 8♦ 5♠，你过牌，LAG 下注 2/3 底池。你跟注。\n\n转牌发出 3♣，你再次过牌。LAG 再次开枪，这次下注几乎是底池大小。',
      question: 'LAG 对手连续两条街施压，你手持 QQ（超对），此时你应当？',
      correct: '跟注 (Call)，用强牌让他继续诈唬',
      wrongs: ['弃牌 (Fold) 避免复杂局面', '全下 (All-in) 反击', '最小加注试图看河牌'],
      explanation: '【剥削 LAG——用强牌抓诈唬】\nLAG 玩家的关键特征是"攻击频率高但并非无章法"。他会用听牌、弱对子、甚至空气牌多条街持续施压。\n\n你的 QQ 在 J-高的牌面上是超对（Overpair），几乎不可能被他大部分下注范围打败。弃牌是完全错误的——你正是他试图用诈唬赶走的人。正确做法是冷静跟注，让他在河牌继续诈唬或放弃。',
      handCards: [{ rank: 'Q', suit: 'hearts' }, { rank: 'Q', suit: 'spades' }],
      boardCards: [{ rank: 'J', suit: 'clubs' }, { rank: '8', suit: 'diamonds' }, { rank: '5', suit: 'spades' }, { rank: '3', suit: 'clubs' }]
    },
    {
      id: 'passive_fish',
      name: '鱼 / 新手型 (Passive Fish)',
      desc: '不了解位置概念，翻前参与率高但很少加注。翻后下注逻辑混乱，有时拿强牌过牌，弱牌下注。',
      situation: '鱼型玩家在 UTG 平跟(Limp)，你在 BTN 手持【A♦ 10♦】加注到 4BB 隔离他。只有他跟注。翻牌面 A♣ 7♠ 5♦。鱼型玩家过牌。\n\n你下注 1/2 底池，他过牌-加注到 3 倍你的下注！',
      question: '新手鱼玩家的过牌-加注通常代表什么？你应该如何应对？',
      correct: '谨慎跟注 (Call)',
      wrongs: ['立刻弃牌 (Fold)', '反加回去 (Re-raise) 试探', '全下 (All-in) 测试他'],
      explanation: '【解读鱼/新手的行为】\n与 TAG 或 LAG 不同，被动型鱼玩家几乎不具备诈唬的概念和勇气。当一个平时只会过牌-跟注的鱼突然做出过牌-加注时，他几乎一定有一手强牌（如两对 A7、暗三条等）。\n\n你的 A10 在面对鱼的过牌-加注时处于危险境地。但由于底池已经很大，最佳做法是谨慎跟注看转牌发展。如果转牌对手继续下大注，应考虑弃牌。',
      handCards: [{ rank: 'A', suit: 'diamonds' }, { rank: '10', suit: 'diamonds' }],
      boardCards: [{ rank: 'A', suit: 'clubs' }, { rank: '7', suit: 'spades' }, { rank: '5', suit: 'diamonds' }]
    }
  ];

  // 无放回抽样：优先选择未用过的模板，全部用完后重置
  if (_styleUsedIndices.size >= styles.length) _styleUsedIndices.clear();
  const available = styles.map((_, i) => i).filter(i => !_styleUsedIndices.has(i));
  const chosenIdx = available[Math.floor(Math.random() * available.length)];
  _styleUsedIndices.add(chosenIdx);
  const profile = styles[chosenIdx];
  const correctIdx = 0;
  const finalOptions = shuffleArray([profile.correct, ...profile.wrongs]);
  const correctFinalIdx = finalOptions.indexOf(profile.correct);

  return {
    id: randomId(),
    type: 'style',
    difficulty: 'easy' as const,
    chapter: '识别对手风格',
    progress: '',
    situation: `【建立对手画像】\n${profile.name}\n特征：${profile.desc}\n\n【对抗场景】\n${profile.situation}`,
    question: profile.question,
    hand: (profile as any).handCards || [],
    board: (profile as any).boardCards || [],
    options: finalOptions.map((v, i) => ({
      id: LABELS[i].toLowerCase(),
      label: LABELS[i],
      value: v,
    })),
    correctOptionId: LABELS[correctFinalIdx].toLowerCase(),
    explanation: profile.explanation,
  };
}

// ============ 公共接口 ============

export function generateQuestion(type?: string, mode?: 'learning' | 'practice', explicitDifficulty?: string): QuizQuestion {
  let q: QuizQuestion;
  let attempts = 0;
  do {
    const questionType = type || pick(['outs', 'equity', 'odds', 'preflop', 'position', 'ev', 'bluff', 'style']);
    switch (questionType) {
      case 'outs': q = generateOutsQuestion(); break;
      case 'equity': q = generateEquityQuestion(); break;
      case 'odds': q = generateOddsQuestion(); break;
      case 'preflop': q = generatePreflopQuestion(); break;
      case 'position': q = generatePositionQuestion(); break;
      case 'ev': q = generateEvQuestion(); break;
      case 'bluff': q = generateBluffQuestion(); break;
      case 'style': q = generateStyleQuestion(); break;
      default: q = generateOutsQuestion(); break;
    }
    
    // 如果有显示指定的确切难度，则只有难度严格匹配时才跳出循环
    if (explicitDifficulty) {
      if (q.difficulty === explicitDifficulty) break;
    } else {
      if (!mode) break;
      if (mode === 'learning' && q.difficulty === 'easy') break;
      if (mode === 'practice' && (q.difficulty === 'medium' || q.difficulty === 'hard')) break;
    }
    
    attempts++;
  } while (attempts < 50);

  return q!;
}

export function generateQuestions(count: number, type?: string, mode?: 'learning' | 'practice', explicitDifficulty?: string): QuizQuestion[] {
  if (type) {
    return Array.from({ length: count }, () => generateQuestion(type, mode, explicitDifficulty));
  }
  // 混合题型：均匀分布
  const types = ['outs', 'equity', 'odds', 'preflop', 'position', 'ev', 'bluff', 'style'];
  return Array.from({ length: count }, (_, i) => generateQuestion(types[i % types.length], mode, explicitDifficulty));
}
