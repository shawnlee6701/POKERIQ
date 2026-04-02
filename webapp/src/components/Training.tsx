import React, { useState, useEffect } from 'react';
import { Play, AlertCircle, CheckCircle, ChevronRight, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import * as api from '../lib/api';

interface TrainingProps {
  onStartQuiz: (type?: string, mode?: 'learning' | 'practice', chapter?: any) => void;
  deviceId: string;
}

const DEFAULT_CHAPTERS = [
  { chapter_id: 'ch1', chapter_name: '认识补牌', status: 'unlocked', completed_questions: 0, total_questions: 10 },
  { chapter_id: 'ch2', chapter_name: '赔率计算', status: 'locked', completed_questions: 0, total_questions: 10 },
  { chapter_id: 'ch3', chapter_name: '起手牌选择', status: 'locked', completed_questions: 0, total_questions: 10 },
  { chapter_id: 'ch4', chapter_name: '胜率评估', status: 'locked', completed_questions: 0, total_questions: 10 },
  { chapter_id: 'ch5', chapter_name: '位置与行动', status: 'locked', completed_questions: 0, total_questions: 10 },
  { chapter_id: 'ch6', chapter_name: '识别对手风格', status: 'locked', completed_questions: 0, total_questions: 10 },
  { chapter_id: 'ch7', chapter_name: 'EV 决策', status: 'locked', completed_questions: 0, total_questions: 10 },
  { chapter_id: 'ch8', chapter_name: '诈唬识别', status: 'locked', completed_questions: 0, total_questions: 10 },
  { chapter_id: 'ch9', chapter_name: '综合实战', status: 'locked', completed_questions: 0, total_questions: 10 },
];

export const Training: React.FC<TrainingProps> = ({ onStartQuiz, deviceId }) => {
  const [activeTag, setActiveTag] = React.useState('Random');
  const [wrongCount, setWrongCount] = useState(0);
  const [chapters, setChapters] = useState(DEFAULT_CHAPTERS);
  const [stats, setStats] = useState<any[]>([]);

  useEffect(() => {
    if (deviceId) {
      api.getWrongCount(deviceId).then(r => setWrongCount(r.count)).catch(() => {});
      api.getChapters(deviceId).then(data => {
        if (data && data.length > 0) setChapters(data);
      }).catch(() => {});
      api.getStats(deviceId).then(data => setStats(data)).catch(() => {});
    }
  }, [deviceId]);

  const getChapterType = (id: string) => {
    const map: Record<string, string> = {
      ch1: 'outs',
      ch2: 'odds',
      ch3: 'preflop',
      ch4: 'equity',
      ch5: 'position',
      ch6: 'style',
      ch7: 'ev',
      ch8: 'bluff',
      ch9: 'mixed'
    };
    return map[id] || 'outs';
  };

  const sortedChapters = [...chapters].sort((a, b) => {
    const weight: Record<string, number> = { unlocked: 1, locked: 2, completed: 3 };
    const wA = weight[a.status] || 9;
    const wB = weight[b.status] || 9;
    if (wA !== wB) return wA - wB;
    // 同状态按 chX 序号升序
    const numA = parseInt(a.chapter_id.replace('ch', '')) || 0;
    const numB = parseInt(b.chapter_id.replace('ch', '')) || 0;
    return numA - numB;
  });

  const tags = [
    { 
      id: 'Random', 
      label: '随机', 
      color: 'text-purple-400', 
      borderColor: 'border-purple-400', 
      activeBorderColor: 'border-purple-400/50',
      gradient: 'from-purple-400/15 to-transparent', 
      buttonBg: 'bg-purple-400', 
      shadow: 'shadow-lg shadow-purple-400/40',
      activeShadow: 'shadow-[0_0_15px_rgba(192,132,252,0.15)]',
      desc: '全方位多维度的综合挑战'
    },
    { 
      id: 'easy', 
      label: '容易', 
      color: 'text-primary', 
      borderColor: 'border-primary', 
      activeBorderColor: 'border-primary/50',
      gradient: 'from-primary/15 to-transparent', 
      buttonBg: 'bg-primary', 
      shadow: 'shadow-lg shadow-primary/40',
      activeShadow: 'shadow-[0_0_15px_rgba(70,241,197,0.15)]',
      desc: '基础计算与直观牌面决策'
    },
    { 
      id: 'medium', 
      label: '中等', 
      color: 'text-secondary', 
      borderColor: 'border-secondary', 
      activeBorderColor: 'border-secondary/50',
      gradient: 'from-secondary/15 to-transparent', 
      buttonBg: 'bg-secondary', 
      shadow: 'shadow-lg shadow-secondary/40',
      activeShadow: 'shadow-[0_0_15px_rgba(255,180,162,0.15)]',
      desc: '复杂听牌与动态胜率评估'
    },
    { 
      id: 'hard', 
      label: '困难', 
      color: 'text-rose-400', 
      borderColor: 'border-rose-400', 
      activeBorderColor: 'border-rose-400/50',
      gradient: 'from-rose-400/15 to-transparent', 
      buttonBg: 'bg-rose-400', 
      shadow: 'shadow-lg shadow-rose-400/40',
      activeShadow: 'shadow-[0_0_15px_rgba(251,113,133,0.15)]',
      desc: '贴近实战的极限边缘决策'
    },
  ];

  const activeTagData = tags.find(t => t.id === activeTag) || tags[0];

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0a0f12] text-white pb-24">
      <header className="bg-[#0a0f12]/80 backdrop-blur-xl border-b border-white/5 fixed top-0 left-0 w-full z-50">
        <div className="max-w-md mx-auto w-full flex justify-between items-center px-6 pt-[env(safe-area-inset-top)] h-[calc(4rem+env(safe-area-inset-top))]">
          <h1 className="text-xl font-headline font-black uppercase tracking-widest text-white/90">Poker<span className="text-primary">IQ</span></h1>
        </div>
      </header>

      <main className="mt-[calc(5rem+env(safe-area-inset-top))] space-y-8 w-full">
        {/* Start Practice Hero */}
        <section className="px-1">
          <div className={`bg-[#0a0f12]/50 p-6 rounded-[2rem] flex items-center justify-between mb-4 border-l-4 ${activeTagData.borderColor} border-y border-r border-white/5 relative overflow-hidden transition-all duration-500 shadow-2xl`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${activeTagData.gradient} pointer-events-none transition-all duration-500`} />
            <div className="relative z-10">
              <h2 className="text-2xl font-black font-headline flex items-center gap-2 mb-1">
                {activeTagData.label}练习
              </h2>
              <p className="text-on-surface-variant text-sm font-medium opacity-80">{activeTagData.desc}</p>
            </div>
            <button 
              onClick={() => onStartQuiz(activeTag === 'Random' ? undefined : activeTag.toLowerCase(), 'practice')}
              className={`w-14 h-14 rounded-full ${activeTagData.buttonBg} flex items-center justify-center ${activeTagData.shadow} active:scale-95 transition-all duration-500 relative z-10`}
            >
              <Play className="w-8 h-8 fill-surface-dim text-surface-dim" />
            </button>
          </div>
          
          {/* Quick Start Tags */}
          <div className="flex flex-wrap gap-2 px-1">
            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => setActiveTag(tag.id)}
                className={`px-4 py-2 rounded-xl border transition-all duration-200 text-[11px] font-bold ${
                  activeTag === tag.id
                    ? `bg-[#0a0f12] ${tag.activeBorderColor} ${tag.color} ${tag.activeShadow}`
                    : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                }`}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </section>

        {/* Wrong Question Strengthening - 仅在有错题时显示 */}
        {wrongCount > 0 && (
          <section className="px-1">
            <div 
              onClick={() => onStartQuiz('mistake', 'practice', { isMistake: true, total: wrongCount, current: 1 })}
              className="bg-gradient-to-r from-error/20 to-[#0a0f12] border border-error/30 shadow-[0_4px_20px_rgba(255,87,87,0.15)] p-5 rounded-2xl flex justify-between items-center active:scale-[0.98] transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-error drop-shadow-[0_0_8px_rgba(255,87,87,0.8)]" />
                <span className="font-bold font-headline text-white/90">错题强化</span>
              </div>
              <span className="bg-error text-[#0a0f12] px-3 py-0.5 rounded-full text-xs font-black shadow-[0_0_10px_rgba(255,87,87,0.5)]">{wrongCount}</span>
            </div>
          </section>
        )}

        {/* Learning Path */}
        <section>
          <div className="px-2 mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold font-headline text-white/90 tracking-wide">学习路径</h2>
            <div className="h-px bg-gradient-to-r from-white/10 to-transparent flex-1 ml-4" />
          </div>
          <div className="space-y-3 px-1">
            {sortedChapters.map((ch) => {
              const chNum = parseInt(ch.chapter_id.replace('ch', '')) || 1;
              const chapterLabel = `第${['一','二','三','四','五','六','七','八','九'][chNum - 1] || chNum}章`;
              const isCompleted = ch.status === 'completed';
              const isUnlocked = ch.status === 'unlocked';
              const isLocked = ch.status === 'locked';
              const progress = ch.total_questions > 0 ? ch.completed_questions : 0;

              if (isCompleted) {
                // 直接使用关卡原生记录的历史最后通关正确数（避免用全局 stats 混淆），且通过 Math.min 钳制防脏数据超限
                const correct = (ch as any).correct_questions || 0;
                const total = ch.total_questions || 10;
                const accuracy = Math.min(100, Math.round((correct / total) * 100));

                return (
                  <div 
                    key={ch.chapter_id} 
                    onClick={() => onStartQuiz(getChapterType(ch.chapter_id), 'learning', ch)}
                    className="bg-[#0a0f12]/50 border border-success/20 p-5 rounded-2xl flex items-center justify-between group cursor-pointer opacity-80 shadow-[0_4px_15px_rgba(70,241,197,0.05)] relative overflow-hidden active:scale-[0.98] hover:opacity-100 transition-all"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-success/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                    <div className="flex flex-col gap-1 relative z-10">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{chapterLabel}</span>
                      <h3 className="text-base font-bold text-white/70 font-headline">{ch.chapter_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-success font-headline uppercase drop-shadow-[0_0_5px_rgba(70,241,197,0.5)]">已完成 • 正确率 {accuracy}%</span>
                      </div>
                    </div>
                    <CheckCircle className="w-6 h-6 text-success fill-success/20 relative z-10" />
                  </div>
                );
              }

              if (isUnlocked) {
                return (
                  <div
                    key={ch.chapter_id}
                    onClick={() => onStartQuiz(getChapterType(ch.chapter_id), 'learning', ch)}
                    className="bg-gradient-to-r from-secondary/10 to-[#0a0f12]/50 border-l-4 border-l-secondary border-y border-r border-white/5 p-5 rounded-2xl flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all shadow-[0_8px_20px_rgba(255,180,162,0.1)] relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-secondary/20 transition-colors" />
                    <div className="flex-1 flex flex-col gap-1 relative z-10">
                      <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">{chapterLabel}</span>
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-bold font-headline text-white/90">{ch.chapter_name}</h3>
                        <span className="text-secondary text-[10px] font-black tracking-widest uppercase drop-shadow-[0_0_5px_rgba(255,180,162,0.5)]">进行中</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-bold text-secondary font-headline">{progress} / {ch.total_questions}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-secondary relative z-10 drop-shadow-[0_0_5px_rgba(255,180,162,0.5)]" />
                  </div>
                );
              }

              if (isLocked) {
                return (
                  <div key={ch.chapter_id} className="bg-white/5 border border-white/5 p-5 rounded-2xl flex items-center justify-between opacity-40 grayscale">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{chapterLabel}</span>
                      <h3 className="text-base font-bold font-headline text-white/60">{ch.chapter_name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-white/30 uppercase">待解锁</span>
                      </div>
                    </div>
                    <Lock className="w-5 h-5 text-white/30" />
                  </div>
                );
              }
              return null;
            })}

            <div className="pt-12 pb-8 text-center">
              <p className="text-[11px] font-bold text-white/20 uppercase tracking-[0.2em] relative inline-block">
                <span className="absolute -left-12 top-1/2 -translate-y-1/2 w-8 h-px bg-gradient-to-r from-transparent to-white/10" />
                更多关卡，敬请期待
                <span className="absolute -right-12 top-1/2 -translate-y-1/2 w-8 h-px bg-gradient-to-l from-transparent to-white/10" />
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
