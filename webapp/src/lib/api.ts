/**
 * 前端 API 封装层
 * 统一管理所有 API 请求
 */

const API_BASE = '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'API request failed');
  }
  
  return res.json();
}

// ============ Auth ============

export async function guestLogin(deviceId?: string) {
  return apiFetch<{ deviceId: string; profile: any; isNew: boolean }>('/auth/guest', {
    method: 'POST',
    body: JSON.stringify({ deviceId }),
  });
}

// ============ Questions ============

export async function generateQuestion(type?: string, mode?: 'learning' | 'practice') {
  return apiFetch<{ question: any }>('/questions/generate', {
    method: 'POST',
    body: JSON.stringify({ type, mode, count: 1 }),
  });
}

export async function generateQuestions(count: number, type?: string) {
  return apiFetch<{ questions: any[] }>('/questions/generate', {
    method: 'POST',
    body: JSON.stringify({ type, count }),
  });
}

export async function verifyAnswer(data: {
  deviceId: string;
  questionType: string;
  isCorrect: boolean;
  timeSpentMs?: number;
  questionData?: any;
}) {
  return apiFetch<{ recorded: boolean }>('/questions/verify', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============ Calculator ============

export async function computeOdds(data: {
  hand: any[];
  board: any[];
  playerCount: number;
}) {
  return apiFetch<{
    win: number;
    tie: number;
    loss: number;
    handName: string;
    outs: number;
    outsType: string;
    outsCards: { rank: string; suit: string }[];
    turnHit: number;
    riverHit: number;
    totalHit: number;
  }>('/calculator/compute', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============ Progress & Chapters ============

export async function getProgress(deviceId: string) {
  return apiFetch<any>(`/progress?deviceId=${deviceId}`);
}

export async function getChapters(deviceId: string) {
  return apiFetch<any[]>(`/progress/chapters?deviceId=${deviceId}`);
}

export async function getStats(deviceId: string) {
  return apiFetch<any[]>(`/progress/stats?deviceId=${deviceId}`);
}

export async function getWrongCount(deviceId: string) {
  return apiFetch<{ count: number }>(`/progress/wrong-count?deviceId=${deviceId}`);
}

export async function updateChapterProgress(deviceId: string, chapterId: string, isCorrect: boolean) {
  return apiFetch<{ status: string; completed?: number; correct?: number }>('/progress/chapter/update', {
    method: 'POST',
    body: JSON.stringify({ deviceId, chapterId, isCorrect }),
  });
}

// ============ Challenge ============

export async function getCurrentChallenge(deviceId?: string) {
  return apiFetch<any>(`/challenge/current${deviceId ? `?deviceId=${deviceId}` : ''}`);
}

export async function submitChallenge(data: {
  deviceId: string;
  correctCount: number;
  totalCount?: number;
  timeSpentSeconds: number;
}) {
  return apiFetch<any>('/challenge/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getLeaderboard(type: 'weekly' | 'all', deviceId?: string) {
  const params = new URLSearchParams({ type });
  if (deviceId) params.set('deviceId', deviceId);
  return apiFetch<{ leaderboard: any[]; myRank: any }>(`/challenge/leaderboard?${params}`);
}

export async function getTodayChallengeCount(deviceId: string) {
  return apiFetch<{ count: number; limit: number }>(`/challenge/today-count?deviceId=${deviceId}`);
}

// ============ Profile ============

export async function getProfile(deviceId: string) {
  return apiFetch<any>(`/profile?deviceId=${deviceId}`);
}

export async function updateProfile(data: {
  deviceId: string;
  nickname?: string;
  avatarStyle?: string;
  language?: string;
}) {
  return apiFetch<any>('/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getProfileTrend(deviceId: string) {
  return apiFetch<any[]>(`/profile/trend?deviceId=${deviceId}`);
}
