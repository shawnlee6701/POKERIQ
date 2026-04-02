import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PokerCard } from './PokerCard';
import { QuizQuestion } from '../types';

interface QuizProps {
  question: QuizQuestion;
  onAnswer: (optionId: string) => void;
  onBack: () => void;
}

const TYPE_LABELS: Record<string, { text: string; color: string }> = {
  outs:     { text: '补牌计算', color: 'text-primary bg-primary/10 border-primary/20' },
  odds:     { text: '赔率计算', color: 'text-tertiary bg-tertiary/10 border-tertiary/20' },
  equity:   { text: '胜率判断', color: 'text-secondary bg-secondary/10 border-secondary/20' },
  preflop:  { text: '翻前策略', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  position: { text: '位置策略', color: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20' },
  ev:       { text: 'EV 决策',  color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  bluff:    { text: '诈唬识别', color: 'text-rose-400 bg-rose-400/10 border-rose-400/20' },
  style:    { text: '对手风格', color: 'text-fuchsia-400 bg-fuchsia-400/10 border-fuchsia-400/20' },
  mixed:    { text: '综合实战', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
};

const DIFF_LABELS: Record<string, { text: string; color: string }> = {
  easy:   { text: '容易', color: 'text-green-400 bg-green-400/10 border-green-400/20' },
  medium: { text: '中等', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
  hard:   { text: '困难', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
};

export const Quiz: React.FC<QuizProps> = ({ question, onAnswer, onBack }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handleConfirm = () => {
    if (selectedOptionId && !isSubmitting) {
      setIsSubmitting(true);
      onAnswer(selectedOptionId);
    }
  };

  const typeInfo = TYPE_LABELS[question.type] || TYPE_LABELS.outs;
  const diffInfo = DIFF_LABELS[question.difficulty] || DIFF_LABELS.easy;

  return (
    <div className="text-on-surface font-sans flex flex-col h-full">
      {/* Header & Progress Bar */}
      <header className="bg-surface-dim/80 backdrop-blur-md fixed top-0 left-0 w-full z-50 border-b border-white/5">
        <div className="max-w-md mx-auto w-full flex items-center justify-between px-4 pt-[env(safe-area-inset-top)] h-[calc(4rem+env(safe-area-inset-top))]">
          <div className="flex items-center overflow-hidden">
            <button 
              onClick={() => setShowExitConfirm(true)}
              disabled={isSubmitting}
              className="p-2 mr-2 text-on-surface hover:bg-white/5 rounded-full disabled:opacity-50"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-on-surface text-xl font-headline font-bold uppercase tracking-tight truncate">
              {question.chapter}
            </h1>
          </div>
          <div className="flex items-center px-2">
            <span className="text-secondary text-sm font-black font-headline tracking-widest">{question.progress}</span>
          </div>
        </div>
      </header>

      <main className="flex-grow px-6 pt-[calc(5rem+env(safe-area-inset-top))] pb-36 max-w-xl mx-auto w-full">
        <header className="mb-8">
          {/* 2 Tags: 题目类型 + 难度 */}
          <div className="flex gap-2 mb-4">
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight border ${typeInfo.color}`}>
              {typeInfo.text}
            </span>
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight border ${diffInfo.color}`}>
              {diffInfo.text}
            </span>
          </div>
          
          {/* 场景描述 + 问题 */}
          <div className="bg-surface-container p-5 rounded-xl border-l-4 border-primary shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <p className="text-on-surface-variant leading-relaxed mb-4 text-sm">
              {question.situation}
            </p>
            <div className="flex items-center gap-3 bg-tertiary/10 p-3 rounded-lg border border-tertiary/20">
              <HelpCircle className="w-5 h-5 text-tertiary fill-tertiary/20 shrink-0" />
              <p className="font-bold text-tertiary text-sm">{question.question}</p>
            </div>
          </div>
        </header>

        {/* Card Display Section */}
        <section className="flex flex-col items-center gap-8 mb-10">
          {question.type !== 'preflop' && (
            <div className="flex flex-col items-center w-full">
              <span className="text-xs font-black text-secondary uppercase tracking-[0.2em] mb-4">公共牌</span>
              <div className="flex gap-2 justify-center">
                {[...Array(5)].map((_, i) => {
                  const card = question.board[i];
                  return card ? (
                    <PokerCard key={i} rank={card.rank} suit={card.suit} size="sm" />
                  ) : (
                    <PokerCard key={i} isBack size="sm" />
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col items-center w-full">
            <span className="text-xs font-black text-secondary uppercase tracking-[0.2em] mb-4">你的手牌</span>
            <div className="flex gap-3">
              {question.hand.map((card, i) => (
                <PokerCard key={i} rank={card.rank} suit={card.suit} size="lg" />
              ))}
            </div>
          </div>
        </section>

        {/* Options Section */}
        <section className="space-y-3">
          {question.options.map((option) => {
            const isSelected = selectedOptionId === option.id;
            return (
              <button
                key={option.id}
                disabled={isSubmitting}
                onClick={() => setSelectedOptionId(option.id)}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all disabled:opacity-75 ${
                  isSelected 
                    ? 'bg-primary/10 border-2 border-primary shadow-[0_0_20px_rgba(70,241,197,0.1)] scale-[1.01]' 
                    : 'bg-surface-container-high border border-white/5 hover:bg-surface-container-highest active:scale-[0.98]'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center text-sm transition-colors ${
                    isSelected ? 'bg-primary text-surface-dim' : 'bg-surface-container text-on-surface-variant'
                  }`}>
                    {option.label}
                  </span>
                  <span className={`text-base font-semibold ${isSelected ? 'text-primary' : 'text-on-surface'}`}>
                    {option.value}
                  </span>
                </div>
              </button>
            );
          })}
        </section>
      </main>

      {/* Action Button */}
      <footer className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-[#0D0D14] via-[#0D0D14]/95 to-transparent z-40">
        <div className="max-w-xl mx-auto">
          <button
            disabled={!selectedOptionId || isSubmitting}
            onClick={handleConfirm}
            className={`w-full flex items-center justify-center h-14 rounded-xl transition-all group ${
              selectedOptionId 
                ? 'bg-primary shadow-[0_8px_24px_rgba(70,241,197,0.25)] active:scale-[0.97]' 
                : 'bg-surface-container-highest text-on-surface-variant cursor-not-allowed'
            } ${isSubmitting ? 'opacity-70 pointer-events-none' : ''}`}
          >
            <span className={`font-headline font-extrabold text-base uppercase tracking-widest ${selectedOptionId ? 'text-surface-dim' : ''}`}>
              {isSubmitting ? '提交中...' : '确认'}
            </span>
          </button>
        </div>
      </footer>

      {/* Exit Confirmation Modal */}
      <AnimatePresence>
        {showExitConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExitConfirm(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80]"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] max-w-sm bg-surface-container-high rounded-2xl p-6 z-[90] border border-white/10 shadow-2xl"
            >
              <h3 className="text-on-surface font-headline font-bold text-lg mb-2">确认退出？</h3>
              <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">当前题目进度不会被保存。</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 h-12 rounded-xl bg-surface-container border border-white/10 text-on-surface font-headline font-bold uppercase tracking-wider text-sm hover:bg-surface-container-highest active:scale-[0.97] transition-all"
                >
                  继续答题
                </button>
                <button
                  onClick={onBack}
                  className="flex-1 h-12 rounded-xl bg-error/20 border border-error/30 text-error font-headline font-bold uppercase tracking-wider text-sm hover:bg-error/30 active:scale-[0.97] transition-all"
                >
                  确认退出
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
