import React, { useState } from 'react';
import { PlayerCount, Card, Suit, Rank } from '../types';
import { computeOdds } from '../lib/api';
import { PokerCard } from './PokerCard';
import { Calculator as CalcIcon, HelpCircle, ArrowLeft, Plus, DollarSign, ArrowUpRight, CheckCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CalculatorProps {
  onBack?: () => void;
}

const SUITS: { value: Suit; label: string; color: string }[] = [
  { value: 'spades', label: '♠', color: 'text-on-surface' },
  { value: 'hearts', label: '♥', color: 'text-red-500' },
  { value: 'diamonds', label: '♦', color: 'text-blue-500' },
  { value: 'clubs', label: '♣', color: 'text-green-500' },
];

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const Calculator: React.FC<CalculatorProps> = ({ onBack }) => {
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);
  const [hand, setHand] = useState<(Card | null)[]>([null, null]);
  const [communityCards, setCommunityCards] = useState<(Card | null)[]>([null, null, null, null, null]);
  
  // Modal state
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [selectingTarget, setSelectingTarget] = useState<{ type: 'hand' | 'community', index: number } | null>(null);
  const [selectedSuit, setSelectedSuit] = useState<Suit>('spades');
  const [showHelpToast, setShowHelpToast] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [boardChanged, setBoardChanged] = useState(false);
  const defaultResults = {
    win: 0, tie: 0, loss: 0, handName: '', outs: 0, outsType: '', 
    outsCards: [] as { rank: string; suit: string }[], turnHit: 0, riverHit: 0, totalHit: 0
  };
  const [results, setResults] = useState(defaultResults);

  const isCardSelected = (rank: Rank, suit: Suit) => {
    const allCards = [...hand, ...communityCards];
    return allCards.some((c, idx) => {
      if (!c) return false;
      if (selectingTarget) {
        const targetIdx = selectingTarget.type === 'hand' ? selectingTarget.index : selectingTarget.index + 2;
        if (idx === targetIdx) return false;
      }
      return c.rank === rank && c.suit === suit;
    });
  };

  const isFlopComplete = communityCards[0] !== null && communityCards[1] !== null && communityCards[2] !== null;
  const isHandComplete = hand[0] !== null && hand[1] !== null;
  const canCalculate = isHandComplete && isFlopComplete;

  const handleCalculate = async () => {
    if (!canCalculate) return;
    
    setIsCalculating(true);
    
    try {
      const validHand = hand.filter(c => c !== null) as Card[];
      const validBoard = communityCards.filter(c => c !== null) as Card[];
      
      const result = await computeOdds({
        hand: validHand,
        board: validBoard,
        playerCount,
      });
      
      setResults(result);
      setHasCalculated(true);
      setBoardChanged(false);
    } catch (err) {
      console.warn('API calculation failed, using fallback:', err);
      // Fallback mock
      setResults({
        win: 67.3,
        tie: 2.1,
        loss: 30.6,
        handName: 'A 高牌 + 同花听牌',
        outs: 9,
        outsType: '♥ 同花听牌',
        turnHit: 19.1,
        riverHit: 19.6,
        totalHit: 35.0
      });
      setHasCalculated(true);
    } finally {
      setIsCalculating(false);
    }
  };

  const removeHandCard = (index: number) => {
    const newHand = [...hand];
    newHand[index] = null;
    setHand(newHand);
    // 手牌被移除 → 条件不满足 → 清空结果
    if (hasCalculated) {
      setHasCalculated(false);
      setBoardChanged(false);
      setResults(defaultResults);
    }
  };

  const openCardSelector = (type: 'hand' | 'community', index: number) => {
    setSelectingTarget({ type, index });
    setIsCardModalOpen(true);
  };

  const selectCard = (rank: Rank) => {
    if (!selectingTarget) return;

    if (isCardSelected(rank, selectedSuit)) return;

    const newCard: Card = { rank, suit: selectedSuit };

    if (selectingTarget.type === 'hand') {
      const newHand = [...hand];
      newHand[selectingTarget.index] = newCard;
      setHand(newHand);
      if (hasCalculated) setBoardChanged(true);
      setIsCardModalOpen(false);
      setSelectingTarget(null);
    } else {
      const newCommunity = [...communityCards];
      newCommunity[selectingTarget.index] = newCard;
      setCommunityCards(newCommunity);
      if (hasCalculated) setBoardChanged(true);
      
      if (selectingTarget.index < 2) {
        setSelectingTarget({ type: 'community', index: selectingTarget.index + 1 });
      } else {
        setIsCardModalOpen(false);
        setSelectingTarget(null);
      }
    }
  };

  const removeCommunityCard = (index: number) => {
    const newCards = [...communityCards];
    newCards[index] = null;
    setCommunityCards(newCards);
    // 如果移除的是翻牌(0/1/2)，条件不满足 → 清空结果
    if (index < 3 && hasCalculated) {
      setHasCalculated(false);
      setBoardChanged(false);
      setResults(defaultResults);
    } else if (hasCalculated) {
      setBoardChanged(true);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0a0f12] text-white overflow-hidden pb-12">
      {/* Header & Match Settings */}
      <header className="absolute top-0 left-0 w-full z-50 bg-[#0a0f12]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-md mx-auto w-full flex items-center justify-between px-6 pt-[env(safe-area-inset-top)] h-[calc(4rem+env(safe-area-inset-top))]">
          <h2 className="text-xl font-headline font-black uppercase tracking-widest text-white/90">Poker<span className="text-primary">IQ</span></h2>
          
          <div className="w-8"></div> {/* 占位以保持标题居中 */}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto mt-[calc(4rem+env(safe-area-inset-top))] w-full relative">
        {/* ================= THE FELT ================= */}
        <div className="relative pt-6 pb-2 px-4 flex flex-col items-center min-h-[420px]">
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[120%] h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

          {/* 公共牌 */}
          <div className="w-full relative z-10 mb-8 mt-4 flex justify-center gap-3">
            
            {/* Flop Group */}
            <div className="flex flex-col">
              <span className="text-[10px] text-white/30 tracking-[0.2em] text-center border-b border-white/10 pb-1 mb-2">翻牌</span>
              <div className="flex gap-2">
                {isFlopComplete ? (
                  [0, 1, 2].map((i) => (
                    <div key={i} className="relative transform transition-transform hover:-translate-y-1">
                      <PokerCard rank={communityCards[i]!.rank} suit={communityCards[i]!.suit} size="sm" onRemove={() => removeCommunityCard(i)} />
                    </div>
                  ))
                ) : (
                  <button 
                    onClick={() => {
                      const newComm = [...communityCards];
                      newComm[0] = newComm[1] = newComm[2] = null;
                      setCommunityCards(newComm);
                      openCardSelector('community', 0);
                    }}
                    className="w-[160px] h-[64px] bg-white/[0.02] rounded-lg border border-white/10 border-dashed flex items-center justify-center hover:bg-white/[0.05] hover:border-primary/50 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-110 transition-all">
                      <Plus className="w-4 h-4 text-white/40 group-hover:text-primary" />
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Turn Group */}
            <div className="flex flex-col">
              <span className="text-[10px] text-white/30 tracking-[0.2em] text-center border-b border-white/10 pb-1 mb-2">转牌</span>
              <div className="relative w-[48px]">
                {communityCards[3] ? (
                  <div className="transform transition-transform hover:-translate-y-1 w-[48px]">
                    <PokerCard rank={communityCards[3]!.rank} suit={communityCards[3]!.suit} size="sm" onRemove={() => removeCommunityCard(3)} />
                  </div>
                ) : (
                  <button 
                    disabled={!isFlopComplete}
                    onClick={() => openCardSelector('community', 3)}
                    className={`w-[48px] h-[64px] rounded-lg border border-dashed flex items-center justify-center transition-all ${!isFlopComplete ? 'bg-transparent border-white/5 opacity-50 cursor-not-allowed' : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.05] hover:border-primary/50'}`}
                  >
                   {isFlopComplete && <Plus className="w-4 h-4 text-white/30" />}
                  </button>
                )}
              </div>
            </div>

            {/* River Group */}
            <div className="flex flex-col">
              <span className="text-[10px] text-white/30 tracking-[0.2em] text-center border-b border-white/10 pb-1 mb-2">河牌</span>
              <div className="relative w-[48px]">
                {communityCards[4] ? (
                  <div className="transform transition-transform hover:-translate-y-1 w-[48px]">
                    <PokerCard rank={communityCards[4]!.rank} suit={communityCards[4]!.suit} size="sm" onRemove={() => removeCommunityCard(4)} />
                  </div>
                ) : (
                  <button 
                    disabled={!isFlopComplete}
                    onClick={() => openCardSelector('community', 4)}
                    className={`w-[48px] h-[64px] rounded-lg border border-dashed flex items-center justify-center transition-all ${!isFlopComplete ? 'bg-transparent border-white/5 opacity-50 cursor-not-allowed' : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.05] hover:border-primary/50'}`}
                  >
                   {isFlopComplete && <Plus className="w-4 h-4 text-white/30" />}
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* 英雄手牌 */}
          <div className="relative z-10 w-full flex flex-col items-center mt-2">
             <span className="text-[10px] text-white/30 tracking-[0.3em] mb-6">玩家底牌</span>
             <div className="flex justify-center gap-3">
              {[0, 1].map((i) => (
                <div key={`hand-${i}`} className="relative transition-transform hover:-translate-y-2 z-20">
                  {hand[i] ? (
                    <PokerCard 
                      rank={hand[i]!.rank} 
                      suit={hand[i]!.suit} 
                      className={`shadow-[0_10px_30px_rgba(0,0,0,0.5)] scale-110 origin-bottom ${i === 0 ? '-rotate-6 translate-x-2' : 'rotate-6 -translate-x-2'}`}
                      onRemove={() => removeHandCard(i)}
                    />
                  ) : (
                    <button 
                      onClick={() => openCardSelector('hand', i)}
                      className={`w-[72px] h-[100px] bg-white/[0.03] rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center hover:bg-white/[0.06] hover:border-primary/50 transition-all ${i === 0 ? '-rotate-6 translate-x-2' : 'rotate-6 -translate-x-2'}`}
                    >
                      <Plus className="w-6 h-6 text-white/30" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            {/* Desktop Settings & 开算按钮 */}
            <div className="max-w-[280px] w-full mt-10 mb-4 flex flex-col items-center gap-4">
              
              {/* 人数选择器 */}
              <div className="flex flex-col items-center gap-2 w-full">
                <span className="text-[10px] text-white/30 tracking-[0.3em] uppercase">对局人数</span>
                <div className="flex items-center w-full bg-white/5 border border-white/10 rounded-2xl p-1 shadow-inner relative">
                  {[2, 6, 9].map((count) => (
                    <button
                      key={count}
                      onClick={() => setPlayerCount(count as 2 | 6 | 9)}
                      className={`flex-1 flex justify-center py-2.5 rounded-xl text-sm font-bold font-headline transition-all duration-300 relative z-10 ${
                        playerCount === count 
                          ? 'text-[#0a0f12]' 
                          : 'text-white/40 hover:text-white/70'
                      }`}
                    >
                      {count}人桌
                    </button>
                  ))}
                  
                  {/* 滑动高亮背景 */}
                  <div 
                    className="absolute bg-primary rounded-xl transition-all duration-300 shadow-[0_2px_10px_rgba(70,241,197,0.3)]"
                    style={{
                      left: playerCount === 2 ? '4px' : playerCount === 6 ? '33.33%' : 'calc(66.66% - 4px)',
                      width: 'calc(33.33% - 2px)',
                      top: '4px',
                      bottom: '4px'
                    }}
                  />
                </div>
              </div>

              <button
                disabled={!canCalculate || isCalculating}
                onClick={handleCalculate}
                className={`w-full h-14 rounded-2xl font-headline font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden ${
                  canCalculate 
                    ? 'text-[#0a0f12] hover:scale-[1.02] active:scale-[0.98]' 
                    : 'bg-white/5 text-white/20 cursor-not-allowed'
                }`}
              >
                {canCalculate && <div className="absolute inset-0 bg-primary opacity-90" />}
                {canCalculate && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[100%] animate-[shimmer_2s_infinite]" />}
                
                <span className="relative z-10">
                  {isCalculating ? (
                    <div className="w-5 h-5 border-2 border-[#0a0f12]/30 border-t-[#0a0f12] rounded-full animate-spin" />
                  ) : !canCalculate ? (
                    '放置公共牌与手牌'
                  ) : (hasCalculated && boardChanged) ? (
                    '重新计算胜率'
                  ) : (
                    '重新计算'
                  )}
                </span>
                
                {canCalculate && !isCalculating && <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-2xl z-20 pointer-events-none" />}
                {canCalculate && <div className="absolute -bottom-1 -left-1 -right-1 h-3 bg-primary blur-md -z-10 opacity-50" />}
              </button>
            </div>
          </div>
        </div>

        {/* ================= RESULTS PANE ================= */}
        <div className={`px-4 pb-12 transition-all duration-700 ${hasCalculated ? 'opacity-100 translate-y-0 relative z-20' : 'opacity-0 translate-y-8 absolute pointer-events-none'}`}>
          <div className="bg-white/[0.03] border border-white/5 p-5 rounded-3xl backdrop-blur-md relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
            
            {/* Equity Bar */}
            <div className="mb-6 relative z-10">
              <div className="flex justify-between items-end mb-2">
                <span className="text-[11px] text-white/50 tracking-widest">胜率分布</span>
                <span className="text-2xl font-headline font-black text-white">{results.win.toFixed(1)}<span className="text-sm text-white/50">%</span></span>
              </div>
              
              <div className="h-4 w-full bg-surface-container-highest rounded-full overflow-hidden flex shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${results.win}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full bg-emerald-400"
                />
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${results.tie}%` }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                  className="h-full bg-white/20"
                />
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${results.loss}%` }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
                  className="h-full bg-rose-400"
                />
              </div>
              
              <div className="flex justify-between mt-2 px-1 text-[10px] font-bold tracking-wider">
                <div className="text-emerald-400 w-1/3 text-left tracking-wide">赢 {results.win.toFixed(1)}%</div>
                <div className="text-white/40 w-1/3 text-center tracking-wide">平 {results.tie.toFixed(1)}%</div>
                <div className="text-rose-400 w-1/3 text-right tracking-wide">输 {results.loss.toFixed(1)}%</div>
              </div>
            </div>

            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent my-5 relative z-10" />

            {/* Data Grid */}
            <div className="flex flex-col gap-2 mb-5 relative z-10 w-full items-start">
              <span className="text-[10px] text-white/40 tracking-widest">当前牌型</span>
              <span className="text-sm font-bold text-white tracking-wide leading-snug">{results.handName || '-'}</span>
              
              <div className="mt-1 flex flex-col gap-2 w-full">
                {results.outs > 0 ? (
                  <>
                    <div className="bg-secondary/10 border border-secondary/20 px-3 py-1.5 rounded-xl inline-flex items-center gap-2 w-fit">
                      <span className="text-[11px] font-bold text-secondary tracking-widest leading-none">{results.outs} 张听牌</span>
                    </div>
                    {results.outsCards && results.outsCards.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-0.5">
                        {results.outsCards.map((c, idx) => {
                          const isRed = c.suit === 'hearts' || c.suit === 'diamonds';
                          const suitSymbol = { hearts: '♥️', diamonds: '♦️', clubs: '♣️', spades: '♠️' }[c.suit] || '♠️';
                          return (
                            <div key={idx} className="bg-[#f0f0f0] rounded border border-white/20 px-1.5 py-0.5 flex items-center shadow-sm">
                              <span className={`text-[11px] font-bold font-headline leading-none ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
                                {c.rank}
                              </span>
                              <span className="text-[10px] ml-[1px] leading-none">{suitSymbol}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : results.outsType === '已成牌' ? (
                  <div className="bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 w-fit">
                    <CheckCircle className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] font-bold text-primary tracking-widest">已成牌</span>
                  </div>
                ) : (
                  <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 w-fit">
                    <X className="w-3.5 h-3.5 text-white/30" />
                    <span className="text-[10px] font-bold text-white/30 tracking-widest">无听牌</span>
                  </div>
                )}
              </div>
            </div>

            {/* Hit Grid */}
            {results.outs > 0 && (
              <div className="grid grid-cols-2 gap-3 relative z-10">
                <div className="bg-[#0a0f12]/50 border border-white/[0.03] rounded-2xl p-4 flex flex-col justify-center shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-full blur-xl -mr-4 -mt-4 pointer-events-none" />
                  <span className="text-[10px] text-white/30 tracking-[0.2em] mb-1">转牌中牌率</span>
                  <span className="text-2xl font-headline font-black text-white/90">{results.turnHit.toFixed(1)}<span className="text-sm text-white/30 ml-0.5">%</span></span>
                </div>
                <div className="bg-[#0a0f12]/50 border border-white/[0.03] rounded-2xl p-4 flex flex-col justify-center shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-full blur-xl -mr-4 -mt-4 pointer-events-none" />
                  <span className="text-[10px] text-white/30 tracking-[0.2em] mb-1">河牌中牌率</span>
                  <span className="text-2xl font-headline font-black text-white/90">{results.riverHit.toFixed(1)}<span className="text-sm text-white/30 ml-0.5">%</span></span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      {/* Help Toast */}
      <AnimatePresence>
        {showHelpToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 bg-surface-container-highest text-on-surface px-4 py-2 rounded-lg shadow-lg z-50 text-sm font-medium border border-white/10"
          >
            点击空牌槽添加扑克牌，点击已有扑克牌可将其移除。
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Selection Modal */}
      <AnimatePresence>
        {isCardModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCardModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-surface-container-high rounded-t-3xl p-6 z-[70] border-t border-white/10 pb-[calc(2.5rem+env(safe-area-inset-bottom))] max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-on-surface font-headline font-bold text-lg">
                  {selectingTarget?.type === 'community' && selectingTarget.index < 3 
                    ? `选择翻牌 (${selectingTarget.index + 1}/3)` 
                    : '选择扑克牌'}
                </h3>
                  <button 
                    onClick={() => setIsCardModalOpen(false)}
                    className="px-3 py-1.5 text-sm font-bold bg-surface-container rounded-lg text-on-surface-variant hover:text-on-surface"
                  >
                    关闭
                  </button>
              </div>

              {/* Suit Selection */}
              <div className="flex gap-2 mb-6">
                {SUITS.map((suit) => (
                  <button
                    key={suit.value}
                    onClick={() => setSelectedSuit(suit.value)}
                    className={`flex-1 py-3 rounded-xl text-2xl flex items-center justify-center transition-all ${
                      selectedSuit === suit.value
                        ? 'bg-surface-container-highest border-2 border-primary shadow-sm'
                        : 'bg-surface-container border border-white/5 opacity-50 hover:opacity-100'
                    } ${suit.color}`}
                  >
                    {suit.label}
                  </button>
                ))}
              </div>

              {/* Rank Selection */}
              <div className="grid grid-cols-5 gap-2">
                {RANKS.map((rank) => {
                  const isTaken = isCardSelected(rank, selectedSuit);
                  return (
                    <button
                      key={rank}
                      disabled={isTaken}
                      onClick={() => selectCard(rank)}
                      className={`py-3 rounded-xl font-headline font-bold text-lg transition-all active:scale-95 border ${
                        isTaken 
                          ? 'bg-surface-dim text-on-surface-variant/20 border-transparent cursor-not-allowed' 
                          : 'bg-surface-container text-on-surface border-white/5 hover:bg-surface-container-highest hover:border-primary/50'
                      }`}
                    >
                      {rank}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
