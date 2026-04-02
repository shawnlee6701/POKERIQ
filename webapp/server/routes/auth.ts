import { Router } from 'express';
import { supabaseAdmin } from '../supabase.js';
import { v4 as uuidv4 } from 'uuid';

export const authRouter = Router();

/**
 * POST /api/auth/guest
 * 匿名登录 - 基于设备ID识别用户
 * Body: { deviceId?: string }
 * 返回: { deviceId, profile, isNew }
 */
authRouter.post('/guest', async (req, res) => {
  try {
    let { deviceId } = req.body;
    
    // 如果没有提供 deviceId，生成一个新的
    if (!deviceId) {
      deviceId = uuidv4();
    }

    // 查找或创建用户
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('device_id', deviceId)
      .single();

    if (existing) {
      return res.json({ deviceId, profile: existing, isNew: false });
    }

    // 创建新用户 - 昵称为 User_+ID后4位，默认头像小鱼
    const idSuffix = deviceId.replace(/-/g, '').slice(-4);
    const { data: newProfile, error } = await supabaseAdmin
      .from('profiles')
      .insert({
        device_id: deviceId,
        nickname: `User_${idSuffix}`,
        avatar_style: 'fish-small',
        player_level: '小鱼 (Small Fish)',
      })
      .select()
      .single();

    if (error) throw error;

    // 初始化进度
    await supabaseAdmin
      .from('user_progress')
      .insert({ device_id: deviceId });

    // 初始化章节进度
    const chapters = [
      { chapter_id: 'ch1', chapter_name: '认识补牌', status: 'unlocked' },
      { chapter_id: 'ch2', chapter_name: '赔率计算', status: 'locked' },
      { chapter_id: 'ch3', chapter_name: '起手牌选择', status: 'locked' },
      { chapter_id: 'ch4', chapter_name: '胜率评估', status: 'locked' },
      { chapter_id: 'ch5', chapter_name: '位置与行动', status: 'locked' },
      { chapter_id: 'ch6', chapter_name: '识别对手风格', status: 'locked' },
      { chapter_id: 'ch7', chapter_name: 'EV 决策', status: 'locked' },
      { chapter_id: 'ch8', chapter_name: '诈唬识别', status: 'locked' },
      { chapter_id: 'ch9', chapter_name: '综合实战', status: 'locked' },
    ];

    await supabaseAdmin
      .from('chapter_progress')
      .insert(chapters.map(ch => ({ device_id: deviceId, ...ch })));

    return res.json({ deviceId, profile: newProfile, isNew: true });
  } catch (err: any) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/auth/delete
 * 删除用户账号与所有关联数据 (App Store 合规要求)
 * Body: { deviceId: string }
 * 返回: { deleted: true }
 */
authRouter.delete('/delete', async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    // CASCADE 会自动清理 user_progress, chapter_progress,
    // quiz_answers, challenge_results, wrong_questions
    const { error } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('device_id', deviceId);

    if (error) throw error;

    return res.json({ deleted: true });
  } catch (err: any) {
    console.error('Delete account error:', err);
    return res.status(500).json({ error: err.message });
  }
});
