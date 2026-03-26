import { Router } from 'express';
import { generateQuestion, generateQuestions } from '../engine/question-generator.js';
import { supabaseAdmin } from '../supabase.js';

export const questionsRouter = Router();

/**
 * POST /api/questions/generate
 * Body: { type?: 'outs'|'equity'|'odds'|'preflop'|'random', count?: number }
 */
questionsRouter.post('/generate', (req, res) => {
  try {
    const { type, mode, count = 1, difficulty } = req.body;
    
    let questionType = type === 'random' || type === 'Random' ? undefined : type;
    let explicitDifficulty = difficulty;
    
    // 兼容前端直接将难度作为 type 传递的情况
    if (['easy', 'medium', 'hard'].includes(type)) {
      explicitDifficulty = type;
      questionType = undefined;
    }
    
    if (count === 1) {
      return res.json({ question: generateQuestion(questionType, mode, explicitDifficulty) });
    }
    
    return res.json({ questions: generateQuestions(count, questionType, mode, explicitDifficulty) });
  } catch (err: any) {
    console.error('Question generation error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/questions/verify
 * Body: { deviceId, questionType, isCorrect, timeSpentMs, questionData }
 */
questionsRouter.post('/verify', async (req, res) => {
  try {
    const { deviceId, questionType, isCorrect, timeSpentMs, questionData } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId required' });
    }

    // 记录答题
    await supabaseAdmin.from('quiz_answers').insert({
      device_id: deviceId,
      question_type: questionType,
      is_correct: isCorrect,
      time_spent_ms: timeSpentMs || 0,
      question_data: questionData,
    });

    // 更新用户进度
    const { data: progress } = await supabaseAdmin
      .from('user_progress')
      .select('*')
      .eq('device_id', deviceId)
      .single();

    if (progress) {
      const today = new Date().toISOString().split('T')[0];
      const isNewDay = progress.last_active_date !== today;
      
      await supabaseAdmin
        .from('user_progress')
        .update({
          total_questions: progress.total_questions + 1,
          total_correct: progress.total_correct + (isCorrect ? 1 : 0),
          current_streak: isNewDay ? progress.current_streak + 1 : progress.current_streak,
          last_active_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq('device_id', deviceId);
    }

    // 如果答错，加入错题本
    if (!isCorrect && questionData) {
      await supabaseAdmin.from('wrong_questions').insert({
        device_id: deviceId,
        question_type: questionType,
        question_data: questionData,
      });
    }

    return res.json({ recorded: true });
  } catch (err: any) {
    console.error('Verify error:', err);
    return res.status(500).json({ error: err.message });
  }
});
