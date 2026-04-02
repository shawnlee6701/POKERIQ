import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Trophy, Clock, CheckCircle, XCircle, Zap, Target } from 'lucide-react';
import { PokerCard } from './PokerCard';
import { QuizQuestion } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import * as api from '../lib/api';

interface ChallengeQuizProps {
  deviceId: string;
  onBack: () => void;
}

const TOTAL_QUESTIONS = 10;
const TIME_PER_QUESTION = 30; // seconds

export const ChallengeQuiz: React.FC<ChallengeQuizProps> = ({ deviceId, onBack }) => {
  const [phase, setPhase] = useState<'loading' | 'playing' | 'result'>('loading');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_QUESTION);
  const [results, setResults] = useState<{ correct: boolean; timeTaken: number }[]>([]);
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);
  const questionStartTime = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Load 10 questions
  useEffect(() => {
    async function load() {
      try {
        const { questions: qs } = await api.generateQuestions(TOTAL_QUESTIONS);
        setQuestions(qs);
        setPhase('playing');
        questionStartTime.current = Date.now();
      } catch {
        // Fallback: generate 10 individual questions
        const fallback: QuizQuestion[] = [];
        for (let i = 0; i < TOTAL_QUESTIONS; i++) {
          try {
            const { question } = await api.generateQuestion();
            fallback.push(question);
          } catch {
            break;
          }
        }
        if (fallback.length > 0) {
          setQuestions(fallback);
          setPhase('playing');
          questionStartTime.current = Date.now();
        }
      }
    }
    load();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (phase !== 'playing' || answered) return;

    setTimeLeft(TIME_PER_QUESTION);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up - auto skip
          clearInterval(timerRef.current!);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, phase, answered]);

  const handleTimeout = useCallback(() => {
    const timeTaken = TIME_PER_QUESTION;
    setAnswered(true);
    setResults(prev => [...prev, { correct: false, timeTaken }]);
    
    setTimeout(() => {
      moveToNext();
    }, 1500);
  }, [currentIndex, questions]);

  const handleAnswer = (optionId: string) => {
    if (answered) return;
    
    if (timerRef.current) clearInterval(timerRef.current);
    
    const timeTaken = (Date.now() - questionStartTime.current) / 1000;
    const isCorrect = optionId === questions[currentIndex].correctOptionId;
    
    setSelectedOptionId(optionId);
    setAnswered(true);
    setResults(prev => [...prev, { correct: isCorrect, timeTaken }]);

    // Record answer
    if (deviceId) {
      api.verifyAnswer({
        deviceId,
        questionType: (questions[currentIndex] as any).type || 'outs',
        isCorrect,
        questionData: questions[currentIndex],
      }).catch(() => {});
    }

    setTimeout(() => {
      moveToNext();
    }, 1500);
  };

  const moveToNext = () => {
    if (currentIndex + 1 >= questions.length) {
      // Challenge complete
      const allResults = [...results];
      // Include current if not already
      const spent = allResults.reduce((s, r) => s + r.timeTaken, 0);
      setTotalTimeSpent(Math.round(spent));
      setPhase('result');
      
      // Submit to backend
      const correctCount = allResults.filter(r => r.correct).length;
      api.submitChallenge({
        deviceId,
        correctCount,
        totalCount: TOTAL_QUESTIONS,
        timeSpentSeconds: Math.round(spent),
      }).catch(() => {});
    } else {
      setCurrentIndex(prev => prev + 1);
      setSelectedOptionId(null);
      setAnswered(false);
      questionStartTime.current = Date.now();
    }
  };

  // ── Loading ──
  if (phase === 'loading') {
    return (
      <div className="flex flex-col h-screen items-center justify-center gap-4">
        <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-on-surface-variant text-sm font-headline">加载挑战题目...</p>
      </div>
    );
  }

  // ── Result ──
  if (phase === 'result') {
    const correctCount = results.filter(r => r.correct).length;
    const accuracy = Math.round((correctCount / TOTAL_QUESTIONS) * 100);
    const avgTime = (totalTimeSpent / TOTAL_QUESTIONS).toFixed(1);
    
    return (
      <div className="flex flex-col min-h-screen">
        <header className="bg-surface-dim/80 backdrop-blur-md fixed top-0 left-0 w-full z-50 border-b border-white/5">
          <div className="max-w-md mx-auto w-full flex items-center px-4 pt-[env(safe-area-inset-top)] h-[calc(4rem+env(safe-area-inset-top))]">
            <button onClick={onBack} className="p-2 mr-2 text-on-surface hover:bg-white/5 rounded-full">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-on-surface text-xl font-headline font-bold uppercase tracking-tight">挑战结果</h1>
          </div>
        </header>

        <main className="flex-1 pt-[calc(5rem+env(safe-area-inset-top))] pb-24 px-2 space-y-6">
          {/* Score Card */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gradient-to-br from-surface-container-high to-surface-container rounded-3xl p-8 text-center border border-white/5 relative overflow-hidden"
          >
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-secondary/10 rounded-full blur-3xl" />
            
            <div className="relative z-10">
              <Trophy className={`w-12 h-12 mx-auto mb-4 ${accuracy >= 80 ? 'text-yellow-400' : accuracy >= 60 ? 'text-primary' : 'text-on-surface-variant'}`} />
              <div className="text-5xl font-headline font-black text-on-surface mb-2">
                {correctCount}<span className="text-2xl text-on-surface-variant">/{TOTAL_QUESTIONS}</span>
              </div>
              <p className="text-on-surface-variant text-sm font-headline mb-6">
                {accuracy >= 80 ? '🔥 表现出色！' : accuracy >= 60 ? '👍 不错，继续加油' : '💪 下次一定更好'}
              </p>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface-container-lowest rounded-xl p-3 border border-white/5">
                  <Target className="w-4 h-4 text-primary mx-auto mb-1" />
                  <p className="text-lg font-headline font-bold text-primary">{accuracy}%</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">正确率</p>
                </div>
                <div className="bg-surface-container-lowest rounded-xl p-3 border border-white/5">
                  <Clock className="w-4 h-4 text-secondary mx-auto mb-1" />
                  <p className="text-lg font-headline font-bold text-secondary">{avgTime}s</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">平均用时</p>
                </div>
                <div className="bg-surface-container-lowest rounded-xl p-3 border border-white/5">
                  <Zap className="w-4 h-4 text-tertiary mx-auto mb-1" />
                  <p className="text-lg font-headline font-bold text-tertiary">{totalTimeSpent}s</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">总用时</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Per-question results */}
          <div className="bg-surface-container rounded-2xl p-4 border border-white/5">
            <h3 className="text-sm font-headline font-bold text-on-surface-variant uppercase tracking-wider mb-3">答题详情</h3>
            <div className="grid grid-cols-5 gap-2">
              {results.map((r, i) => (
                <div 
                  key={i} 
                  onClick={() => setReviewIndex(i)}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border cursor-pointer hover:brightness-110 active:scale-95 transition-all ${
                    r.correct 
                      ? 'bg-primary/10 border-primary/30 text-primary' 
                      : 'bg-error/10 border-error/30 text-error'
                  }`}
                >
                  {r.correct ? <CheckCircle className="w-4 h-4 mb-0.5" /> : <XCircle className="w-4 h-4 mb-0.5" />}
                  <span className="text-[10px] font-bold">Q{i + 1}</span>
                  <span className="text-[9px] opacity-60">{r.timeTaken.toFixed(1)}s</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={onBack}
            className="w-full h-14 rounded-2xl bg-primary text-surface-dim font-headline font-black uppercase tracking-widest shadow-[0_8px_24px_rgba(70,241,197,0.25)] active:scale-[0.98] transition-all"
          >
            返回挑战
          </button>
        </main>

        {/* Review Modal */}
        <AnimatePresence>
          {reviewIndex !== null && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setReviewIndex(null)}
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
                    题目 {reviewIndex + 1} 解析
                  </h3>
                  <button 
                    onClick={() => setReviewIndex(null)}
                    className="px-3 py-1.5 text-sm font-bold bg-surface-container rounded-lg text-on-surface-variant hover:text-on-surface"
                  >
                    关闭
                  </button>
                </div>
                
                <div className="bg-surface-container p-4 rounded-xl border-l-4 border-primary mb-6">
                  {questions[reviewIndex].situation && (
                    <p className="text-on-surface-variant leading-relaxed mb-3 text-sm whitespace-pre-wrap">{questions[reviewIndex].situation}</p>
                  )}
                  <p className="font-bold text-primary text-sm">{questions[reviewIndex].question}</p>
                </div>

                <div className="flex flex-col gap-6 mb-6">
                  {questions[reviewIndex].board && questions[reviewIndex].board.length > 0 && (
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2">公共牌</span>
                      <div className="flex gap-1.5 justify-center">
                        {[...Array(5)].map((_, i) => {
                          const card = questions[reviewIndex].board[i];
                          return card ? (
                            <PokerCard key={i} rank={card.rank} suit={card.suit} size="sm" />
                          ) : (
                            <PokerCard key={i} isBack size="sm" />
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {questions[reviewIndex].hand && questions[reviewIndex].hand.length > 0 && (
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2">你的手牌</span>
                      <div className="flex gap-2">
                        {questions[reviewIndex].hand.map((card, idx) => (
                          <PokerCard key={idx} rank={card.rank} suit={card.suit} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                  <h4 className="text-primary font-bold mb-2 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" /> 正确答案
                  </h4>
                  <p className="text-on-surface font-medium whitespace-pre-wrap leading-relaxed text-sm">
                    {questions[reviewIndex].options.find(o => o.id === questions[reviewIndex].correctOptionId)?.value}
                  </p>
                </div>
                
                {questions[reviewIndex].explanation && (
                  <div className="mt-4 bg-tertiary/10 border border-tertiary/20 rounded-xl p-4">
                    <h4 className="text-tertiary font-bold mb-2 flex items-center gap-2">
                      实战决策指引
                    </h4>
                    <p className="text-on-surface-variant leading-relaxed text-sm whitespace-pre-wrap">
                      {questions[reviewIndex].explanation}
                    </p>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Playing ──
  const question = questions[currentIndex];
  const timerPercent = (timeLeft / TIME_PER_QUESTION) * 100;
  const isTimeWarning = timeLeft <= 5;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-surface-dim/80 backdrop-blur-md fixed top-0 left-0 w-full z-50 border-b border-white/5">
        <div className="max-w-md mx-auto w-full flex items-center justify-between px-4 pt-[env(safe-area-inset-top)] h-[calc(4rem+env(safe-area-inset-top))]">
          <div className="flex items-center">
            <button onClick={() => setShowExitConfirm(true)} className="h-10 w-10 mr-2 flex items-center justify-center rounded-lg hover:bg-white/5 active:scale-95 transition-all text-on-surface-variant">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-on-surface text-lg font-headline font-bold uppercase tracking-tight">每周挑战</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Timer circle */}
            <div className="relative w-10 h-10 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <circle className="text-surface-container-lowest stroke-current" cx="18" cy="18" r="15" fill="none" strokeWidth="3" />
                <circle 
                  className={`stroke-current transition-all duration-1000 ease-linear ${isTimeWarning ? 'text-error' : 'text-primary'}`}
                  cx="18" cy="18" r="15" fill="none" strokeWidth="3"
                  strokeDasharray="94.25"
                  strokeDashoffset={94.25 - (94.25 * timerPercent) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <span className={`absolute text-xs font-headline font-bold ${isTimeWarning ? 'text-error animate-pulse' : 'text-on-surface'}`}>
                {timeLeft}
              </span>
            </div>
            {/* Progress */}
            <span className="text-secondary text-sm font-black font-headline tracking-widest">
              {currentIndex + 1}/{TOTAL_QUESTIONS}
            </span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="max-w-md mx-auto w-full px-4 pb-2">
          <div className="h-1 bg-surface-container-lowest rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((currentIndex + 1) / TOTAL_QUESTIONS) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </header>

      <main className="flex-grow px-2 pt-[calc(6rem+env(safe-area-inset-top))] pb-8 max-w-xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
          >
            {/* Question Info */}
            {(() => {
              const TYPE_LABELS: Record<string, { text: string; color: string }> = {
                outs:    { text: '补牌计算', color: 'text-primary bg-primary/10 border-primary/20' },
                odds:    { text: '赔率计算', color: 'text-tertiary bg-tertiary/10 border-tertiary/20' },
                equity:  { text: '胜率判断', color: 'text-secondary bg-secondary/10 border-secondary/20' },
                preflop: { text: '翻前策略', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
              };
              const DIFF_LABELS: Record<string, { text: string; color: string }> = {
                easy:   { text: '容易', color: 'text-green-400 bg-green-400/10 border-green-400/20' },
                medium: { text: '中等', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
                hard:   { text: '困难', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
              };
              const typeInfo = TYPE_LABELS[(question as any).type] || TYPE_LABELS.outs;
              const diffInfo = DIFF_LABELS[(question as any).difficulty] || DIFF_LABELS.easy;
              return (
                <div className="bg-surface-container p-4 rounded-xl border-l-4 border-primary mb-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                  <div className="flex gap-2 mb-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight border ${typeInfo.color}`}>
                      {typeInfo.text}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight border ${diffInfo.color}`}>
                      {diffInfo.text}
                    </span>
                  </div>
                  {question.situation && (
                    <p className="text-on-surface-variant leading-relaxed mb-3 text-sm">{question.situation}</p>
                  )}
                  <p className="font-bold text-primary text-sm">{question.question}</p>
                </div>
              );
            })()}

            {/* Cards */}
            <section className="flex flex-col items-center gap-6 mb-8">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2">公共牌</span>
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
                <span className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2">你的手牌</span>
                <div className="flex gap-2">
                  {question.hand.map((card, i) => (
                    <PokerCard key={i} rank={card.rank} suit={card.suit} />
                  ))}
                </div>
              </div>
            </section>

            {/* Options */}
            <section className="space-y-3">
              {question.options.map((option) => {
                const isSelected = selectedOptionId === option.id;
                const isCorrect = option.id === question.correctOptionId;
                const showResult = answered;

                let optionStyle = 'bg-surface-container-high border border-white/5 hover:bg-surface-container-highest active:scale-[0.98]';
                if (showResult && isCorrect) {
                  optionStyle = 'bg-primary/15 border-2 border-primary';
                } else if (showResult && isSelected && !isCorrect) {
                  optionStyle = 'bg-error/15 border-2 border-error';
                } else if (isSelected) {
                  optionStyle = 'bg-primary/10 border-2 border-primary shadow-[0_0_20px_rgba(70,241,197,0.1)] scale-[1.01]';
                }

                return (
                  <button
                    key={option.id}
                    disabled={answered}
                    onClick={() => !answered && setSelectedOptionId(option.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${optionStyle}`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center text-sm transition-colors ${
                        showResult && isCorrect ? 'bg-primary text-surface-dim' 
                        : showResult && isSelected ? 'bg-error text-white' 
                        : isSelected ? 'bg-primary text-surface-dim' 
                        : 'bg-surface-container text-on-surface-variant'
                      }`}>
                        {option.label}
                      </span>
                      <span className={`text-base font-semibold ${
                        showResult && isCorrect ? 'text-primary' 
                        : showResult && isSelected ? 'text-error' 
                        : 'text-on-surface'
                      }`}>
                        {option.value}
                      </span>
                    </div>
                    {showResult && isCorrect && <CheckCircle className="w-6 h-6 text-primary" />}
                    {showResult && isSelected && !isCorrect && <XCircle className="w-6 h-6 text-error" />}
                  </button>
                );
              })}
            </section>

            {/* Timeout overlay */}
            {answered && !selectedOptionId && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 text-center text-error font-bold font-headline text-sm"
              >
                ⏰ 时间到！
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Action Button */}
      {!answered && (
        <footer className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-[#0D0D14] via-[#0D0D14]/95 to-transparent z-40">
          <div className="max-w-xl mx-auto">
            <button
              disabled={!selectedOptionId}
              onClick={() => selectedOptionId && handleAnswer(selectedOptionId)}
              className={`w-full flex items-center justify-center h-14 rounded-xl transition-all group ${
                selectedOptionId 
                  ? 'bg-primary shadow-[0_8px_24px_rgba(70,241,197,0.25)] active:scale-[0.97]' 
                  : 'bg-surface-container-highest text-on-surface-variant cursor-not-allowed'
              }`}
            >
              <span className={`font-headline font-extrabold text-base uppercase tracking-widest ${selectedOptionId ? 'text-surface-dim' : ''}`}>确认</span>
            </button>
          </div>
        </footer>
      )}

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
              <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">当前答题进度不会被保存，已完成的题目将不计入排行榜。</p>
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
