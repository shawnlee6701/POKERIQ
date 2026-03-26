import React, { useEffect } from 'react';
import { CheckCircle, XCircle, Lightbulb, ArrowRight, LogOut } from 'lucide-react';
import { QuizQuestion } from '../types';
import { PokerCard } from './PokerCard';

interface FeedbackProps {
  question: QuizQuestion;
  selectedOptionId: string;
  onNext: () => void;
  onExit: () => void;
}

export const Feedback: React.FC<FeedbackProps> = ({ question, selectedOptionId, onNext, onExit }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const isCorrect = selectedOptionId === question.correctOptionId;
  const correctOption = question.options.find(o => o.id === question.correctOptionId);

  return (
    <div className="text-on-surface font-sans flex flex-col h-full">
      {/* Top App Bar */}
      <header className="fixed top-0 left-0 w-full z-50 bg-surface-dim/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-md mx-auto w-full h-16 flex items-center justify-center px-6">
          <h1 className="font-headline font-bold tracking-tight text-sm text-primary uppercase">训练完成</h1>
        </div>
      </header>

      <main className="flex-1 px-6 pt-24 pb-32 max-w-2xl mx-auto w-full">
        {/* Feedback Card */}
        <section className={`rounded-3xl p-8 mb-8 text-center border relative overflow-hidden ${
          isCorrect ? 'bg-primary/10 border-primary/20' : 'bg-error/10 border-error/20'
        }`}>
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className={`absolute -top-20 -right-20 w-64 h-64 rounded-full blur-[100px] ${
              isCorrect ? 'bg-primary' : 'bg-error'
            }`} />
          </div>
          <div className="relative z-10">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border ${
              isCorrect ? 'bg-primary/20 border-primary/30' : 'bg-error/20 border-error/30'
            }`}>
              {isCorrect ? (
                <CheckCircle className="w-16 h-16 text-primary fill-primary/20" />
              ) : (
                <XCircle className="w-16 h-16 text-error fill-error/20" />
              )}
            </div>
            <h2 className={`text-4xl font-headline font-extrabold mb-2 tracking-tight ${
              isCorrect ? 'text-primary' : 'text-error'
            }`}>
              {isCorrect ? '正确！' : '错误！'}
            </h2>
            <p className="text-on-surface-variant font-medium">
              正确答案是：<span className={`font-bold ${isCorrect ? 'text-primary' : 'text-error'}`}>{correctOption?.value}</span>
            </p>
          </div>
        </section>

        {/* Board & Hand Display */}
        {question.type !== 'preflop' && question.board && question.board.length > 0 && (
          <section className="flex flex-col items-center gap-6 mb-8 bg-surface-container/30 py-6 rounded-2xl border border-white/5">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-3">公共牌</span>
              <div className="flex gap-1.5 justify-center">
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

            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-3">你的手牌</span>
              <div className="flex gap-2">
                {question.hand.map((card, i) => (
                  <PokerCard key={i} rank={card.rank} suit={card.suit} />
                ))}
              </div>
            </div>
          </section>
        )}
        {question.type === 'preflop' && (
          <section className="flex flex-col items-center gap-6 mb-8 bg-surface-container/30 py-6 rounded-2xl border border-white/5">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-3">你的手牌</span>
              <div className="flex gap-2">
                {question.hand.map((card, i) => (
                  <PokerCard key={i} rank={card.rank} suit={card.suit} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Knowledge Card */}
        <section className="bg-surface-container rounded-2xl p-6 mb-8 border border-secondary/10 relative">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-5 h-5 text-tertiary fill-tertiary/20" />
            <h3 className="font-headline text-tertiary font-bold tracking-wide uppercase text-sm">知识点</h3>
          </div>
          <div className="space-y-4 text-on-surface/90 leading-relaxed whitespace-pre-wrap">
            {question.explanation}
          </div>
        </section>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button 
            onClick={onExit}
            className="flex-1 border border-white/10 text-on-surface-variant font-medium py-4 rounded-xl active:scale-95 transition-transform hover:bg-surface-container-high flex items-center justify-center gap-2"
          >
            退出
          </button>
          <button 
            onClick={onNext}
            className="flex-[2] bg-gradient-to-r from-primary to-primary-container text-surface-dim font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-primary/20"
          >
            下一题
          </button>
        </div>
      </main>
    </div>
  );
};
