/**
 * Frontend-only demo data layer.
 * All user state is stored in localStorage so the app can run without Supabase
 * or a backend API server.
 */

import { generateQuestion as makeQuestion, generateQuestions as makeQuestions } from '../../server/engine/question-generator';
import { calculateOuts, type Card } from '../../server/engine/outs-calculator';
import type { QuizQuestion } from '../types';

const STORAGE_KEY = 'pokeriq_demo_state_v1';

const CHAPTERS = [
  { chapter_id: 'ch1', chapter_name: '认识补牌', type: 'outs' },
  { chapter_id: 'ch2', chapter_name: '赔率计算', type: 'odds' },
  { chapter_id: 'ch3', chapter_name: '起手牌选择', type: 'preflop' },
  { chapter_id: 'ch4', chapter_name: '胜率评估', type: 'equity' },
  { chapter_id: 'ch5', chapter_name: '位置与行动', type: 'position' },
  { chapter_id: 'ch6', chapter_name: '识别对手风格', type: 'style' },
  { chapter_id: 'ch7', chapter_name: 'EV 决策', type: 'ev' },
  { chapter_id: 'ch8', chapter_name: '诈唬识别', type: 'bluff' },
  { chapter_id: 'ch9', chapter_name: '综合实战', type: 'mixed' },
];

type DemoProfile = {
  device_id: string;
  nickname: string;
  avatar_style: string;
  language: string;
  created_at: string;
  updated_at: string;
};

type AnswerRecord = {
  id: string;
  deviceId: string;
  questionType: string;
  isCorrect: boolean;
  questionData?: any;
  answeredAt: string;
};

type ChapterState = {
  completed_questions: number;
  correct_questions: number;
  status: 'locked' | 'unlocked' | 'completed';
};

type ChallengeResult = {
  id: string;
  deviceId: string;
  nickname: string;
  avatarStyle: string;
  correct_count: number;
  total_count: number;
  time_spent_seconds: number;
  created_at: string;
};

type DeviceState = {
  profile: DemoProfile;
  answers: AnswerRecord[];
  wrongQuestions: any[];
  chapters: Record<string, ChapterState>;
  challengeResults: ChallengeResult[];
};

type DemoState = {
  devices: Record<string, DeviceState>;
};

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function weekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function makeDefaultChapters(): Record<string, ChapterState> {
  return CHAPTERS.reduce<Record<string, ChapterState>>((acc, chapter, index) => {
    acc[chapter.chapter_id] = {
      completed_questions: 0,
      correct_questions: 0,
      status: index === 0 ? 'unlocked' : 'locked',
    };
    return acc;
  }, {});
}

function makeProfile(deviceId: string): DemoProfile {
  const suffix = deviceId.replace(/-/g, '').slice(-4);
  const now = new Date().toISOString();
  return {
    device_id: deviceId,
    nickname: `Demo_${suffix}`,
    avatar_style: 'fish-small',
    language: '简体中文',
    created_at: now,
    updated_at: now,
  };
}

function seedChallengeResults(device: DeviceState): ChallengeResult[] {
  const names = ['RiverAce', 'MathShark', 'BBWizard', 'TurnHero', 'PotMaster', 'RangeLab'];
  const styles = ['shark', 'wizard', 'rock', 'gambler', 'bluffer', 'fish-big'];
  return names.map((name, index) => ({
    id: createId('challenge'),
    deviceId: `seed_${index}`,
    nickname: name,
    avatarStyle: styles[index],
    correct_count: 10 - Math.floor(index / 2),
    total_count: 10,
    time_spent_seconds: 88 + index * 17,
    created_at: new Date(Date.now() - index * 86_400_000).toISOString(),
  })).concat(device.challengeResults);
}

function readState(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch {
    // Ignore corrupt demo storage and start clean.
  }
  return { devices: {} };
}

function writeState(state: DemoState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function ensureDevice(deviceId: string): DeviceState {
  const state = readState();
  if (!state.devices[deviceId]) {
    state.devices[deviceId] = {
      profile: makeProfile(deviceId),
      answers: [],
      wrongQuestions: [],
      chapters: makeDefaultChapters(),
      challengeResults: [],
    };
    writeState(state);
  }
  return state.devices[deviceId];
}

function updateDevice<T>(deviceId: string, updater: (device: DeviceState) => T): T {
  const state = readState();
  if (!state.devices[deviceId]) {
    state.devices[deviceId] = {
      profile: makeProfile(deviceId),
      answers: [],
      wrongQuestions: [],
      chapters: makeDefaultChapters(),
      challengeResults: [],
    };
  }
  const result = updater(state.devices[deviceId]);
  writeState(state);
  return result;
}

function normalizeQuestionType(type?: string) {
  if (!type || type === 'random' || type === 'Random') return undefined;
  return type;
}

function toChapterRows(device: DeviceState) {
  let previousCompleted = true;
  return CHAPTERS.map((chapter, index) => {
    const saved = device.chapters[chapter.chapter_id] || {
      completed_questions: 0,
      correct_questions: 0,
      status: index === 0 ? 'unlocked' : 'locked',
    };
    const isCompleted = saved.completed_questions >= 10 || saved.status === 'completed';
    const status = isCompleted ? 'completed' : previousCompleted || index === 0 ? 'unlocked' : 'locked';
    previousCompleted = isCompleted;
    return {
      chapter_id: chapter.chapter_id,
      chapter_name: chapter.chapter_name,
      status,
      completed_questions: Math.min(saved.completed_questions, 10),
      correct_questions: Math.min(saved.correct_questions, 10),
      total_questions: 10,
    };
  });
}

// ============ Auth ============

export async function guestLogin(deviceId?: string) {
  const id = deviceId || createId('demo');
  const profile = ensureDevice(id).profile;
  return { deviceId: id, profile, isNew: !deviceId };
}

// ============ Questions ============

export async function generateQuestion(type?: string, mode?: 'learning' | 'practice', deviceId?: string) {
  if (type === 'mistake' && deviceId) {
    const device = ensureDevice(deviceId);
    const wrong = device.wrongQuestions.find((q) => !q.mastered);
    if (wrong?.questionData) {
      return { question: { ...wrong.questionData, chapter: '错题强化', _wrongRecordId: wrong.id } };
    }
  }

  let questionType = normalizeQuestionType(type);
  let explicitDifficulty: string | undefined;
  if (type && ['easy', 'medium', 'hard'].includes(type)) {
    explicitDifficulty = type;
    questionType = undefined;
  }

  return { question: makeQuestion(questionType, mode, explicitDifficulty) as unknown as QuizQuestion };
}

export async function generateQuestions(count: number, type?: string) {
  return { questions: makeQuestions(count, normalizeQuestionType(type)) as unknown as QuizQuestion[] };
}

export async function verifyAnswer(data: {
  deviceId: string;
  questionType: string;
  isCorrect: boolean;
  timeSpentMs?: number;
  questionData?: any;
}) {
  updateDevice(data.deviceId, (device) => {
    device.answers.push({
      id: createId('answer'),
      deviceId: data.deviceId,
      questionType: data.questionType,
      isCorrect: data.isCorrect,
      questionData: data.questionData,
      answeredAt: new Date().toISOString(),
    });

    if (!data.isCorrect && data.questionData && !data.questionData._wrongRecordId) {
      const exists = device.wrongQuestions.some((row) =>
        !row.mastered &&
        row.questionData?.situation === data.questionData?.situation &&
        row.questionData?.correctOptionId === data.questionData?.correctOptionId
      );
      if (!exists) {
        device.wrongQuestions.push({
          id: createId('wrong'),
          questionType: data.questionType,
          questionData: data.questionData,
          mastered: false,
          createdAt: new Date().toISOString(),
        });
      }
    }

    if (data.isCorrect && data.questionData?._wrongRecordId) {
      const wrong = device.wrongQuestions.find((row) => row.id === data.questionData._wrongRecordId);
      if (wrong) wrong.mastered = true;
    }
  });

  return { recorded: true };
}

// ============ Calculator ============

export async function computeOdds(data: {
  hand: Card[];
  board: Card[];
  playerCount: number;
}) {
  return calculateOuts(data.hand, data.board, data.playerCount);
}

// ============ Progress & Chapters ============

export async function getProgress(deviceId: string) {
  const device = ensureDevice(deviceId);
  const total = device.answers.length;
  const correct = device.answers.filter((a) => a.isCorrect).length;
  return {
    total_questions: total,
    total_correct: correct,
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    current_streak: 1,
  };
}

export async function getChapters(deviceId: string) {
  return toChapterRows(ensureDevice(deviceId));
}

export async function getStats(deviceId: string) {
  const device = ensureDevice(deviceId);
  const byType = device.answers.reduce<Record<string, { total: number; correct: number }>>((acc, answer) => {
    const key = answer.questionType || 'outs';
    acc[key] ||= { total: 0, correct: 0 };
    acc[key].total += 1;
    if (answer.isCorrect) acc[key].correct += 1;
    return acc;
  }, {});

  const labels: Record<string, string> = {
    outs: '补牌',
    odds: '赔率',
    preflop: '起手牌',
    equity: '胜率',
    position: '位置',
    ev: 'EV',
    bluff: '诈唬',
    style: '风格',
  };

  return Object.entries(labels).map(([type, label]) => {
    const stats = byType[type] || { total: 0, correct: 0 };
    const accuracy = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
    return {
      name: label,
      accuracy,
      total: stats.total,
      correct: stats.correct,
      trend: accuracy >= 70 ? 'up' : 'down',
      trendValue: stats.total ? `${Math.abs(accuracy - 70)}%` : '0%',
    };
  });
}

export async function getWrongCount(deviceId: string) {
  const count = ensureDevice(deviceId).wrongQuestions.filter((q) => !q.mastered).length;
  return { count };
}

export async function updateChapterProgress(deviceId: string, chapterId: string, isCorrect: boolean) {
  return updateDevice(deviceId, (device) => {
    const chapter = device.chapters[chapterId] || { completed_questions: 0, correct_questions: 0, status: 'unlocked' as const };
    chapter.completed_questions = Math.min(10, chapter.completed_questions + 1);
    chapter.correct_questions = Math.min(10, chapter.correct_questions + (isCorrect ? 1 : 0));
    chapter.status = chapter.completed_questions >= 10 ? 'completed' : 'unlocked';
    device.chapters[chapterId] = chapter;

    if (chapter.status === 'completed') {
      const currentIndex = CHAPTERS.findIndex((c) => c.chapter_id === chapterId);
      const next = CHAPTERS[currentIndex + 1];
      if (next && !device.chapters[next.chapter_id]) {
        device.chapters[next.chapter_id] = { completed_questions: 0, correct_questions: 0, status: 'unlocked' };
      } else if (next && device.chapters[next.chapter_id].status === 'locked') {
        device.chapters[next.chapter_id].status = 'unlocked';
      }
    }

    return {
      status: chapter.status === 'completed' ? 'completed' : 'progress',
      completed: chapter.completed_questions,
      correct: chapter.correct_questions,
    };
  });
}

// ============ Challenge ============

export async function getCurrentChallenge(deviceId?: string) {
  if (!deviceId) return null;
  const device = ensureDevice(deviceId);
  const latest = [...device.challengeResults].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return {
    last_correct: latest?.correct_count,
    last_total: latest?.total_count,
    last_time: latest?.time_spent_seconds,
    last_rank: latest ? 3 : undefined,
    lastWeekChampion: { name: 'MathShark', avatarStyle: 'wizard', correct: 10 },
  };
}

export async function submitChallenge(data: {
  deviceId: string;
  correctCount: number;
  totalCount?: number;
  timeSpentSeconds: number;
}) {
  return updateDevice(data.deviceId, (device) => {
    const result: ChallengeResult = {
      id: createId('challenge'),
      deviceId: data.deviceId,
      nickname: device.profile.nickname,
      avatarStyle: device.profile.avatar_style,
      correct_count: data.correctCount,
      total_count: data.totalCount || 10,
      time_spent_seconds: data.timeSpentSeconds,
      created_at: new Date().toISOString(),
    };
    device.challengeResults.push(result);
    return result;
  });
}

export async function getLeaderboard(type: 'weekly' | 'all', deviceId?: string) {
  const state = readState();
  const device = deviceId ? ensureDevice(deviceId) : null;
  const week = weekStart();
  const results = Object.values(state.devices)
    .flatMap((d) => d.challengeResults)
    .concat(device ? seedChallengeResults(device) : []);

  const scoped = type === 'weekly'
    ? results.filter((result) => new Date(result.created_at) >= week)
    : results;

  const bestByDevice = new Map<string, ChallengeResult>();
  for (const result of scoped) {
    const current = bestByDevice.get(result.deviceId);
    if (
      !current ||
      result.correct_count > current.correct_count ||
      (result.correct_count === current.correct_count && result.time_spent_seconds < current.time_spent_seconds)
    ) {
      bestByDevice.set(result.deviceId, result);
    }
  }

  const leaderboard = Array.from(bestByDevice.values())
    .sort((a, b) => b.correct_count - a.correct_count || a.time_spent_seconds - b.time_spent_seconds)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
      name: item.nickname,
      avatarStyle: item.avatarStyle,
    }));

  const myRank = deviceId ? leaderboard.find((item) => item.deviceId === deviceId) || null : null;
  return { leaderboard, myRank };
}

export async function getTodayChallengeCount(deviceId: string) {
  const today = todayKey();
  const count = ensureDevice(deviceId).challengeResults.filter((result) => result.created_at.startsWith(today)).length;
  return { count, limit: 10 };
}

// ============ Profile ============

export async function getProfile(deviceId: string) {
  return ensureDevice(deviceId).profile;
}

export async function updateProfile(data: {
  deviceId: string;
  nickname?: string;
  avatarStyle?: string;
  language?: string;
}) {
  return updateDevice(data.deviceId, (device) => {
    if (data.nickname) device.profile.nickname = data.nickname;
    if (data.avatarStyle) device.profile.avatar_style = data.avatarStyle;
    if (data.language) device.profile.language = data.language;
    device.profile.updated_at = new Date().toISOString();
    return device.profile;
  });
}

export async function getProfileTrend(deviceId: string) {
  const device = ensureDevice(deviceId);
  const weeks = Array.from({ length: 5 }, (_, index) => {
    const end = weekStart();
    end.setDate(end.getDate() - (4 - index) * 7);
    const start = new Date(end);
    const next = new Date(start);
    next.setDate(start.getDate() + 7);
    const answers = device.answers.filter((answer) => {
      const answeredAt = new Date(answer.answeredAt);
      return answeredAt >= start && answeredAt < next;
    });
    const correct = answers.filter((answer) => answer.isCorrect).length;
    return {
      date: `${start.getMonth() + 1}/${start.getDate()}`,
      accuracy: answers.length ? Math.round((correct / answers.length) * 100) : 0,
      average: 70,
    };
  });

  return weeks;
}

// ============ Account Linking / Deletion ============

export async function linkDevice(deviceId: string, _email: string, googleName?: string) {
  const profile = await updateProfile({ deviceId, nickname: googleName || undefined });
  return { nickname: profile.nickname };
}

export async function deleteAccount(deviceId: string) {
  const state = readState();
  delete state.devices[deviceId];
  writeState(state);
  return { deleted: true };
}
