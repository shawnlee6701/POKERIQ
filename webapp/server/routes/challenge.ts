import { Router } from 'express';
import { supabaseAdmin } from '../supabase.js';

export const challengeRouter = Router();

// ==== Memory Cache for Leaderboards ====
const leaderboardCache: Record<string, { timestamp: number, leaderboard: any[], bestByDevice: Map<string, any>, totalPlayers: number }> = {
  weekly: { timestamp: 0, leaderboard: [], bestByDevice: new Map(), totalPlayers: 0 },
  all: { timestamp: 0, leaderboard: [], bestByDevice: new Map(), totalPlayers: 0 }
};

// 获取东八区日期字符串用于判定是否隔天 (YYYY-M-D)
function getBeijingDateString(timestamp: number) {
  const d = new Date(timestamp + 8 * 3600 * 1000); // UTC+8
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

function getCurrentWeek(): string {
  const now = new Date();
  const oneJan = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil((((now.getTime() - oneJan.getTime()) / 86400000) + oneJan.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getWeekEndTime(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday);
  endOfWeek.setHours(23, 59, 59, 999);
  return endOfWeek.toISOString();
}

/**
 * GET /api/challenge/current?deviceId=xxx
 */
challengeRouter.get('/current', async (req, res) => {
  try {
    const deviceId = req.query.deviceId as string;
    const currentWeek = getCurrentWeek();
    const weekEnd = getWeekEndTime();

    // 获取参与者总数
    const { count: totalParticipants } = await supabaseAdmin
      .from('challenge_results')
      .select('device_id', { count: 'exact', head: true })
      .eq('challenge_week', currentWeek);

    // 获取用户上周成绩
    const now = new Date();
    const lastWeekDate = new Date(now);
    lastWeekDate.setDate(lastWeekDate.getDate() - 7);
    const oneJan = new Date(lastWeekDate.getFullYear(), 0, 1);
    const lastWeekNum = Math.ceil((((lastWeekDate.getTime() - oneJan.getTime()) / 86400000) + oneJan.getDay() + 1) / 7);
    const lastWeek = `${lastWeekDate.getFullYear()}-W${String(lastWeekNum).padStart(2, '0')}`;

    let lastWeekStats = null;
    if (deviceId) {
      const { data: lastResults } = await supabaseAdmin
        .from('challenge_results')
        .select('*')
        .eq('device_id', deviceId)
        .eq('challenge_week', lastWeek)
        .order('correct_count', { ascending: false })
        .limit(1);

      if (lastResults && lastResults.length > 0) {
        const best = lastResults[0];
        // 获取排名
        const { count: betterCount } = await supabaseAdmin
          .from('challenge_results')
          .select('*', { count: 'exact', head: true })
          .eq('challenge_week', lastWeek)
          .gt('correct_count', best.correct_count);

        lastWeekStats = {
          correct: best.correct_count,
          total: best.total_count,
          timeSpent: best.time_spent_seconds,
          rank: (betterCount || 0) + 1,
        };
      }
    }

    // 获取上周冠军
    const { data: lastWeekChampionData } = await supabaseAdmin
      .from('challenge_results')
      .select(`
        correct_count,
        time_spent_seconds,
        profiles!inner(nickname, avatar_style)
      `)
      .eq('challenge_week', lastWeek)
      .order('correct_count', { ascending: false })
      .order('time_spent_seconds', { ascending: true })
      .limit(1);

    let lastWeekChampion = null;
    if (lastWeekChampionData && lastWeekChampionData.length > 0) {
      const champ = lastWeekChampionData[0];
      lastWeekChampion = {
        name: (champ.profiles as any)?.nickname || 'Player',
        avatarStyle: (champ.profiles as any)?.avatar_style || 'shark',
        correct: champ.correct_count,
        timeSpent: champ.time_spent_seconds
      };
    }

    return res.json({
      currentWeek,
      weekEnd,
      totalParticipants: totalParticipants || 0,
      lastWeekStats,
      lastWeekChampion,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/challenge/submit
 * Body: { deviceId, correctCount, totalCount, timeSpentSeconds }
 */
challengeRouter.post('/submit', async (req, res) => {
  try {
    const { deviceId, correctCount, totalCount = 10, timeSpentSeconds } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

    // [Security C2] 服务端强校验数据合法范围，防止刷分
    const count = Number(correctCount);
    const total = Number(totalCount);
    const time = Number(timeSpentSeconds);
    if (!Number.isInteger(count) || count < 0 || count > 10) {
      return res.status(400).json({ error: 'Invalid correctCount' });
    }
    if (!Number.isInteger(total) || total < 1 || total > 10) {
      return res.status(400).json({ error: 'Invalid totalCount' });
    }
    if (!Number.isFinite(time) || time < 1 || time > 600) {
      return res.status(400).json({ error: 'Invalid timeSpentSeconds' });
    }

    // [Security L2] 服务端强制执行每日提交限制（上限10次）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabaseAdmin
      .from('challenge_results')
      .select('*', { count: 'exact', head: true })
      .eq('device_id', deviceId)
      .gte('created_at', today.toISOString());

    if ((todayCount || 0) >= 10) {
      return res.status(429).json({ error: 'Daily challenge limit reached' });
    }

    const currentWeek = getCurrentWeek();

    const { data, error } = await supabaseAdmin
      .from('challenge_results')
      .insert({
        device_id: deviceId,
        correct_count: count,
        total_count: total,
        time_spent_seconds: time,
        challenge_week: currentWeek,
      })
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (err: any) {
    console.error('Challenge submit error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/challenge/leaderboard?type=weekly|all&deviceId=xxx
 */
challengeRouter.get('/leaderboard', async (req, res) => {
  try {
    const type = (req.query.type as string) || 'weekly';
    const deviceId = req.query.deviceId as string;

    const cacheKey = type === 'weekly' ? 'weekly' : 'all';
    const now = Date.now();
    
    let leaderboard = [];
    let bestByDevice = new Map<string, any>();
    let totalPlayers = 0;

    const cachedDate = leaderboardCache[cacheKey].timestamp ? getBeijingDateString(leaderboardCache[cacheKey].timestamp) : '';
    const nowDate = getBeijingDateString(now);

    // 只要都在东八区的同一天内，就一直使用缓存
    if (leaderboardCache[cacheKey].timestamp && cachedDate === nowDate) {
      // 缓存命中
      leaderboard = leaderboardCache[cacheKey].leaderboard;
      bestByDevice = leaderboardCache[cacheKey].bestByDevice;
      totalPlayers = leaderboardCache[cacheKey].totalPlayers;
    } else {
      let query = supabaseAdmin.from('challenge_results').select(`
        device_id,
        correct_count,
        time_spent_seconds,
        challenge_week,
        profiles!inner(nickname, avatar_style)
      `);

      if (type === 'weekly') {
        query = query.eq('challenge_week', getCurrentWeek());
      }

      const { data: results, error } = await query
        .order('correct_count', { ascending: false })
        .order('time_spent_seconds', { ascending: true })
        .limit(100);

      if (error) throw error;

      // 去重（每个用户只保留最佳成绩）
      (results || []).forEach(r => {
        const existing = bestByDevice.get(r.device_id);
        if (!existing || r.correct_count > existing.correct_count || 
            (r.correct_count === existing.correct_count && r.time_spent_seconds < existing.time_spent_seconds)) {
          bestByDevice.set(r.device_id, r);
        }
      });

      leaderboard = Array.from(bestByDevice.values())
        .sort((a, b) => b.correct_count - a.correct_count || a.time_spent_seconds - b.time_spent_seconds)
        .slice(0, 100)
        .map((r, idx) => ({
          rank: idx + 1,
          deviceId: r.device_id,
          name: (r.profiles as any)?.nickname || 'Player',
          avatarStyle: (r.profiles as any)?.avatar_style || 'shark',
          correct: r.correct_count,
          timeSpent: r.time_spent_seconds,
        }));
        
      totalPlayers = bestByDevice.size;
      
      // 更新缓存
      leaderboardCache[cacheKey] = {
        timestamp: now,
        leaderboard,
        bestByDevice,
        totalPlayers
      };
    }

    // 获取当前用户排名
    let myRank = null;
    if (deviceId) {
      const myEntry = leaderboard.find(e => e.deviceId === deviceId);
      if (myEntry) {
        myRank = myEntry;
      } else {
        // 用户不在前100，查总排名
        const myBest = bestByDevice.get(deviceId);
        if (myBest) {
          const { count } = await supabaseAdmin
            .from('challenge_results')
            .select('*', { count: 'exact', head: true })
            .gt('correct_count', myBest.correct_count);
          myRank = {
            rank: (count || 0) + 1,
            deviceId,
            name: (myBest.profiles as any)?.nickname || 'Player',
            correct: myBest.correct_count,
            timeSpent: myBest.time_spent_seconds,
          };
        }
      }
    }

    const beatPercentage = myRank ? Math.round((1 - myRank.rank / Math.max(totalPlayers, 1)) * 100) : 0;

    return res.json({
      leaderboard,
      myRank: myRank ? { ...myRank, beatPercentage } : null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/challenge/today-count?deviceId=xxx
 * 返回今日挑战次数
 */
challengeRouter.get('/today-count', async (req, res) => {
  try {
    const deviceId = req.query.deviceId as string;
    if (!deviceId) return res.json({ count: 0, limit: 10 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const { count, error } = await supabaseAdmin
      .from('challenge_results')
      .select('*', { count: 'exact', head: true })
      .eq('device_id', deviceId)
      .gte('created_at', todayISO);

    if (error) throw error;
    return res.json({ count: count || 0, limit: 10 });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
