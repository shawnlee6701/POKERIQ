export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type PlayerCount = 2 | 6 | 9;

export type Screen = 'calculator' | 'training' | 'challenge' | 'challenge-quiz' | 'profile' | 'quiz' | 'feedback' | 'chapter-result' | 'faq' | 'privacy' | 'agreement';

export interface QuizQuestion {
  id: string;
  /** 题目类型：补牌计算 / 赔率计算 / 胜率判断 / 翻前策略 */
  type: 'outs' | 'odds' | 'equity' | 'preflop';
  /** 难度等级 */
  difficulty: 'easy' | 'medium' | 'hard';
  /** 章节名 (用于学习路径) */
  chapter: string;
  /** 进度显示 (如 3/10) */
  progress: string;
  /** 完整场景描述：几人桌、位置、筹码、底池、对手行动等 */
  situation: string;
  /** 问题 */
  question: string;
  hand: Card[];
  board: Card[];
  options: {
    id: string;
    label: string;
    value: string;
  }[];
  correctOptionId: string;
  explanation: string;
}
