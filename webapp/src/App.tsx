/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, createContext, useContext } from 'react';
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
  const [learningChapter, setLearningChapter] = useState<{ id: string; completed: number; correct: number; total: number } | null>(null);
  const [chapterResultData, setChapterResultData] = useState<{ chapterId: string; chapterName: string; correct: number; total: number; isPassed: boolean } | null>(null);

  // 初始化：匿名登录
  useEffect(() => {
    async function init() {
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
        setIsLoading(false);
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

      const result = await api.generateQuestion(type, mode);
      // 将 mode 存入题目，方便下一题时使用
      if (result.question) {
        (result.question as any)._mode = mode;
        if (mode === 'learning' && currentChapter) {
          result.question.progress = `${currentChapter.completed + 1} / ${currentChapter.total}`;
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
    
    setScreen('feedback');
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
        return <ChallengeQuiz deviceId={deviceId} onBack={() => setScreen('challenge')} />;
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
              <p>我们高度重视您的隐私。我们仅收集必要的学习数据以优化您的练习体验。您的个人信息绝不会在未经许可的情况下分享给第三方。</p>
              <p>我们收集的数据包括：</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>练习正确率与速度</li>
                <li>学习进度与成就</li>
                <li>设备基本信息（用于适配）</li>
              </ul>
              <p>我们承诺将采取一切合理措施保护您的数据安全，防止数据泄露、滥用或更改。</p>
            </div>
          </SecondaryPage>
        );
      case 'agreement':
        return (
          <SecondaryPage title="用户协议" onBack={() => setScreen('profile')}>
            <div className="space-y-4 text-on-surface-variant text-sm leading-relaxed">
              <p>欢迎使用 PokerIQ。通过使用本应用，您同意遵守我们的服务条款。本应用仅供学习交流使用，不涉及任何形式的真实货币赌博。</p>
              <h3 className="text-on-surface font-bold mt-4">1. 服务说明</h3>
              <p>PokerIQ 为用户提供德州扑克概率计算、策略练习等学习工具。</p>
              <h3 className="text-on-surface font-bold mt-4">2. 用户行为</h3>
              <p>用户应合法使用本应用，不得利用本应用从事任何违法活动。严禁利用本应用进行任何形式的真实货币赌博。</p>
              <h3 className="text-on-surface font-bold mt-4">3. 免责声明</h3>
              <p>本应用提供的数据仅供参考，不保证绝对的准确性。用户在实际游戏中的决策由其个人承担责任。</p>
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
      <div className="min-h-screen bg-surface-dim flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-primary text-2xl font-bold font-headline mb-4">POKERIQ</h1>
          <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
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
