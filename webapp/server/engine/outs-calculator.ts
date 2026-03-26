/**
 * Outs Calculator Engine (v2 - Optimized)
 * 识别听牌类型，计算 Outs 数量，蒙特卡洛模拟估算胜率
 */

export interface Card {
  rank: string;
  suit: string;
}

export interface OutsResult {
  win: number;
  tie: number;
  loss: number;
  handName: string;
  outs: number;
  outsType: string;
  outsCards: Card[];
  turnHit: number;
  riverHit: number;
  totalHit: number;
}

const RANK_VALUES: Record<string, number> = {
  'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
};

const SUIT_NAMES: Record<string, string> = {
  'hearts': '♥️', 'diamonds': '♦️', 'clubs': '♣️', 'spades': '♠️'
};

const SUIT_INDEX: Record<string, number> = {
  'hearts': 0, 'diamonds': 1, 'clubs': 2, 'spades': 3
};

function rankValue(rank: string): number {
  return RANK_VALUES[rank] || 0;
}

function rankLabel(val: number): string {
  const entry = Object.entries(RANK_VALUES).find(([, v]) => v === val);
  return entry ? entry[0] : String(val);
}

// ========== 快速7张牌评估器（不用生成组合） ==========

/**
 * 快速评估7张牌中的最佳5张牌型
 * 返回一个数值分数，越高越好
 * 分数结构：handType * 1000000 + kickers
 */
function evaluateCards(cards: Card[]): { score: number; name: string } {
  const values = cards.map(c => rankValue(c.rank)).sort((a, b) => b - a);
  const suitBuckets: number[][] = [[], [], [], []]; // hearts, diamonds, clubs, spades
  
  cards.forEach(c => {
    const si = SUIT_INDEX[c.suit];
    if (si !== undefined) suitBuckets[si].push(rankValue(c.rank));
  });
  suitBuckets.forEach(b => b.sort((a, b) => b - a));

  // 统计rank频次
  const freq: Record<number, number> = {};
  values.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
  
  const groups = Object.entries(freq)
    .map(([v, c]) => ({ val: Number(v), cnt: c }))
    .sort((a, b) => b.cnt - a.cnt || b.val - a.val);

  // 检测同花 (任一花色5+张)
  let flushSuit = -1;
  let flushCards: number[] = [];
  for (let s = 0; s < 4; s++) {
    if (suitBuckets[s].length >= 5) {
      flushSuit = s;
      flushCards = suitBuckets[s].slice(0, 5);
      break;
    }
  }

  // 检测顺子 (在7张独特值中找5连续)
  const uniqueVals = [...new Set(values)].sort((a, b) => b - a);
  // A 也可以当1
  if (uniqueVals.includes(14)) uniqueVals.push(1);
  
  let straightHigh = 0;
  for (let i = 0; i <= uniqueVals.length - 5; i++) {
    if (uniqueVals[i] - uniqueVals[i + 4] === 4) {
      let isConsecutive = true;
      for (let j = i; j < i + 4; j++) {
        if (uniqueVals[j] - uniqueVals[j + 1] !== 1) { isConsecutive = false; break; }
      }
      if (isConsecutive) {
        straightHigh = uniqueVals[i];
        break;
      }
    }
  }

  // 检测同花顺
  if (flushSuit >= 0) {
    const fVals = [...new Set(suitBuckets[flushSuit])].sort((a, b) => b - a);
    if (fVals.includes(14)) fVals.push(1);
    
    for (let i = 0; i <= fVals.length - 5; i++) {
      if (fVals[i] - fVals[i + 4] === 4) {
        let isConsecutive = true;
        for (let j = i; j < i + 4; j++) {
          if (fVals[j] - fVals[j + 1] !== 1) { isConsecutive = false; break; }
        }
        if (isConsecutive) {
          const sfHigh = fVals[i];
          if (sfHigh === 14) return { score: 9_000_000, name: '皇家同花顺' };
          return { score: 8_000_000 + sfHigh, name: '同花顺' };
        }
      }
    }
  }

  // 四条
  if (groups[0].cnt === 4) {
    const kicker = values.find(v => v !== groups[0].val) || 0;
    return { score: 7_000_000 + groups[0].val * 100 + kicker, name: `四条${rankLabel(groups[0].val)}` };
  }

  // 葫芦
  if (groups[0].cnt === 3 && groups.length >= 2 && groups[1].cnt >= 2) {
    return { score: 6_000_000 + groups[0].val * 100 + groups[1].val, name: `${rankLabel(groups[0].val)}满${rankLabel(groups[1].val)}` };
  }

  // 同花
  if (flushSuit >= 0) {
    const fScore = flushCards.reduce((s, v, i) => s + v * Math.pow(15, 4 - i), 0);
    return { score: 5_000_000 + fScore, name: `${rankLabel(flushCards[0])}高同花` };
  }

  // 顺子
  if (straightHigh > 0) {
    return { score: 4_000_000 + straightHigh, name: `${rankLabel(straightHigh)}高顺子` };
  }

  // 三条
  if (groups[0].cnt === 3) {
    const kickers = values.filter(v => v !== groups[0].val).slice(0, 2);
    return { score: 3_000_000 + groups[0].val * 10000 + kickers[0] * 100 + (kickers[1] || 0), name: `三条${rankLabel(groups[0].val)}` };
  }

  // 两对
  if (groups[0].cnt === 2 && groups.length >= 2 && groups[1].cnt === 2) {
    const hi = Math.max(groups[0].val, groups[1].val);
    const lo = Math.min(groups[0].val, groups[1].val);
    const kicker = values.find(v => v !== hi && v !== lo) || 0;
    return { score: 2_000_000 + hi * 10000 + lo * 100 + kicker, name: `${rankLabel(hi)}和${rankLabel(lo)}两对` };
  }

  // 一对
  if (groups[0].cnt === 2) {
    const kickers = values.filter(v => v !== groups[0].val).slice(0, 3);
    return { score: 1_000_000 + groups[0].val * 100000 + kickers[0] * 1000 + (kickers[1] || 0) * 10 + (kickers[2] || 0), name: `一对${rankLabel(groups[0].val)}` };
  }

  // 高牌
  const kScore = values.slice(0, 5).reduce((s, v, i) => s + v * Math.pow(15, 4 - i), 0);
  return { score: kScore, name: `${rankLabel(values[0])} 高牌` };
}

// ========== 听牌检测 ==========

function detectFlushDraw(hand: Card[], board: Card[]): { outs: number; type: string; suit: string } | null {
  const suitCounts: Record<string, { total: number; handCount: number }> = {};
  hand.forEach(c => {
    if (!suitCounts[c.suit]) suitCounts[c.suit] = { total: 0, handCount: 0 };
    suitCounts[c.suit].total++;  suitCounts[c.suit].handCount++;
  });
  board.forEach(c => {
    if (!suitCounts[c.suit]) suitCounts[c.suit] = { total: 0, handCount: 0 };
    suitCounts[c.suit].total++;
  });

  for (const [suit, d] of Object.entries(suitCounts)) {
    if (d.total >= 5) return null; // 已成同花
    if (d.total === 4 && d.handCount >= 1) return { outs: 9, type: '同花听牌', suit };
  }
  return null;
}

function detectStraightDraw(hand: Card[], board: Card[]): { outs: number; type: string; missingRanks?: number[] } | null {
  const allValues = [...new Set([...hand, ...board].map(c => rankValue(c.rank)))];
  const handValues = new Set(hand.map(c => rankValue(c.rank)));
  if (allValues.includes(14)) { allValues.push(1); }
  if (handValues.has(14)) handValues.add(1);
  const sorted = [...new Set(allValues)].sort((a, b) => a - b);

  // 已成顺?
  for (let i = 0; i <= sorted.length - 5; i++) {
    let ok = true;
    for (let j = i; j < i + 4; j++) {
      if (sorted[j + 1] - sorted[j] !== 1) { ok = false; break; }
    }
    if (ok) return null;
  }

  // 双面顺子 (open-ended): 4连续，两端能延伸
  for (let s = 1; s <= 11; s++) {
    const w = [s, s + 1, s + 2, s + 3];
    if (w.every(v => allValues.includes(v)) && w.some(v => handValues.has(v))) {
      if (s > 1 && s + 3 < 14) return { outs: 8, type: '双面顺子听牌', missingRanks: [s - 1, s + 4] };
    }
  }

  // 卡顺 (gutshot): 5窗口缺1张
  for (let s = 1; s <= 10; s++) {
    const w = [s, s + 1, s + 2, s + 3, s + 4];
    const present = w.filter(v => allValues.includes(v));
    const missing = w.filter(v => !allValues.includes(v));
    if (present.length === 4 && missing.length === 1 && w.some(v => handValues.has(v))) {
      return { outs: 4, type: '卡顺听牌', missingRanks: [missing[0]] };
    }
  }

  return null;
}

function detectPairingOuts(hand: Card[], board: Card[], deck: Card[]): { outs: number; type: string; outsCards: Card[] } | null {
  const handValues = hand.map(c => rankValue(c.rank));
  const boardValues = board.map(c => rankValue(c.rank));
  const maxBoard = Math.max(...boardValues);

  if (handValues.length === 2 && handValues[0] === handValues[1]) {
    if (!boardValues.includes(handValues[0])) {
      const cards = deck.filter(c => rankValue(c.rank) === handValues[0]);
      return { outs: cards.length, type: '暗三条听牌', outsCards: cards };
    }
    return null;
  }

  const outsCards: Card[] = [];
  let overcardCount = 0;
  let tripsCount = 0;
  let kickerCount = 0;

  for (const v of handValues) {
    if (boardValues.includes(v)) {
      const cards = deck.filter(c => rankValue(c.rank) === v);
      outsCards.push(...cards);
      if (cards.length > 0) tripsCount++;
    } else {
      const cards = deck.filter(c => rankValue(c.rank) === v);
      outsCards.push(...cards);
      if (cards.length > 0) {
        if (v > maxBoard) overcardCount++;
        else kickerCount++;
      }
    }
  }

  if (outsCards.length === 0) return null;

  const typeParts: string[] = [];
  if (tripsCount > 0) typeParts.push(`明三条听牌`);
  if (overcardCount > 0) typeParts.push(`${overcardCount}张高牌配对`);
  if (kickerCount > 0 && tripsCount === 0 && overcardCount === 0) typeParts.push(`对子听牌`);

  return { outs: outsCards.length, type: typeParts.join(' + '), outsCards };
}

// ========== 蒙特卡洛模拟（优化版 - Fisher-Yates快速洗牌） ==========

function buildDeck(exclude: Card[]): Card[] {
  const used = new Set(exclude.map(c => `${c.rank}_${c.suit}`));
  const deck: Card[] = [];
  for (const suit of ['hearts', 'diamonds', 'clubs', 'spades']) {
    for (const rank of Object.keys(RANK_VALUES)) {
      if (!used.has(`${rank}_${suit}`)) deck.push({ rank, suit });
    }
  }
  return deck;
}

function fisherYatesShuffle(arr: Card[], n: number): void {
  // 只shuffle前n个元素（不需要完整洗牌）
  for (let i = 0; i < n && i < arr.length - 1; i++) {
    const j = i + Math.floor(Math.random() * (arr.length - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function monteCarloEstimate(hand: Card[], board: Card[], playerCount: number): {
  win: number; tie: number; loss: number;
} {
  const deck = buildDeck([...hand, ...board]);
  const boardToFill = 5 - board.length;
  const cardsNeeded = boardToFill + (playerCount - 1) * 2;
  
  // 根据复杂度调整模拟次数
  const SIMS = playerCount <= 2 ? 800 : (playerCount <= 4 ? 500 : 300);
  
  let wins = 0, ties = 0, losses = 0;

  for (let sim = 0; sim < SIMS; sim++) {
    fisherYatesShuffle(deck, cardsNeeded);
    
    let idx = 0;
    const fullBoard = [...board];
    for (let i = 0; i < boardToFill; i++) fullBoard.push(deck[idx++]);

    const myScore = evaluateCards([...hand, ...fullBoard]).score;

    let isBest = true;
    let hasTie = false;

    for (let opp = 0; opp < playerCount - 1; opp++) {
      const oppHand = [deck[idx++], deck[idx++]];
      const oppScore = evaluateCards([...oppHand, ...fullBoard]).score;
      
      if (oppScore > myScore) { isBest = false; break; }
      else if (oppScore === myScore) hasTie = true;
    }

    if (!isBest) losses++;
    else if (hasTie) ties++;
    else wins++;
  }

  return {
    win: Math.round((wins / SIMS) * 1000) / 10,
    tie: Math.round((ties / SIMS) * 1000) / 10,
    loss: Math.round((losses / SIMS) * 1000) / 10,
  };
}

// ========== 主函数 ==========

export function calculateOuts(
  hand: Card[],
  board: Card[],
  playerCount: number
): OutsResult {
  const handEval = evaluateCards([...hand, ...board]);

  // 5张公共牌全出 → outs=0
  if (board.length >= 5) {
    const mc = monteCarloEstimate(hand, board, playerCount);
    return {
      ...mc,
      handName: handEval.name,
      outs: 0,
      outsType: '公共牌已全部发出',
      outsCards: [],
      turnHit: 0, riverHit: 0, totalHit: 0,
    };
  }

  // ──────────────────────────────────────────────
  // 翻牌/转牌阶段：混合策略精确计算 outs
  // 弱牌（三条以下）：传统听牌检测（同花/顺子/overcard）
  // 强牌（顺子以上）：逐张枚举法检测进一步提升
  // ──────────────────────────────────────────────
  const currentScore = handEval.score;
  const currentType = Math.floor(currentScore / 1_000_000);

  let totalOuts = 0;
  let outsTypeStr = '';
  let outsCards: Card[] = [];

  if (currentType >= 4) {
    // ── 强牌（顺子/同花/葫芦/四条）──
    // 逐张枚举：只统计能进一步提升的牌
    const usedSet = new Set(
      [...hand, ...board].map(c => `${c.rank}_${c.suit}`)
    );
    const ALL_SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
    const ALL_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
    const HAND_TYPE_NAMES: Record<number, string> = {
      9: '皇家同花顺', 8: '同花顺', 7: '四条',
      6: '葫芦', 5: '同花', 4: '顺子',
    };

    const improveTypes: Record<string, number> = {};
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        if (usedSet.has(`${rank}_${suit}`)) continue;
        const newCard = { rank, suit } as Card;
        const newEval = evaluateCards([...hand, ...board, newCard]);
        const newType = Math.floor(newEval.score / 1_000_000);
        // 只统计牌型等级提升的outs（如同花→同花顺），忽略kicker变化
        if (newType > currentType) {
          totalOuts++;
          outsCards.push(newCard);
          const typeName = HAND_TYPE_NAMES[newType] || '提升';
          improveTypes[typeName] = (improveTypes[typeName] || 0) + 1;
        }
      }
    }
    outsTypeStr = Object.entries(improveTypes)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${type}(${count}张)`)
      .join(' + ');
  } else {
    // ── 弱牌（高牌/对子/两对/三条）──
    // 传统听牌检测：给出有意义的 draw outs
    let outsTypes: string[] = [];
    const deck = buildDeck([...hand, ...board]);

    const flushDraw = detectFlushDraw(hand, board);
    if (flushDraw) {
      totalOuts += flushDraw.outs;
      outsTypes.push(`${SUIT_NAMES[flushDraw.suit] || ''} ${flushDraw.type}`);
      outsCards.push(...deck.filter(c => c.suit === flushDraw.suit));
    }

    const straightDraw = detectStraightDraw(hand, board);
    if (straightDraw) {
      const overlap = flushDraw ? 1 : 0;
      totalOuts += straightDraw.outs - overlap;
      outsTypes.push(straightDraw.type);
      outsCards.push(...deck.filter(c => {
        const v = rankValue(c.rank);
        return straightDraw.missingRanks!.includes(v) || (straightDraw.missingRanks!.includes(1) && v === 14);
      }));
    }

    if (totalOuts === 0) {
      const pairingDraw = detectPairingOuts(hand, board, deck);
      if (pairingDraw) {
        totalOuts = pairingDraw.outs;
        outsTypes.push(pairingDraw.type);
        outsCards.push(...pairingDraw.outsCards);
      }
    }
    
    // 去重
    const uniqueMap = new Map<string, Card>();
    for (const c of outsCards) uniqueMap.set(`${c.rank}_${c.suit}`, c);
    outsCards = Array.from(uniqueMap.values());

    outsTypeStr = outsTypes.join(' + ');
  }

  // 二四法则
  const remainingCards = 52 - hand.length - board.length; // Cards left in deck
  const turnHit = board.length === 3 ? Math.round((totalOuts / remainingCards) * 1000) / 10 : 0;
  const riverHit = board.length <= 4 ? Math.round((totalOuts / (remainingCards - (board.length === 3 ? 1 : 0))) * 1000) / 10 : 0;
  
  let totalHit = 0;
  if (board.length === 3) { // From flop to river
    const probMissTurn = (remainingCards - totalOuts) / remainingCards;
    const probMissRiver = (remainingCards - 1 - totalOuts) / (remainingCards - 1); 
    totalHit = Math.round((1 - (probMissTurn * probMissRiver)) * 1000) / 10;
  } else if (board.length === 4) { // From turn to river
    totalHit = riverHit;
  }

  // 蒙特卡洛胜率
  const mc = monteCarloEstimate(hand, board, playerCount);

  let handName = handEval.name;
  if (outsTypeStr && currentType < 4) {
    handName += ' + ' + outsTypeStr;
  }

  return {
    win: mc.win,
    tie: mc.tie,
    loss: mc.loss,
    handName,
    outs: totalOuts,
    outsType: outsTypeStr || (currentScore >= 1_000_000 ? '已成牌' : '无明显听牌'),
    outsCards,
    turnHit,
    riverHit,
    totalHit,
  };
}
