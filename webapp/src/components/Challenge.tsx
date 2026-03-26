import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Clock, Target, Calendar, Award, User, Info, X } from 'lucide-react';
import * as api from '../lib/api';
import { useAuth } from '../App';

// 与 Profile.tsx 保持完全一致的映射表
const AVATAR_SEED_MAP: Record<string, string> = {
  'shark': 'shark-poker-avatar',
  'fish-big': 'goldfish-poker',
  'fish-small': 'bluefish-poker',
  'whale': 'whale-poker-avatar',
  'rock': 'stone-poker',
  'donkey': 'donkey-poker-avatar',
  'gambler': 'gambler-poker-avatar',
  'wizard': 'math-poker-avatar',
  'pokerface': 'pokerface-poker-avatar',
  'bluffer': 'bluff-poker-avatar',
};

function getAvatarUrl(styleId: string): string {
  const seed = AVATAR_SEED_MAP[styleId] || styleId;
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
}

interface ChallengeProps {
  onStartChallenge: () => void;
}

export const Challenge: React.FC<ChallengeProps> = ({ onStartChallenge }) => {
  const { deviceId, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'weekly' | 'all'>('weekly');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [myRank, setMyRank] = useState<any>(null);
  const [challengeInfo, setChallengeInfo] = useState<any>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [todayCount, setTodayCount] = useState(0);
  const [dailyLimit] = useState(10);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const localAvatar = profile?.avatar_style ? getAvatarUrl(profile.avatar_style) : null;
  const localNickname = profile?.nickname || null;

  // 计算本周日 23:59:59 的倒计时
  useEffect(() => {
    const calcRemaining = () => {
      const now = new Date();
      // 本周日 23:59:59
      const dayOfWeek = now.getDay(); // 0=周日
      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      const endOfWeek = new Date(now);
      endOfWeek.setDate(now.getDate() + daysUntilSunday);
      endOfWeek.setHours(23, 59, 59, 999);
      
      const diff = Math.max(0, endOfWeek.getTime() - now.getTime());
      const totalSeconds = Math.floor(diff / 1000);
      
      return {
        days: Math.floor(totalSeconds / 86400),
        hours: Math.floor((totalSeconds % 86400) / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
      };
    };

    setCountdown(calcRemaining());
    timerRef.current = setInterval(() => {
      setCountdown(calcRemaining());
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 加载排行榜数据
  useEffect(() => {
    loadData();
  }, [activeTab, deviceId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [lbResult, challengeResult, todayResult] = await Promise.all([
        api.getLeaderboard(activeTab, deviceId),
        deviceId ? api.getCurrentChallenge(deviceId) : Promise.resolve(null),
        deviceId ? api.getTodayChallengeCount(deviceId) : Promise.resolve({ count: 0, limit: 10 }),
      ]);
      
      const lb = lbResult.leaderboard || [];
      setLeaderboard(lb);
      setMyRank(lbResult.myRank || null);
      setParticipantCount(lb.length);
      if (challengeResult) setChallengeInfo(challengeResult);
      if (todayResult) setTodayCount(todayResult.count);
    } catch (err) {
      console.warn('Failed to load challenge data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const parts = [];
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0 || hrs > 0) parts.push(`${mins}m`);
    parts.push(`${secs}s`);
    return parts.join(' ');
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  // 排名排序
  const sortedLeaderboard = [...leaderboard]
    .sort((a, b) => {
      if ((b.correct_count || b.correct || 0) !== (a.correct_count || a.correct || 0)) {
        return (b.correct_count || b.correct || 0) - (a.correct_count || a.correct || 0);
      }
      return (a.time_spent_seconds || a.timeSpent || 0) - (b.time_spent_seconds || b.timeSpent || 0);
    })
    .map((item, index) => ({ ...item, rank: index + 1 }));

  // 我的排名信息
  const myRankNum = myRank?.rank || (sortedLeaderboard.length + 1);
  const myCorrect = myRank?.correct_count || myRank?.correct || 0;
  const myTime = myRank?.time_spent_seconds || myRank?.timeSpent || 0;
  const beatPercentage = sortedLeaderboard.length > 0
    ? Math.round(((sortedLeaderboard.length - myRankNum + 1) / sortedLeaderboard.length) * 100)
    : 0;

  // 上周数据（来自 challengeInfo 或默认）
  const lastWeekCorrect = challengeInfo?.last_correct || '--';
  const lastWeekTotal = challengeInfo?.last_total || '--';
  const lastWeekTime = challengeInfo?.last_time
    ? formatTime(challengeInfo.last_time)
    : '--';
  const lastWeekRank = challengeInfo?.last_rank || '--';

  // 无数据提示
  const hasLeaderboardData = sortedLeaderboard.length > 0;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0a0f12] text-white pb-24">
      <header className="bg-[#0a0f12]/80 backdrop-blur-xl border-b border-white/5 fixed top-0 left-0 w-full z-50">
        <div className="max-w-md mx-auto w-full flex justify-between items-center px-6 pt-[env(safe-area-inset-top)] h-[calc(4rem+env(safe-area-inset-top))]">
          <h1 className="text-xl font-headline font-black uppercase tracking-widest text-white/90">Poker<span className="text-primary">IQ</span></h1>
        </div>
      </header>

      <main className="mt-[calc(5rem+env(safe-area-inset-top))] space-y-8 w-full px-1">
        {/* Weekly Challenge Banner */}
        <section className="relative overflow-hidden rounded-[2.5rem] bg-[#0a0f12]/40 backdrop-blur-2xl p-7 border border-white/10 shadow-2xl mx-1 group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/5 opacity-50 pointer-events-none" />
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/20 rounded-full blur-[80px] pointer-events-none group-hover:bg-primary/30 transition-colors duration-700" />
          <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-secondary/10 rounded-full blur-[80px] pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-4xl font-headline font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 leading-tight">周赛挑战</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(70,241,197,0.8)]" />
                  <p className="text-primary font-bold text-xs uppercase tracking-[0.2em]">PokerIQ League</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-white/40 font-bold uppercase tracking-[0.2em] mb-1">结赛倒计</span>
                <div className="flex gap-1.5">
                  {[
                    { v: pad(countdown.days), l: 'D' },
                    { v: pad(countdown.hours), l: 'H' },
                    { v: pad(countdown.minutes), l: 'M' },
                    { v: pad(countdown.seconds), l: 'S' }
                  ].map((unit, j) => (
                    <div key={j} className="flex flex-col items-center bg-white/5 border border-white/10 rounded-xl px-2 py-1.5 min-w-[36px] shadow-inner">
                      <span className="text-[15px] font-black font-mono text-white/90 leading-none">{unit.v}</span>
                      <span className="text-[8px] text-white/30 font-bold leading-none mt-1">{unit.l}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between mb-8 mt-4">
              {participantCount > 0 ? (
                <div className="flex items-center gap-3 bg-white/5 py-1.5 px-3 rounded-full border border-white/5 backdrop-blur-sm shadow-inner">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map((i) => {
                      const user = sortedLeaderboard[i - 1];
                      const avatarUrl = user ? getAvatarUrl(user.avatarStyle || 'fish-small') : null;
                      return (
                        <div key={i} className="w-5 h-5 rounded-full border border-[#0a0f12] bg-gradient-to-tr from-white/10 to-white/5 flex items-center justify-center overflow-hidden">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-2.5 h-2.5 text-white/50" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <span className="text-[10px] font-bold text-white/60 tracking-wider">
                    <span className="text-white/90">{participantCount.toLocaleString()}</span> 玩家集结
                  </span>
                </div>
              ) : (
                <span className="text-[11px] font-bold text-white/40 bg-white/5 py-1.5 px-3 rounded-full">
                  等待发牌 🏆
                </span>
              )}
              
              <div className="flex items-center gap-2 bg-[#0a0f12]/50 py-1.5 px-3 rounded-full border border-white/5">
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">今日授权</span>
                <div className="flex gap-1 items-center">
                  <span className="text-xs font-black font-mono mt-0.5 text-white/80">{Math.max(0, dailyLimit - todayCount)}</span>
                  <span className="text-[10px] text-white/30 font-bold mt-0.5 mx-0.5">/</span>
                  <span className="text-[10px] text-white/30 font-bold mt-0.5">{dailyLimit}</span>
                </div>
              </div>
            </div>

            <button 
              onClick={onStartChallenge}
              disabled={todayCount >= dailyLimit}
              className={`relative w-full py-4 rounded-[1.25rem] font-black text-lg tracking-widest flex items-center justify-center gap-2 transition-all duration-300 overflow-hidden ${
                todayCount >= dailyLimit 
                  ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5 shadow-inner'
                  : 'bg-primary text-[#0a0f12] shadow-[0_8px_30px_rgba(70,241,197,0.3)] hover:shadow-[0_0_40px_rgba(70,241,197,0.6)] active:scale-95 group hover:border hover:border-white/20'
              }`}
            >
              {todayCount < dailyLimit && (
                <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-[20deg] translate-x-[-200%] group-hover:translate-x-[300%] transition-transform duration-700 ease-in-out" />
              )}
              {todayCount >= dailyLimit ? '明日再战' : '进入牌局'}
            </button>
          </div>
        </section>

        {/* 上周信息区域 */}
        <div className="flex flex-col gap-3 mt-4 mx-1">
          {/* 上周冠军 (Last Week Champion) */}
          {challengeInfo?.lastWeekChampion && (
            <section className="bg-gradient-to-r from-yellow-400/20 to-orange-400/5 border border-yellow-400/30 rounded-[2rem] p-4 flex items-center shadow-[0_0_15px_rgba(250,204,21,0.1)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-full blur-2xl pointer-events-none" />
              <div className="w-12 h-12 rounded-full border-2 border-yellow-400/50 flex items-center justify-center overflow-hidden bg-[#0a0f12] shadow-inner relative z-10 shrink-0">
                <img src={getAvatarUrl(challengeInfo.lastWeekChampion.avatarStyle || 'shark')} alt="Champion" className="w-full h-full object-cover" />
              </div>
              <div className="ml-4 flex-1 relative z-10 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Award className="w-3.5 h-3.5 text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]" />
                  <h3 className="text-[10px] font-bold text-yellow-400/90 uppercase tracking-widest leading-none">上周冠军</h3>
                </div>
                <p className="text-sm font-black text-white truncate">{challengeInfo.lastWeekChampion.name}</p>
              </div>
              <div className="text-right relative z-10 shrink-0 ml-3">
                <p className="text-sm font-headline font-black text-yellow-500 drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]">
                  {challengeInfo.lastWeekChampion.correct} <span className="text-[10px] text-yellow-500/70 font-sans tracking-normal font-bold">题</span>
                </p>
                <p className="text-[11px] font-headline font-bold text-white/80 mt-0.5">{formatTime(challengeInfo.lastWeekChampion.timeSpent)}</p>
              </div>
            </section>
          )}

          {/* 上周战绩 (Last Week Results) */}
          {challengeInfo?.last_correct !== undefined && (
            <section className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-4 flex justify-between items-center shadow-inner">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white/90">我的战绩</h3>
                  <p className="text-[10px] text-white/50 mt-1">
                    排名 <span className="text-primary font-bold">{lastWeekRank}</span> 
                    <span className="mx-2">•</span> 
                    答对 {lastWeekCorrect}/{lastWeekTotal}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-sm font-headline font-bold text-white/80">{lastWeekTime}</p>
                <p className="text-[9px] text-white/40 uppercase tracking-widest mt-0.5">用时</p>
              </div>
            </section>
          )}
        </div>

        {/* Leaderboard Section */}
        <section className="space-y-4 px-1 mt-6">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-tertiary drop-shadow-[0_0_5px_rgba(203,166,247,0.5)]" />
              <h3 className="text-lg font-headline font-bold text-white/90 uppercase tracking-wider">排行榜</h3>
            </div>
            <div className="flex bg-[#0a0f12]/80 p-1 rounded-xl border border-white/5 shadow-inner">
              <button 
                onClick={() => setActiveTab('weekly')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'weekly' ? 'bg-white/10 text-tertiary shadow-sm' : 'text-white/40 hover:text-white/70'
                }`}
              >
                周榜
              </button>
              <button 
                onClick={() => setActiveTab('all')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'all' ? 'bg-white/10 text-tertiary shadow-sm' : 'text-white/40 hover:text-white/70'
                }`}
              >
                总榜
              </button>
            </div>
          </div>

          <div className="bg-[#0a0f12]/60 rounded-3xl overflow-hidden border border-white/10 shadow-2xl backdrop-blur-sm mx-1">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-xs text-on-surface-variant">加载中...</p>
              </div>
            ) : !hasLeaderboardData ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <Trophy className="w-10 h-10 text-on-surface-variant/30" />
                <p className="text-sm text-on-surface-variant/60 font-medium">暂无排行数据</p>
                <p className="text-xs text-on-surface-variant/40">完成挑战即可上榜</p>
              </div>
            ) : (
              sortedLeaderboard.map((user) => {
                const isCurrentUser = user.deviceId === deviceId;
                const userAvatar = getAvatarUrl(user.avatarStyle || 'fish-small');
                const displayAvatar = isCurrentUser && localAvatar ? localAvatar : userAvatar;
                const displayName = isCurrentUser && localNickname ? localNickname : (user.name || 'Player');

                return (
                  <div key={user.deviceId || user.rank} className="flex items-center px-5 py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors group">
                    <div className="w-8 flex justify-center">
                      {user.rank <= 3 ? (
                        <Award className={`w-6 h-6 ${user.rank === 1 ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]' : user.rank === 2 ? 'text-slate-300 drop-shadow-[0_0_8px_rgba(203,213,225,0.4)]' : 'text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.4)]'}`} />
                      ) : (
                        <span className="text-base font-headline font-bold text-white/30">{user.rank}</span>
                      )}
                    </div>
                    <div className={`w-10 h-10 rounded-full bg-white/5 ml-3 overflow-hidden border-2 flex items-center justify-center shadow-inner ${user.rank <= 3 ? (user.rank === 1 ? 'border-yellow-400/50' : user.rank === 2 ? 'border-slate-300/50' : 'border-orange-400/50') : 'border-white/10'}`}>
                      {displayAvatar ? (
                        <img className="w-full h-full object-cover" src={displayAvatar} alt={displayName} />
                      ) : (
                        <span className="text-sm font-bold text-white/50">
                          {displayName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-bold ${isCurrentUser ? 'text-primary' : 'text-white/90'}`}>{displayName}</p>
                          {isCurrentUser && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-primary/20 text-primary uppercase tracking-wider">我</span>
                          )}
                        </div>
                        {user.deviceId ? (
                          <p className="text-[10px] text-white/40 font-mono opacity-60">
                            ID: {user.deviceId.slice(0, 8)}
                          </p>
                        ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right min-w-[60px]">
                      <p className="text-sm font-headline font-bold text-on-surface-variant">
                        {formatTime(user.time_spent_seconds || user.timeSpent || 0)}
                      </p>
                      <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-tighter">用时</p>
                    </div>
                    <div className="text-right min-w-[40px]">
                      <p className={`text-sm font-headline font-bold ${user.rank === 1 ? 'text-tertiary' : 'text-on-surface'}`}>
                        {user.correct_count || user.correct || 0}
                      </p>
                      <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-tighter">正确</p>
                    </div>
                  </div>
                </div>
              );
            })
            )}
          </div>
        </section>

        <div className="pt-12 pb-4 flex flex-col items-center gap-2 opacity-30">
          <p className="text-[9px] text-on-surface-variant uppercase tracking-widest">© 2026 PokerIQ Studio</p>
        </div>
      </main>

      {/* Fixed User Ranking Sticky - 仅在有排名数据时显示 */}
      {(myRank || sortedLeaderboard.some(u => u.deviceId === deviceId)) && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[calc(28rem-2rem)] z-40">
          <div className="bg-[#0a0f12]/95 backdrop-blur-3xl border border-primary/30 rounded-[2rem] px-5 py-4 flex items-center shadow-[0_4px_30px_rgba(70,241,197,0.2)] mx-1">
            <div className="w-8 flex justify-center">
              <span className="text-sm font-headline font-black text-primary drop-shadow-[0_0_8px_rgba(70,241,197,0.5)]">{myRankNum}</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-secondary ml-3 p-[2px] shadow-[0_0_15px_rgba(70,241,197,0.3)]">
              <div className="w-full h-full rounded-full overflow-hidden bg-[#0a0f12] flex items-center justify-center">
                {localAvatar ? (
                  <img className="w-full h-full object-cover" src={localAvatar} alt="我" />
                ) : (
                  <User className="w-5 h-5 text-white/40" />
                )}
              </div>
            </div>
            <div className="ml-4 flex-1">
              <p className="text-sm font-black text-white">{localNickname || '我'}</p>
              <p className="text-[10px] text-primary/80 font-bold uppercase tracking-wide">
                {beatPercentage > 0 ? `击败了 ${beatPercentage}% 玩家` : '继续努力！'}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right min-w-[60px]">
                <p className="text-sm font-headline font-black text-white/90">
                  {formatTime(myTime)}
                </p>
                <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mt-0.5">用时</p>
              </div>
              <div className="text-right min-w-[40px]">
                <p className="text-sm font-headline font-black text-primary drop-shadow-[0_0_5px_rgba(70,241,197,0.5)]">{myCorrect}</p>
                <p className="text-[10px] text-primary/60 uppercase font-black tracking-widest mt-0.5">正确</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
