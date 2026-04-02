/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Screen, QuizQuestion } from './types';
import { BottomNav } from './components/BottomNav';
import { Calculator } from './components/Calculator';
import { Training } from './components/Training';
import { Challenge } from './components/Challenge';
import { ChallengeQuiz } from './components/ChallengeQuiz';
import { Profile } from './components/Profile';
import { Quiz } from './components/Quiz';
import { Feedback } from './components/Feedback';
import { ChapterResult } from './components/ChapterResult';
import { SecondaryPage } from './components/SecondaryPage';
import { motion, AnimatePresence } from 'motion/react';
import * as api from './lib/api';

// ============ Auth Context ============
interface AuthContextType {
  deviceId: string;
  profile: any;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  deviceId: '',
  profile: null,
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const DEVICE_ID_KEY = 'pokeriq_device_id';

export default function App() {
  const [screen, setScreen] = useState<Screen>('calculator');
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [learningChapter, setLearningChapter] = useState<{ id: string; name: string; completed: number; correct: number; total: number } | null>(null);
  const [chapterResultData, setChapterResultData] = useState<{ chapterId: string; chapterName: string; correct: number; total: number; isPassed: boolean } | null>(null);
  const [mistakeSession, setMistakeSession] = useState<{ current: number; total: number } | null>(null);
  const appPausedAt = useRef<number | null>(null);

  // Capacitor: listen for app state changes (fix timer drift on iOS)
  useEffect(() => {
    const listener = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        appPausedAt.current = Date.now();
      } else {
        appPausedAt.current = null;
      }
    });
    return () => { listener.then(l => l.remove()); };
  }, []);

  // 初始化：匿名登录
  useEffect(() => {
    async function init() {
      const startTime = Date.now();
      try {
        const storedId = localStorage.getItem(DEVICE_ID_KEY);
        const result = await api.guestLogin(storedId || undefined);
        localStorage.setItem(DEVICE_ID_KEY, result.deviceId);
        setDeviceId(result.deviceId);
        setProfile(result.profile);
      } catch (err) {
        // API不可用时使用本地模式
        console.warn('API unavailable, using local mode:', err);
        const localId = localStorage.getItem(DEVICE_ID_KEY) || `local_${Date.now()}`;
        localStorage.setItem(DEVICE_ID_KEY, localId);
        setDeviceId(localId);
      } finally {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 3000 - elapsed);
        setTimeout(() => {
          setIsLoading(false);
        }, remaining);
      }
    }
    init();
  }, []);

  const refreshProfile = async () => {
    if (!deviceId) return;
    try {
      const p = await api.getProfile(deviceId);
      setProfile(p);
    } catch (err) {
      console.warn('Failed to refresh profile:', err);
    }
  };

  const handleStartQuiz = async (type?: string, mode?: 'learning' | 'practice', chapter?: any) => {
    try {
      let currentChapter = learningChapter;
      if (mode === 'learning' && chapter) {
        currentChapter = {
          id: chapter.chapter_id,
          name: chapter.chapter_name,
          completed: chapter.completed_questions || 0,
          correct: chapter.correct_questions || 0,
          total: chapter.total_questions || 10
        };

        if (chapter.status === 'completed' || currentChapter.completed >= currentChapter.total) {
          setChapterResultData({
            chapterId: currentChapter.id,
            chapterName: currentChapter.name,
            correct: currentChapter.correct,
            total: currentChapter.total,
            isPassed: currentChapter.correct >= 8
          });
          setScreen('chapter-result');
          return;
        }

        setLearningChapter(currentChapter);
      }

      let progressStr = '';
      if (type === 'mistake') {
        if (chapter && chapter.isMistake) {
          if (chapter.total === 0) {
            alert('没有错题啦！');
            setScreen('training');
            return;
          }
          setMistakeSession({ current: 1, total: chapter.total });
          progressStr = `1 / ${chapter.total}`;
        } else if (mistakeSession) {
          const next = mistakeSession.current + 1;
          if (next > mistakeSession.total) {
             alert('本轮错题复习完成！');
             handleReturnToTraining();
             return;
          }
          setMistakeSession({ total: mistakeSession.total, current: next });
          progressStr = `${next} / ${mistakeSession.total}`;
        }
      } else {
        setMistakeSession(null);
      }

      const result = await api.generateQuestion(type, mode, deviceId);
      // 将 mode 存入题目，方便下一题时使用
      if (result.question) {
        (result.question as any)._mode = mode;
        if (mode === 'learning' && currentChapter) {
          result.question.progress = `${currentChapter.completed + 1} / ${currentChapter.total}`;
        } else if (type === 'mistake' && progressStr) {
          result.question.progress = progressStr;
        }
      }
      setCurrentQuestion(result.question);
      setScreen('quiz');
    } catch (err) {
      console.warn('Failed to generate question, using fallback:', err);
      // Fallback demo question
      setCurrentQuestion({
        id: 'demo',
        type: 'outs',
        difficulty: 'easy',
        chapter: '补牌计算',
        progress: '',
        situation: '6人桌翻牌圈，你在 CO 位置持有 J♥ 10♥，底池目前 7BB。翻牌发出 9♠ 8♣ 2♦，对手在大盲位领先下注 3BB。',
        question: '你有多少张补牌？',
        hand: [
          { rank: 'J', suit: 'hearts' },
          { rank: '10', suit: 'hearts' }
        ],
        board: [
          { rank: '9', suit: 'spades' },
          { rank: '8', suit: 'clubs' },
          { rank: '2', suit: 'diamonds' }
        ],
        options: [
          { id: 'a', label: 'A', value: '8 张' },
          { id: 'b', label: 'B', value: '4 张' },
          { id: 'c', label: 'C', value: '12 张' }
        ],
        correctOptionId: 'a',
        explanation: '当你在翻牌圈有两头顺听牌时，你有 8 张补牌可以完成顺子。'
      });
      setScreen('quiz');
    }
  };

  const handleReturnToTraining = async () => {
    setLearningChapter(null);
    setChapterResultData(null);
    setMistakeSession(null);
    await refreshProfile();
    setScreen('training');
  };

  const handleAutoStartChapter = async (id: string) => {
    try {
      const chapters = await api.getChapters(deviceId);
      const ch = chapters.find((c: any) => c.chapter_id === id);
      if (!ch) {
        handleReturnToTraining();
        return;
      }
      
      const getChapterType = (cid: string) => {
        const map: Record<string, string> = { ch1: 'outs', ch2: 'odds', ch3: 'preflop', ch4: 'equity', ch5: 'position', ch6: 'style', ch7: 'ev', ch8: 'bluff', ch9: 'mixed' };
        return map[cid] || 'outs';
      };
      
      setChapterResultData(null);
      handleStartQuiz(getChapterType(ch.chapter_id), 'learning', ch);
    } catch (err) {
      handleReturnToTraining();
    }
  };

  // 提交答案
  const handleAnswer = async (optionId: string) => {
    setSelectedOptionId(optionId);
    
    // 先跳转到Feedback页避免按钮无响应的延迟感
    setScreen('feedback');
    
    if (currentQuestion && deviceId) {
      const isCorrect = optionId === currentQuestion.correctOptionId;
      try {
        await api.verifyAnswer({
          deviceId,
          questionType: (currentQuestion as any).type || 'outs',
          isCorrect,
          questionData: currentQuestion,
        });

        if ((currentQuestion as any)._mode === 'learning' && learningChapter) {
          const res = await api.updateChapterProgress(deviceId, learningChapter.id, isCorrect);
          if (res.status === 'completed' || res.status === 'failed' || res.status === 'progress') {
             setLearningChapter({
               ...learningChapter,
               completed: res.completed || (learningChapter.completed + 1),
               correct: res.correct || (learningChapter.correct + (isCorrect ? 1 : 0))
             });
          }
        }
      } catch (err) {
        console.warn('Failed to verify answer:', err);
      }
    }
  };

  const handleNextQuestion = async () => {
    const type = (currentQuestion as any)?.type;
    const mode = (currentQuestion as any)?._mode;

    if (mode === 'learning' && learningChapter) {
      if (learningChapter.completed >= learningChapter.total) {
        setChapterResultData({
          chapterId: learningChapter.id,
          chapterName: (learningChapter as any).name || '关卡完成',
          correct: learningChapter.correct,
          total: learningChapter.total,
          isPassed: learningChapter.correct >= 8
        });
        setLearningChapter(null);
        setScreen('chapter-result');
        return;
      }
    }
    
    if (mistakeSession) {
      if (mistakeSession.current >= mistakeSession.total) {
        alert('干得漂亮！本轮错题复习完成！');
        handleReturnToTraining();
        return;
      }
      handleStartQuiz('mistake', 'practice');
      return;
    }
    
    handleStartQuiz(type, mode);
  };

  const renderScreen = () => {
    switch (screen) {
      case 'calculator':
        return <Calculator onBack={() => setScreen('training')} />;
      case 'training':
        return (
          <Training onStartQuiz={handleStartQuiz} deviceId={deviceId} />
        );
      case 'challenge':
        return <Challenge onStartChallenge={() => setScreen('challenge-quiz')} />;
      case 'challenge-quiz':
        return <ChallengeQuiz deviceId={deviceId} onBack={() => {
          if (window.confirm('确认退出？当前挑战进度不予保存。')) {
            setScreen('challenge');
          }
        }} />;
      case 'profile':
        return (
          <Profile onNavigate={(target) => setScreen(target)} deviceId={deviceId} />
        );
      case 'faq':
        return (
          <SecondaryPage title="常见问题" onBack={() => setScreen('profile')}>
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-primary font-bold">1. 如何计算补牌？</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">在翻牌圈或转牌圈，计算能让你成牌的张数即为补牌。例如：两头顺子听牌有 8 张补牌。</p>
              </div>
              <div className="space-y-2">
                <h3 className="text-primary font-bold">2. 什么是赔率？</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">赔率是底池大小与你需要跟注金额的比率。如果底池 100，你需要跟注 20，赔率就是 5:1。</p>
              </div>
              <div className="space-y-2">
                <h3 className="text-primary font-bold">3. 挑战模式如何计分？</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">根据正确率和答题速度综合评分。连续答对会有额外加分，速度越快分值越高。</p>
              </div>
            </div>
          </SecondaryPage>
        );
      case 'privacy':
        return (
          <SecondaryPage title="隐私政策" onBack={() => setScreen('profile')}>
            <div className="space-y-4 text-on-surface-variant text-sm leading-relaxed">
              <p className="text-white/40 text-xs">最后更新：2026 年 4 月 2 日</p>

              <h3 className="text-on-surface font-bold mt-4">1. 概述</h3>
              <p>PokerIQ（以下简称「我们」）致力于保护您的隐私。本隐私政策说明了我们在您使用 PokerIQ 应用程序时如何收集、使用、存储和保护您的信息。本应用为一款德州扑克概率学习与训练工具，不涉及任何形式的真实货币交易或在线博彩。</p>

              <h3 className="text-on-surface font-bold mt-4">2. 我们收集的信息</h3>
              <p><strong>2.1 设备标识符</strong>：我们为每台设备生成唯一的匿名标识符（UUID），用于标识您的学习进度。此标识符不与您的真实身份关联。</p>
              <p><strong>2.2 学习数据</strong>：包括答题记录（正确率、用时）、章节进度、挑战成绩和错题记录。</p>
              <p><strong>2.3 用户偏好</strong>：昵称、头像风格选择、语言偏好。</p>
              <p><strong>2.4 我们不收集的信息</strong>：我们不收集您的姓名、电子邮件、电话号码、地理位置、通讯录、照片或其他个人身份信息。</p>

              <h3 className="text-on-surface font-bold mt-4">3. 信息的使用</h3>
              <p>我们收集的数据仅用于：提供并改善学习体验；记录和展示学习进度；生成排行榜排名。</p>

              <h3 className="text-on-surface font-bold mt-4">4. 数据存储与安全</h3>
              <p>您的数据存储在经过行业标准加密的云端数据库（Supabase）中。我们采取合理的技术和管理措施防止未经授权的访问、修改或删除。</p>

              <h3 className="text-on-surface font-bold mt-4">5. 第三方共享</h3>
              <p>我们不会向任何第三方出售、出租或共享您的个人数据。排行榜中仅展示用户自行设置的昵称和成绩信息。</p>

              <h3 className="text-on-surface font-bold mt-4">6. 您的权利</h3>
              <p>您有权随时通过应用内「我的 → 删除账号与数据」功能永久删除您存储在我们服务器上的所有数据。删除后数据不可恢复。</p>

              <h3 className="text-on-surface font-bold mt-4">7. 儿童隐私</h3>
              <p>本应用不面向 17 岁以下的儿童。我们不会故意收集未成年人的信息。</p>

              <h3 className="text-on-surface font-bold mt-4">8. 联系我们</h3>
              <p>如果您对本隐私政策有任何疑问，请联系我们：support@pokeriq.com</p>
            </div>
          </SecondaryPage>
        );
      case 'agreement':
        return (
          <SecondaryPage title="用户协议" onBack={() => setScreen('profile')}>
            <div className="space-y-4 text-on-surface-variant text-sm leading-relaxed">
              <p className="text-white/40 text-xs">最后更新：2026 年 4 月 2 日</p>

              <h3 className="text-on-surface font-bold mt-4">1. 接受条款</h3>
              <p>通过下载、安装或使用 PokerIQ 应用程序，您同意受本用户协议的约束。如果您不同意这些条款，请勿使用本应用。</p>

              <h3 className="text-on-surface font-bold mt-4">2. 服务说明</h3>
              <p>PokerIQ 是一款德州扑克数学训练与学习工具，旨在通过选择题练习和概率计算帮助用户提升策略分析能力。本应用的所有内容均为教育与学习目的，不构成任何形式的投资建议、博彩服务或真实货币交易平台。</p>

              <h3 className="text-on-surface font-bold mt-4">3. 教育目的声明</h3>
              <p>本应用提供的所有概率计算、策略建议和模拟场景仅供学习和参考。用户在实际牌局中的决策完全由其个人负责。我们不鼓励、不支持、也不提供任何形式的真实货币赌博或在线博彩服务。</p>

              <h3 className="text-on-surface font-bold mt-4">4. 用户行为规范</h3>
              <p>您同意不会：将本应用用于任何违法目的；利用本应用从事真实货币赌博；尝试干扰或破坏本应用的正常运行；使用自动化工具操纵排行榜排名。</p>

              <h3 className="text-on-surface font-bold mt-4">5. 知识产权</h3>
              <p>本应用的所有内容，包括但不限于算法、界面设计、题目内容和品牌标识，均受知识产权法保护。未经我们明确书面授权，您不得复制、修改、分发或反向工程本应用。</p>

              <h3 className="text-on-surface font-bold mt-4">6. 免责声明</h3>
              <p>本应用按「现状」提供，不作任何明示或暗示的担保。我们不保证应用不会发生中断或错误，也不保证计算结果的绝对准确性。在法律允许的最大范围内，我们不对因使用本应用而产生的任何直接或间接损失承担责任。</p>

              <h3 className="text-on-surface font-bold mt-4">7. 账号与数据</h3>
              <p>您可以随时通过应用内的「删除账号与数据」功能删除您的所有数据。删除操作不可撤销。</p>

              <h3 className="text-on-surface font-bold mt-4">8. 条款修改</h3>
              <p>我们保留随时修改本协议的权利。重大变更将通过应用内通知告知用户。继续使用本应用即视为接受修改后的条款。</p>

              <h3 className="text-on-surface font-bold mt-4">9. 联系方式</h3>
              <p>如有任何与本协议相关的问题，请联系 support@pokeriq.com。</p>
            </div>
          </SecondaryPage>
        );
      case 'quiz':
        return currentQuestion ? (
          <Quiz 
            question={currentQuestion} 
            onAnswer={handleAnswer} 
            onBack={handleReturnToTraining}
          />
        ) : <Training onStartQuiz={handleStartQuiz} deviceId={deviceId || ''} />;
      case 'feedback':
        return currentQuestion ? (
          <Feedback 
            question={currentQuestion} 
            selectedOptionId={selectedOptionId || ''} 
            onNext={handleNextQuestion}
            onExit={handleReturnToTraining}
          />
        ) : <Training onStartQuiz={handleStartQuiz} deviceId={deviceId || ''} />;
      case 'chapter-result':
        return chapterResultData ? (
          <ChapterResult 
            data={chapterResultData}
            onNextLevel={() => {
              const match = chapterResultData.chapterId.match(/ch(\d+)/);
              if (match) {
                const nextId = `ch${parseInt(match[1]) + 1}`;
                handleAutoStartChapter(nextId);
              } else {
                handleReturnToTraining();
              }
            }}
            onRetry={() => handleAutoStartChapter(chapterResultData.chapterId)}
            onBack={handleReturnToTraining}
          />
        ) : <Training onStartQuiz={handleStartQuiz} deviceId={deviceId || ''} />;
      default:
        return <Training onStartQuiz={handleStartQuiz} deviceId={deviceId} />;
    }
  };

  const showBottomNav = ['training', 'calculator', 'challenge', 'profile'].includes(screen);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-dim flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/10 rounded-full blur-[80px]" />
        
        <div className="text-center relative z-10 flex flex-col items-center">
          <div className="relative mb-6">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-20 h-20 drop-shadow-[0_0_15px_rgba(70,241,197,0.5)]">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="url(#paint0_linear)" strokeWidth="1.5"/>
              <path d="M12 7V17M7 12H17" stroke="url(#paint1_linear)" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="12" cy="12" r="3" fill="currentColor" className="text-primary"/>
              <defs>
                <linearGradient id="paint0_linear" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#46F1C5" />
                  <stop offset="1" stopColor="#46F1C5" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="paint1_linear" x1="7" y1="7" x2="17" y2="17" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#46F1C5" />
                  <stop offset="1" stopColor="#46F1C5" stopOpacity="0.2" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 border-r-2 border-t-2 border-primary rounded-full animate-[spin_3s_linear_infinite]" />
          </div>
          
          <h1 className="text-white text-4xl font-black font-headline tracking-widest mb-3">
            POKER<span className="text-primary">IQ</span>
          </h1>
          <p className="text-white/60 text-sm tracking-[0.2em] font-medium uppercase mb-8">
            Master the Odds, Own the Table
          </p>
          
          <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ deviceId, profile, refreshProfile }}>
      <div className="min-h-screen bg-surface-dim text-on-surface overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className={`max-w-md mx-auto px-4 ${showBottomNav ? 'pb-24' : 'pb-8'}`}
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>

        {showBottomNav && (
          <BottomNav 
            activeScreen={screen} 
            onScreenChange={setScreen} 
          />
        )}
      </div>
    </AuthContext.Provider>
  );
}
