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
          <SecondaryPage title="Privacy Policy" onBack={() => setScreen('profile')}>
            <div className="space-y-4 text-on-surface-variant text-sm leading-relaxed">
              <p className="text-white/40 text-xs">Last updated: April 2, 2026</p>
              <p>This Privacy Policy (the "Policy") applies to the collection, use and disclosure of personal data arising from the usage of the mobile application <strong>PokerIQ</strong> ("the App").</p>

              <h3 className="text-on-surface font-bold mt-4">1. General</h3>
              <p><strong>1.1</strong> This Policy provides information on the obligations and policies of PokerIQ in respect of personal data. PokerIQ undertakes to use reasonable efforts in applying, where practicable, the principles and processes set out herein to its operations.</p>
              <p><strong>1.2</strong> By interacting with the App, you agree and consent to PokerIQ (collectively referred to as "we", "us" or "our") collecting, using, disclosing and sharing your Data in the manner set forth in this Policy.</p>

              <h3 className="text-on-surface font-bold mt-4">2. Data Minimization</h3>
              <p>PokerIQ strictly adheres to Apple's guidelines on Data Minimization. We consciously design our application to only collect information absolutely necessary for the functioning of the App.</p>
              <p><strong>2.1 Types of Data Collected:</strong></p>
              <p>• <strong>Anonymous Device Identifier (UUID):</strong> A randomly generated identifier used solely to associate your learning progress. This identifier cannot be used to determine your real identity.</p>
              <p>• <strong>Learning Data:</strong> Quiz answers (accuracy, time spent), chapter progress, challenge scores and mistake records — stored on our cloud server to enable cross-session continuity.</p>
              <p>• <strong>User Preferences:</strong> Nickname, avatar style selection, and language preference.</p>
              <p><strong>2.2 Data we DO NOT collect:</strong> PokerIQ explicitly does NOT collect your name, email, phone number, geolocation, contacts, photos, financial information, or any other personally identifiable information.</p>

              <h3 className="text-on-surface font-bold mt-4">3. Purpose of Collection</h3>
              <p>The operational data mentioned above is collected exclusively for: providing and improving the learning experience; recording and displaying your study progress; generating leaderboard rankings.</p>

              <h3 className="text-on-surface font-bold mt-4">4. Disclosure and Third-Party Services</h3>
              <p>PokerIQ does not sell, trade, or otherwise transfer your data to unauthorized third parties. We rely on the following essential service providers:</p>
              <p>• <strong>Supabase:</strong> An open-source backend platform used to securely store anonymous learning data with industry-standard encryption and row-level security policies.</p>

              <h3 className="text-on-surface font-bold mt-4">5. Account Deletion</h3>
              <p>You may permanently delete all data associated with your device at any time via the in-app "Delete Account & Data" function located in the Profile section. Upon deletion, all records including quiz answers, progress, leaderboard entries and preferences are irrecoverably removed from our servers.</p>

              <h3 className="text-on-surface font-bold mt-4">6. Children's Privacy</h3>
              <p>This App is rated 17+ and is not directed at children under 17. We do not knowingly collect personal information from minors. If we become aware that we have inadvertently received data from a child, we will delete such information from our records.</p>

              <h3 className="text-on-surface font-bold mt-4">7. Educational Purpose Disclaimer</h3>
              <p>PokerIQ is strictly an educational tool for learning poker mathematics and probability. It does not facilitate, encourage, or provide any form of real-money gambling, betting, or online gaming services.</p>

              <h3 className="text-on-surface font-bold mt-4">8. Changes to This Policy</h3>
              <p>PokerIQ reserves the right to alter any clauses contained herein to remain compliant with App Store Guidelines and applicable legislation. Continued use of the App after revisions constitutes acceptance of the updated Policy.</p>

              <h3 className="text-on-surface font-bold mt-4">9. Contact Us</h3>
              <p>If you have any questions regarding your privacy, please contact: <strong>support@pokeriq.com</strong></p>
            </div>
          </SecondaryPage>
        );
      case 'agreement':
        return (
          <SecondaryPage title="Terms and Conditions" onBack={() => setScreen('profile')}>
            <div className="space-y-4 text-on-surface-variant text-sm leading-relaxed">
              <p className="text-white/40 text-xs">Last updated: April 2, 2026</p>
              <p>Please read these Terms and Conditions carefully before using <strong>PokerIQ</strong> (the "App" or "Service"). By accessing or using our Service, you agree to be bound by these Terms and Conditions.</p>

              <h3 className="text-on-surface font-bold mt-4">1. Access and Registration</h3>
              <p>PokerIQ provides access to poker mathematics training materials, including quiz-based learning paths, a probability calculator, and weekly challenge modes. Access is granted to the user operating the device associated with the anonymous identifier. No account registration is required to use the App.</p>

              <h3 className="text-on-surface font-bold mt-4">2. Educational Purpose</h3>
              <p>PokerIQ is strictly an educational and training tool designed to help users improve their understanding of poker probability and strategy through practice questions and mathematical exercises. The App does NOT facilitate, encourage, or provide any form of real-money gambling, betting, wagering, or online gaming services. All scenarios presented are simulated for educational purposes only.</p>

              <h3 className="text-on-surface font-bold mt-4">3. Content Accuracy</h3>
              <p>While we use reasonable efforts to include accurate probability calculations and strategic information, we make no warranties or representations as to the absolute accuracy of the Content. The App is an educational aide and we assume no liability for any decisions made based on information provided by the App.</p>

              <h3 className="text-on-surface font-bold mt-4">4. Intellectual Property Rights</h3>
              <p>All information, content, services, questions, training frameworks, algorithms, and software displayed on or used in connection with PokerIQ is owned by its respective developers and is protected by applicable intellectual property laws and international treaty provisions.</p>

              <h3 className="text-on-surface font-bold mt-4">5. Prohibition on Redistribution</h3>
              <p>You may NOT copy, distribute, modify, reverse-engineer, decompile, or create derivative works from any part of the App, including its question banks, algorithms, or user interface designs, without express written permission.</p>

              <h3 className="text-on-surface font-bold mt-4">6. User Conduct</h3>
              <p>You agree not to: use the Service for any unlawful purpose; attempt to gain unauthorized access to any part of the Service; use automated tools to manipulate leaderboard rankings; impersonate any person or entity.</p>

              <h3 className="text-on-surface font-bold mt-4">7. Warranty Disclaimer</h3>
              <p>The Service is provided on an "AS-IS" and "AS-AVAILABLE" basis. No warranty is expressed or implied. The user agrees that PokerIQ, its staff, content providers, and affiliates shall have neither liability nor responsibility to any person or entity with respect to any loss or damages arising from the App.</p>

              <h3 className="text-on-surface font-bold mt-4">8. Limitation of Liability</h3>
              <p>To the maximum extent permitted by applicable law, PokerIQ and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.</p>

              <h3 className="text-on-surface font-bold mt-4">9. Indemnification</h3>
              <p>You agree to indemnify, defend, and hold harmless PokerIQ and its affiliates from and against any and all claims, damages, obligations, losses, liabilities, costs, or debt arising from your use of the Service or your violation of these Terms.</p>

              <h3 className="text-on-surface font-bold mt-4">10. Account Deletion</h3>
              <p>You may delete all data associated with your usage at any time via the in-app "Delete Account & Data" function. Deletion is permanent and irreversible.</p>

              <h3 className="text-on-surface font-bold mt-4">11. Service Modifications</h3>
              <p>PokerIQ may modify, suspend, discontinue or restrict the use of any portion of the App at any time, without notice or liability.</p>

              <h3 className="text-on-surface font-bold mt-4">12. Changes to These Terms</h3>
              <p>We reserve the right to modify these Terms at any time. By continuing to access or use the Service after revisions become effective, you agree to be bound by the revised terms.</p>

              <h3 className="text-on-surface font-bold mt-4">13. Contact Us</h3>
              <p>If you have any questions about these Terms, please contact: <strong>support@pokeriq.com</strong></p>
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
