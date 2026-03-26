import React, { useEffect } from 'react';
import { Trophy, XCircle } from 'lucide-react';

interface ChapterResultProps {
  data: {
    chapterId: string;
    chapterName: string;
    correct: number;
    total: number;
    isPassed: boolean;
  };
  onNextLevel: () => void;
  onRetry: () => void;
  onBack: () => void;
}

export const ChapterResult: React.FC<ChapterResultProps> = ({ data, onNextLevel, onRetry, onBack }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const percentage = Math.round((data.correct / data.total) * 100);

  return (
    <div className="text-on-surface font-sans flex flex-col items-center justify-center min-h-[80vh] px-6">
      <div className={`w-24 h-24 mb-6 rounded-full flex items-center justify-center border-4 shadow-[0_0_40px_rgba(0,0,0,0.3)] ${
        data.isPassed ? 'bg-primary/20 border-primary text-primary shadow-primary/30' : 'bg-error/20 border-error text-error shadow-error/30'
      }`}>
        {data.isPassed ? <Trophy className="w-12 h-12" /> : <XCircle className="w-12 h-12" />}
      </div>

      <h1 className="text-3xl font-headline font-extrabold mb-2 uppercase tracking-wide text-center">
        {data.isPassed ? '恭喜通关！' : '挑战失败'}
      </h1>
      <p className="text-surface-variant-light font-bold mb-8">
        {data.chapterName}
      </p>

      <div className="bg-surface-container-high w-full max-w-sm rounded-[2rem] p-6 mb-10 border border-white/5 shadow-xl text-center">
        <p className="text-sm font-black tracking-widest text-on-surface-variant uppercase mb-4">最终成绩</p>
        <div className="text-6xl font-headline font-black mb-2 flex items-baseline justify-center">
          {data.correct} <span className="text-3xl text-on-surface-variant ml-1">/ {data.total}</span>
        </div>
        <p className={`text-sm font-bold ${data.isPassed ? 'text-primary' : 'text-error'}`}>
          正确率 {percentage}%
        </p>

        <div className="w-full bg-surface-dim h-2 rounded-full mt-6 overflow-hidden">
          <div 
            className={`h-full rounded-full ${data.isPassed ? 'bg-primary' : 'bg-error'}`} 
            style={{ width: `${percentage}%` }}
          />
        </div>

        <p className="text-xs text-on-surface-variant mt-4">
          及格线：8 / {data.total} 题
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {data.isPassed ? (
          <button 
            onClick={onNextLevel}
            className="w-full bg-primary text-surface-dim font-headline font-extrabold text-base uppercase tracking-widest h-14 rounded-xl flex items-center justify-center gap-2 hover:bg-primary-dark transition-all shadow-[0_8px_24px_rgba(70,241,197,0.25)] active:scale-95"
          >
            下一关卡
          </button>
        ) : (
          <button 
            onClick={onRetry}
            className="w-full bg-error text-white font-headline font-extrabold text-base uppercase tracking-widest h-14 rounded-xl flex items-center justify-center gap-2 hover:bg-error-dark transition-all shadow-[0_8px_24px_rgba(240,68,56,0.25)] active:scale-95"
          >
            重新挑战
          </button>
        )}
        
        <button 
          onClick={onBack}
          className="w-full bg-surface-container text-on-surface font-headline font-bold text-sm tracking-widest h-14 rounded-xl flex items-center justify-center gap-2 hover:bg-surface-container-high transition-all active:scale-95"
        >
          返回
        </button>
      </div>
    </div>
  );
};
