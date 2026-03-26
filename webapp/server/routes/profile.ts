import { Router } from 'express';
import { supabaseAdmin } from '../supabase.js';

export const profileRouter = Router();

/**
 * GET /api/profile?deviceId=xxx
 */
profileRouter.get('/', async (req, res) => {
  try {
    const deviceId = req.query.deviceId as string;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('device_id', deviceId)
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/profile
 * Body: { deviceId, nickname?, avatarStyle?, language? }
 */
profileRouter.put('/', async (req, res) => {
  try {
    const { deviceId, nickname, avatarStyle, language } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

    const updates: any = { updated_at: new Date().toISOString() };
    if (nickname !== undefined) updates.nickname = nickname;
    if (avatarStyle !== undefined) updates.avatar_style = avatarStyle;
    if (language !== undefined) updates.language = language;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('device_id', deviceId)
      .select()
      .single();

    if (error) throw error;
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/profile/trend?deviceId=xxx
 * 返回近5周的正确率趋势数据（用于 Profile 趋势图）
 */
profileRouter.get('/trend', async (req, res) => {
  try {
    const deviceId = req.query.deviceId as string;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

    // 获取最近5周的答题记录
    const fiveWeeksAgo = new Date();
    fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - 35);

    const { data: answers, error } = await supabaseAdmin
      .from('quiz_answers')
      .select('is_correct, created_at')
      .eq('device_id', deviceId)
      .gte('created_at', fiveWeeksAgo.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // 按周分组
    const weeklyData: Record<string, { total: number; correct: number }> = {};
    
    (answers || []).forEach(a => {
      const date = new Date(a.created_at);
      const weekStart = new Date(date);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const key = `${String(weekStart.getMonth() + 1).padStart(2, '0')}/${String(weekStart.getDate()).padStart(2, '0')}`;
      
      if (!weeklyData[key]) weeklyData[key] = { total: 0, correct: 0 };
      weeklyData[key].total++;
      if (a.is_correct) weeklyData[key].correct++;
    });

    // 计算累计正确率
    let cumulativeTotal = 0;
    let cumulativeCorrect = 0;

    const trend = Object.entries(weeklyData).map(([date, data]) => {
      cumulativeTotal += data.total;
      cumulativeCorrect += data.correct;
      
      return {
        date,
        accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
        average: cumulativeTotal > 0 ? Math.round((cumulativeCorrect / cumulativeTotal) * 100) : 0,
      };
    });

    return res.json(trend);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
