import React, { useState, useEffect } from 'react';
import { BarChart2, Globe, LayoutGrid, Check, X, TrendingUp, Mail, HelpCircle, Shield, FileText, Info, Edit2, Copy, ChevronRight, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, LabelList } from 'recharts';
import { Screen } from '../types';
import * as api from '../lib/api';
import { useAuth } from '../App';

interface ProfileProps {
  onNavigate: (screen: Screen) => void;
  deviceId?: string;
}

const PLAYER_STYLES = [
  { id: 'shark', name: '鲨鱼 (Shark)', desc: '紧凶型，职业玩家', seed: 'shark-poker-avatar' },
  { id: 'fish-big', name: '大鱼 (Big Fish)', desc: '松被动，喜欢看翻牌', seed: 'goldfish-poker' },
  { id: 'fish-small', name: '小鱼 (Small Fish)', desc: '新手玩家，容易被读', seed: 'bluefish-poker' },
  { id: 'whale', name: '鲸鱼 (Whale)', desc: '高额玩家，松凶豪爽', seed: 'whale-poker-avatar' },
  { id: 'rock', name: '岩石 (Rock)', desc: '极紧型，只打强牌', seed: 'stone-poker' },
  { id: 'donkey', name: '驴子 (Donkey)', desc: '乱打一气，不按套路', seed: 'donkey-poker-avatar' },
  { id: 'gambler', name: '赌徒 (Gambler)', desc: '追求刺激，热爱博弈', seed: 'gambler-poker-avatar' },
  { id: 'wizard', name: '数学大师 (Wizard)', desc: '数据驱动，赔率至上', seed: 'math-poker-avatar' },
  { id: 'pokerface', name: '扑克脸 (Poker Face)', desc: '面无表情，难以捉摸', seed: 'pokerface-poker-avatar' },
  { id: 'bluffer', name: '诈唬专家 (Bluffer)', desc: '虚虚实实，心理博弈', seed: 'bluff-poker-avatar' },
];

export const Profile: React.FC<ProfileProps> = ({ onNavigate, deviceId }) => {
  const { refreshProfile } = useAuth();
  const defaultNick = deviceId ? `User_${deviceId.replace(/-/g, '').slice(-4)}` : 'User';
  const [nickname, setNickname] = useState(defaultNick);
  const [statsData, setStatsData] = useState<any[]>([]);
  const [apiTrendData, setApiTrendData] = useState<any[] | null>(null);

  // 从API加载数据
  useEffect(() => {
    if (!deviceId) return;
    
    // 加载资料
    api.getProfile(deviceId).then(p => {
      if (p?.nickname) setNickname(p.nickname);
      if (p?.avatar_style) {
        const style = PLAYER_STYLES.find(s => s.id === p.avatar_style);
        if (style) {
          setSelectedStyle(style);
          setAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${style.seed}`);
        }
      }
      if (p?.language) setCurrentLanguage(p.language);
    }).catch(() => {});

    // 加载统计数据
    api.getStats(deviceId).then(setStatsData).catch(() => {});
    
    // 加载趋势数据
    api.getProfileTrend(deviceId).then(data => {
      if (data && data.length > 0) setApiTrendData(data);
    }).catch(() => {});
  }, [deviceId]);
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [tempNickname, setTempNickname] = useState(nickname);
  const fishSmallStyle = PLAYER_STYLES[2]; // 小鱼 (Small Fish)
  const [selectedStyle, setSelectedStyle] = useState(fishSmallStyle);
  const [avatar, setAvatar] = useState(`https://api.dicebear.com/7.x/avataaars/svg?seed=${fishSmallStyle.seed}`);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('简体中文');

  const handleSaveNickname = async () => {
    if (tempNickname.trim()) {
      setNickname(tempNickname);
      if (deviceId) {
        try { await api.updateProfile({ deviceId, nickname: tempNickname }); } catch {}
      }
    }
    setIsEditingNickname(false);
  };

  // 趋势数据：优先用 API 数据，无数据时为空
  const trendData = apiTrendData || [];

  const settingsItems = [
    { id: 'lang', label: '语言', sub: `当前：${currentLanguage}`, icon: Globe, color: 'text-secondary', bg: 'bg-secondary/10' },
    { id: 'faq', label: '常见问题', sub: '解决您的疑惑', icon: HelpCircle, color: 'text-primary', bg: 'bg-primary/10' },
    { id: 'contact', label: '联系我们', sub: '反馈建议与商务合作', icon: Mail, color: 'text-tertiary', bg: 'bg-tertiary/10' },
    { id: 'privacy', label: '隐私政策', sub: '保护您的数据安全', icon: Shield, color: 'text-secondary', bg: 'bg-secondary/10' },
    { id: 'agreement', label: '用户协议', sub: '使用条款与声明', icon: FileText, color: 'text-on-surface-variant', bg: 'bg-on-surface-variant/10' },
  ];

  const handleSettingClick = (id: string) => {
    if (id === 'lang') setIsLanguageModalOpen(true);
    if (id === 'faq') onNavigate('faq');
    if (id === 'contact') setIsContactModalOpen(true);
    if (id === 'privacy') onNavigate('privacy');
    if (id === 'agreement') onNavigate('agreement');
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0a0f12] text-white">
      <header className="bg-[#0a0f12]/80 backdrop-blur-xl border-b border-white/5 fixed top-0 left-0 w-full z-50">
        <div className="max-w-md mx-auto w-full flex justify-between items-center px-6 pt-[env(safe-area-inset-top)] h-[calc(4rem+env(safe-area-inset-top))]">
          <h1 className="text-xl font-headline font-black uppercase tracking-widest text-white/90">Poker<span className="text-primary">IQ</span></h1>
        </div>
      </header>

      <main className="mt-[calc(4.5rem+env(safe-area-inset-top))] space-y-5 w-full px-4">
        {/* Profile Header */}
        <header className="flex items-center gap-4 relative bg-[#0a0f12]/40 backdrop-blur-xl rounded-[2rem] p-5 border border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <div className="absolute top-1/2 left-5 -translate-y-1/2 w-24 h-24 bg-primary/10 rounded-full blur-[30px] pointer-events-none" />
          <div className="relative group flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary via-tertiary to-secondary p-[2px] shadow-[0_0_20px_rgba(70,241,197,0.3)]">
              <div className="w-full h-full rounded-full overflow-hidden bg-[#0a0f12] border-2 border-transparent relative">
                <img 
                  alt="用户头像" 
                  className="w-full h-full object-cover" 
                  src={avatar} 
                />
              </div>
              <button 
                onClick={() => setIsAvatarModalOpen(true)}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#0a0f12] border border-primary/50 flex items-center justify-center text-primary shadow-[0_0_10px_rgba(70,241,197,0.5)] active:scale-90 transition-all hover:bg-primary hover:text-[#0a0f12]"
              >
                <Camera className="w-[10px] h-[10px]" />
              </button>
            </div>
          </div>
          
          <div className="flex flex-col gap-1 flex-1 relative z-10 min-w-0">
            {isEditingNickname ? (
              <div className="flex items-center gap-2 w-full">
                <input
                  autoFocus
                  type="text"
                  value={tempNickname}
                  onChange={(e) => setTempNickname(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveNickname()}
                  className="flex-1 bg-[#0a0f12]/80 border border-primary/50 shadow-inner rounded-xl px-4 py-2 text-white font-bold text-lg focus:outline-none focus:border-primary focus:shadow-[0_0_15px_rgba(70,241,197,0.3)] backdrop-blur-sm transition-all"
                />
                <button 
                  onClick={handleSaveNickname}
                  className="px-4 py-2 text-sm font-black bg-primary text-[#0a0f12] rounded-xl active:scale-95 transition-all shadow-[0_0_15px_rgba(70,241,197,0.4)]"
                >
                  保存
                </button>
                <button 
                  onClick={() => {
                    setTempNickname(nickname);
                    setIsEditingNickname(false);
                  }}
                  className="px-4 py-2 text-sm font-black bg-white/5 text-white/60 border border-white/10 rounded-xl active:scale-95 hover:bg-white/10 transition-all"
                >
                  取消
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-start min-w-0">
                <div className="flex items-center justify-start gap-2 group cursor-pointer w-full" onClick={() => {
                  setTempNickname(nickname);
                  setIsEditingNickname(true);
                }}>
                  <h2 className="font-headline font-black text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 group-hover:from-primary group-hover:to-primary/70 transition-all drop-shadow-sm truncate">{nickname}</h2>
                  <Edit2 className="w-3.5 h-3.5 flex-shrink-0 text-white/20 group-hover:text-primary transition-all" />
                </div>
                <div className="flex items-center flex-wrap gap-2 mt-1 opacity-80">
                  <span className="text-primary text-[9px] font-black uppercase tracking-widest drop-shadow-[0_0_5px_rgba(70,241,197,0.5)]">
                    {selectedStyle.name}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <p className="text-[9px] text-white/40 font-mono tracking-widest pt-[1px]">ID: {deviceId ? deviceId.slice(0, 8) : '--'}</p>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Avatar Selection Modal */}
        <AnimatePresence>
          {isAvatarModalOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAvatarModalOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed bottom-0 left-0 right-0 bg-[#0a0f12]/95 backdrop-blur-3xl rounded-t-[2.5rem] p-7 z-[70] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pb-[calc(2.5rem+env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto"
              >
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/20 rounded-full" />
                <div className="flex justify-between items-center mb-8 mt-2">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-white font-headline font-black text-2xl tracking-wider">扑克档案风格</h3>
                    <p className="text-xs text-white/40 font-bold uppercase tracking-widest">Select your persona</p>
                  </div>
                  <button 
                    onClick={() => setIsAvatarModalOpen(false)}
                    className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {PLAYER_STYLES.map((style) => {
                    const styleUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${style.seed}`;
                    return (
                      <button
                        key={style.id}
                        onClick={async () => {
                          setAvatar(styleUrl);
                          setSelectedStyle(style);
                          if (deviceId) {
                            try {
                              await api.updateProfile({ deviceId, avatarStyle: style.id });
                              await refreshProfile();
                            } catch (err) {
                              console.warn('Failed to update avatar style:', err);
                            }
                          }
                          setIsAvatarModalOpen(false);
                        }}
                        className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all active:scale-95 text-left group overflow-hidden relative ${
                          selectedStyle.id === style.id 
                            ? 'bg-primary/10 border-primary shadow-[0_0_20px_rgba(70,241,197,0.2)]' 
                            : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10'
                        }`}
                      >
                        {selectedStyle.id === style.id && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent -skew-x-[20deg] -translate-x-full animate-[shine_2s_infinite]" />
                        )}
                        <div className={`w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center relative z-10 ${
                          selectedStyle.id === style.id ? 'bg-[#0a0f12] shadow-inner' : 'bg-white/5 backdrop-blur-md'
                        }`}>
                          <img src={styleUrl} alt={style.name} className="w-[120%] h-[120%] object-cover pt-2" />
                        </div>
                        <div className="flex flex-col min-w-0 relative z-10">
                          <span className={`text-sm font-black truncate tracking-wide ${selectedStyle.id === style.id ? 'text-primary' : 'text-white/90 group-hover:text-white'}`}>
                            {style.name}
                          </span>
                          <span className="text-[9px] font-bold text-white/40 truncate mt-0.5">
                            {style.desc}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-center text-[10px] text-primary/40 font-bold uppercase tracking-widest mt-8">
                  自定义 3D 头像捏脸功能 即将上线
                </p>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Language Selection Modal */}
        <AnimatePresence>
          {isLanguageModalOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsLanguageModalOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed bottom-0 left-0 right-0 bg-[#0a0f12]/95 backdrop-blur-3xl rounded-t-[2.5rem] p-7 z-[70] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pb-[calc(2.5rem+env(safe-area-inset-bottom))]"
              >
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/20 rounded-full" />
                <div className="flex justify-between items-center mb-8 mt-2">
                  <h3 className="text-white font-headline font-black text-2xl tracking-wider">系统语言</h3>
                  <button 
                    onClick={() => setIsLanguageModalOpen(false)}
                    className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3">
                  {['简体中文', '繁体中文', 'English'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        setCurrentLanguage(lang);
                        setIsLanguageModalOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-4.5 rounded-[1.25rem] transition-all border ${
                        currentLanguage === lang 
                          ? 'bg-primary/10 border-primary text-primary shadow-[0_0_20px_rgba(70,241,197,0.15)]' 
                          : 'bg-white/5 border-white/5 hover:bg-white/10 text-white/80'
                      }`}
                    >
                      <span className="font-black tracking-wide">{lang}</span>
                      {currentLanguage === lang && (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-[0_0_10px_rgba(70,241,197,0.5)]">
                          <Check className="w-4 h-4 text-[#0a0f12]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Contact Us Modal */}
        <AnimatePresence>
          {isContactModalOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsContactModalOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed bottom-0 left-0 right-0 bg-[#0a0f12]/95 backdrop-blur-3xl rounded-t-[2.5rem] p-7 z-[70] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pb-[calc(2.5rem+env(safe-area-inset-bottom))]"
              >
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/20 rounded-full" />
                <div className="flex justify-between items-center mb-8 mt-2">
                  <h3 className="text-white font-headline font-black text-2xl tracking-wider">联系我们</h3>
                  <button 
                    onClick={() => setIsContactModalOpen(false)}
                    className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="bg-white/5 border border-white/10 p-5 rounded-[1.25rem] flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-1.5">Game Support</span>
                      <span className="text-white font-mono font-bold text-sm tracking-wide">support@pokeriq.com</span>
                    </div>
                    <button 
                      onClick={() => handleCopyEmail('support@pokeriq.com')}
                      className="p-3 bg-primary/10 text-primary border border-primary/20 rounded-xl active:scale-95 transition-all hover:bg-primary/20"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-5 rounded-[1.25rem] flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-1.5">Business & PR</span>
                      <span className="text-white font-mono font-bold text-sm tracking-wide">biz@pokeriq.com</span>
                    </div>
                    <button 
                      onClick={() => handleCopyEmail('biz@pokeriq.com')}
                      className="p-3 bg-primary/10 text-primary border border-primary/20 rounded-xl active:scale-95 transition-all hover:bg-primary/20"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                {copySuccess && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute top-10 left-1/2 -translate-x-1/2 bg-primary text-[#0a0f12] px-5 py-2 rounded-full text-xs font-black tracking-wider shadow-[0_5px_15px_rgba(70,241,197,0.4)]"
                  >
                    已复制到系统剪贴板 复制成功
                  </motion.div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Learning Data Dashboard */}
        <section className="space-y-5 mt-4">
          <div className="flex items-center gap-3 px-2">
            <div className="p-2 rounded-xl bg-tertiary/10 border border-tertiary/20">
              <BarChart2 className="w-5 h-5 text-tertiary" />
            </div>
            <h3 className="text-xl font-headline font-black text-white uppercase tracking-widest drop-shadow-md">学习全息数据</h3>
          </div>

          {/* Trend Chart */}
          <div className="bg-[#0a0f12]/60 backdrop-blur-xl rounded-[2rem] p-7 border border-white/5 relative overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <h4 className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">近5周正确率趋势</h4>
              </div>
            </div>
            <div className="h-48 w-full relative z-10">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#46F1C5" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#46F1C5" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: 'bold' }}
                      dy={10}
                      interval={0}
                    />
                    <YAxis hide domain={[0, 100]} />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        const label = name === 'accuracy' ? '单周正确率' : '历史均值';
                        return [`${value}%`, label];
                      }}
                      contentStyle={{ 
                        backgroundColor: 'rgba(10, 15, 18, 0.95)', 
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(70,241,197,0.3)',
                        borderRadius: '16px',
                        fontSize: '12px',
                        fontWeight: '900',
                        color: '#fff',
                        boxShadow: '0 8px 25px rgba(0,0,0,0.5)'
                      }}
                      itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                      cursor={{ stroke: 'rgba(70,241,197,0.15)', strokeWidth: 40 }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="average" 
                      stroke="rgba(255,255,255,0.15)" 
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      fill="transparent" 
                      animationDuration={1500}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="accuracy" 
                      stroke="#46F1C5" 
                      strokeWidth={4}
                      fillOpacity={1} 
                      fill="url(#colorAccuracy)" 
                      animationDuration={1500}
                      dot={{ r: 5, fill: '#0a0f12', stroke: '#46F1C5', strokeWidth: 3 }}
                      activeDot={{ r: 8, fill: '#46F1C5', stroke: '#0a0f12', strokeWidth: 3, shadow: '0 0 10px #46F1C5' }}
                    >
                      <LabelList 
                        dataKey="accuracy" 
                        position="top" 
                        offset={15} 
                        formatter={(val: number) => `${val}%`}
                        style={{ fill: '#46F1C5', fontSize: 11, fontWeight: '900', fontFamily: 'var(--font-headline)', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                      />
                    </Area>
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white/20" />
                  </div>
                  <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Awaiting match data</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-[#0a0f12]/40 backdrop-blur-xl rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl">
            <div className="grid grid-cols-4 px-6 py-4 bg-white/[0.02] border-b border-white/5">
              <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">专项分类</span>
              <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] text-center">命中率</span>
              <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] text-center">对局数</span>
              <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] text-right">趋向</span>
            </div>
            <div className="divide-y divide-white/5">
              {(statsData.length > 0 ? statsData : [
                { label: '补牌视界', accuracy: 0, total: 0, trend: 'up', trendValue: '+0%' },
                { label: '胜率估算', accuracy: 0, total: 0, trend: 'up', trendValue: '+0%' },
                { label: '底池赔率', accuracy: 0, total: 0, trend: 'up', trendValue: '+0%' },
                { label: '起手牌序', accuracy: 0, total: 0, trend: 'up', trendValue: '+0%' },
              ]).map((item: any, i: number) => (
                <div key={i} className="grid grid-cols-4 px-6 py-5 items-center hover:bg-white/[0.03] transition-colors group">
                  <span className="text-sm font-black text-white/90 tracking-wide group-hover:text-white transition-colors">{item.label}</span>
                  <span className="text-base font-headline font-black text-primary text-center drop-shadow-[0_0_8px_rgba(70,241,197,0.3)]">{item.accuracy}%</span>
                  <span className="text-sm font-headline font-black text-white/40 text-center">{item.total}</span>
                  <div className="flex justify-end relative">
                    {item.trend === 'up' || item.trend === undefined ? (
                      <div className="flex items-center text-primary text-[11px] font-black tracking-widest bg-primary/10 px-2 py-1 rounded-md border border-primary/20">
                        <svg className="w-3 h-3 mr-0.5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 15l7-7 7 7"/></svg>
                        {item.trendValue || '+0%'}
                      </div>
                    ) : (
                      <div className="flex items-center text-error text-[11px] font-black tracking-widest bg-error/10 px-2 py-1 rounded-md border border-error/20">
                        <svg className="w-3 h-3 mr-0.5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M19 9l-7 7-7-7"/></svg>
                        {item.trendValue || '-0%'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </section>

        {/* Settings List */}
        <section className="space-y-3 pt-4">
          {settingsItems.map((item) => (
            <button 
              key={item.id} 
              onClick={() => handleSettingClick(item.id)}
              className="w-full flex items-center justify-between p-4.5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-white/10 transition-all group active:scale-[0.98] duration-300 backdrop-blur-md"
            >
              <div className="flex items-center gap-5">
                <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center border border-white/5 shadow-inner ${item.color.replace('text-', 'bg-').replace('-variant', '')}/10`}>
                  <item.icon className={`w-6 h-6 ${item.color === 'text-on-surface-variant' ? 'text-white/40' : item.color}`} />
                </div>
                <div className="text-left flex flex-col gap-0.5">
                  <h3 className="font-black text-white/90 tracking-wide text-sm">{item.label}</h3>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{item.sub}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </button>
          ))}
        </section>

        <div className="pt-16 pb-6 flex flex-col items-center gap-2 opacity-40 mix-blend-plus-lighter">
          <div className="flex items-center gap-1.5 text-[9px] font-black text-white/60 uppercase tracking-[0.25em]">
            <Info className="w-3 h-3 opacity-50" />
            Engine Core v2.0.4 (Build 4913X)
          </div>
          <p className="text-[8px] text-white/30 uppercase tracking-[0.3em] font-bold">© 2026 PokerIQ Foundation</p>
        </div>
      </main>
    </div>
  );
};
