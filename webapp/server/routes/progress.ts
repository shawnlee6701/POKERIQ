import { Router } from 'express';
import { supabaseAdmin } from '../supabase.js';

export const progressRouter = Router();

/**
 * GET /api/progress?deviceId=xxx
 */
progressRouter.get('/', async (req, res) => {
  try {
    const deviceId = req.query.deviceId as string;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

    const { data, error } = await supabaseAdmin
      .from('user_progress')
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
 * GET /api/progress/chapters?deviceId=xxx
 */
progressRouter.get('/chapters', async (req, res) => {
  try {
    const deviceId = req.query.deviceId as string;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

    const { data, error } = await supabaseAdmin
      .from('chapter_progress')
      .select('*')
      .eq('device_id', deviceId)
      .order('chapter_id', { ascending: true });

    let chapters = data || [];
    
    // 自动补全老用户的缺失章节 (5 -> 9 章)
    const REQUIRED_CHAPTERS = [
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

    if (chapters.length < REQUIRED_CHAPTERS.length) {
      const existingIds = new Set(chapters.map((c: any) => c.chapter_id));
      const missingChapters = REQUIRED_CHAPTERS.filter(c => !existingIds.has(c.chapter_id));
      
      if (missingChapters.length > 0) {
        const inserts = missingChapters.map(ch => ({
          device_id: deviceId,
          chapter_id: ch.chapter_id,
          chapter_name: ch.chapter_name,
          status: ch.status,
          completed_questions: 0,
          total_questions: 10
        }));
        
        // 增量插入
        await supabaseAdmin.from('chapter_progress').insert(inserts);
        
        // 合并数据用于本次返回
        chapters = [...chapters, ...inserts].sort((a, b) => a.chapter_id.localeCompare(b.chapter_id));
      }
    }

    return res.json(chapters);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/progress/stats?deviceId=xxx
 * 返回各题型的正确率统计（用于 Profile 页面）
 */
progressRouter.get('/stats', async (req, res) => {
  try {
    const deviceId = req.query.deviceId as string;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

    const { data: answers, error } = await supabaseAdmin
      .from('quiz_answers')
      .select('question_type, is_correct, created_at')
      .eq('device_id', deviceId);

    if (error) throw error;

    // 按题型统计
    const typeMap: Record<string, { label: string }> = {
      'outs': { label: '补牌计算' },
      'equity': { label: '胜率判断' },
      'odds': { label: '赔率计算' },
      'preflop': { label: '翻前策略' },
      'position': { label: '位置策略' },
      'style': { label: '对手风格' },
      'ev': { label: 'EV决策' },
      'bluff': { label: '诈唬识别' }
    };

    const stats = Object.entries(typeMap).map(([type, meta]) => {
      const typeAnswers = (answers || []).filter(a => a.question_type === type);
      const total = typeAnswers.length;
      const correct = typeAnswers.filter(a => a.is_correct).length;
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

      // 简单趋势计算（最近20题 vs 之前）
      const recent = typeAnswers.slice(-20);
      const older = typeAnswers.slice(0, -20);
      const recentAcc = recent.length > 0 ? recent.filter(a => a.is_correct).length / recent.length * 100 : 0;
      const olderAcc = older.length > 0 ? older.filter(a => a.is_correct).length / older.length * 100 : 0;
      const trendValue = recent.length > 0 && older.length > 0 ? Math.round(recentAcc - olderAcc) : 0;

      return {
        type,
        label: meta.label,
        accuracy,
        total,
        trend: trendValue >= 0 ? 'up' : 'down',
        trendValue: `${trendValue >= 0 ? '+' : ''}${trendValue}%`,
      };
    });

    return res.json(stats);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/progress/wrong-count?deviceId=xxx
 * 返回未掌握的错题数量
 */
progressRouter.get('/wrong-count', async (req, res) => {
  try {
    const deviceId = req.query.deviceId as string;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

    const { count, error } = await supabaseAdmin
      .from('wrong_questions')
      .select('*', { count: 'exact', head: true })
      .eq('device_id', deviceId)
      .eq('mastered', false);

    if (error) throw error;
    return res.json({ count: count || 0 });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/progress/chapter/update
 * 更新关卡进度与及格结算 (≥8 满10)
 */
progressRouter.post('/chapter/update', async (req, res) => {
  try {
    const { deviceId, chapterId, isCorrect } = req.body;
    if (!deviceId || !chapterId) return res.status(400).json({ error: 'Missing params' });

    const { data: chapter, error: fetchErr } = await supabaseAdmin
      .from('chapter_progress')
      .select('*')
      .eq('device_id', deviceId)
      .eq('chapter_id', chapterId)
      .single();

    if (fetchErr || !chapter) return res.status(404).json({ error: 'Chapter not found' });

    // 防刷题：如果关卡已经完成，拒绝任何新的累计
    if (chapter.status === 'completed') {
      return res.json({ 
        status: 'completed', 
        completed: chapter.completed_questions, 
        correct: chapter.correct_questions 
      });
    }

    const newCompleted = (chapter.completed_questions || 0) + 1;
    const newCorrect = (chapter.correct_questions || 0) + (isCorrect ? 1 : 0);
    const total = chapter.total_questions || 10;

    if (newCompleted >= total) {
      if (newCorrect >= 8) {
        // 通关成功 (≥8及格)
        await supabaseAdmin
          .from('chapter_progress')
          .update({ completed_questions: newCompleted, correct_questions: newCorrect, status: 'completed' })
          .eq('id', chapter.id);

        // 尝试解锁下一关 (提取数字后缀并+1)
        const match = chapterId.match(/ch(\d+)/);
        if (match) {
          const nextId = `ch${parseInt(match[1]) + 1}`;
          await supabaseAdmin
            .from('chapter_progress')
            .update({ status: 'unlocked' })
            .eq('device_id', deviceId)
            .eq('chapter_id', nextId)
            .eq('status', 'locked');
        }

        return res.json({ status: 'completed', completed: newCompleted, correct: newCorrect });
      } else {
        // 通关失败 (<8)，重置进度以便重新挑战
        await supabaseAdmin
          .from('chapter_progress')
          .update({ completed_questions: 0, correct_questions: 0 })
          .eq('id', chapter.id);

        return res.json({ status: 'failed', completed: newCompleted, correct: newCorrect });
      }
    } else {
      // 保存中断进度
      await supabaseAdmin
        .from('chapter_progress')
        .update({ completed_questions: newCompleted, correct_questions: newCorrect })
        .eq('id', chapter.id);

      return res.json({ status: 'progress', completed: newCompleted, correct: newCorrect });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
