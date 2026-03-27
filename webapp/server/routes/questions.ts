import { Router } from 'express';
import { generateQuestion, generateQuestions } from '../engine/question-generator.js';
import { supabaseAdmin } from '../supabase.js';

export const questionsRouter = Router();

/**
 * POST /api/questions/generate
 * Body: { type?: 'outs'|'equity'|'odds'|'preflop'|'random', count?: number }
 */
questionsRouter.post('/generate', async (req, res) => {
  try {
    const { type, mode, count = 1, difficulty, deviceId } = req.body;
    
    // Handle Mistake Review
    if (type === 'mistake') {
      if (!deviceId) return res.status(400).json({ error: 'deviceId required for mistake mode' });
      const { data: wrongQuestions, error } = await supabaseAdmin
        .from('wrong_questions')
        .select('*')
        .eq('device_id', deviceId)
        .eq('mastered', false);
        
      if (wrongQuestions && wrongQuestions.length > 0) {
        const t = wrongQuestions[Math.floor(Math.random() * wrongQuestions.length)];
        const qData = t.question_data;
        qData.chapter = '错题强化';
        qData._wrongRecordId = t.id;
        return res.json({ question: qData });
      } else {
        const fallback = generateQuestion('outs', mode, difficulty);
        fallback.chapter = '错题强化 (已无错题)';
        return res.json({ question: fallback });
      }
    }
    
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

    // 如果答错且不是在复习错题，则加入错题本
    if (!isCorrect && questionData && !questionData._wrongRecordId) {
      await supabaseAdmin.from('wrong_questions').insert({
        device_id: deviceId,
        question_type: questionType,
        question_data: questionData,
      });
    }

    // 如果是错题再练且答对，从错题本移出 (标记 mastered=true)
    if (isCorrect && questionData && questionData._wrongRecordId) {
      await supabaseAdmin
        .from('wrong_questions')
        .update({ mastered: true })
        .eq('id', questionData._wrongRecordId);
    }

    return res.json({ recorded: true });
  } catch (err: any) {
    console.error('Verify error:', err);
    return res.status(500).json({ error: err.message });
  }
});
