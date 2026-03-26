-- PokerIQ Database Schema
-- Run in Supabase SQL Editor

-- 用户资料
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,
  nickname TEXT DEFAULT 'Player',
  avatar_style TEXT DEFAULT 'shark',
  player_level TEXT DEFAULT '小鱼 (Small Fish)',
  language TEXT DEFAULT '简体中文',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 用户进度
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL REFERENCES profiles(device_id) ON DELETE CASCADE,
  total_questions INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  last_active_date DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 章节进度
CREATE TABLE IF NOT EXISTS chapter_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL REFERENCES profiles(device_id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL,
  chapter_name TEXT NOT NULL,
  total_questions INTEGER DEFAULT 10,
  completed_questions INTEGER DEFAULT 0,
  correct_questions INTEGER DEFAULT 0,
  status TEXT DEFAULT 'locked' CHECK (status IN ('locked', 'unlocked', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(device_id, chapter_id)
);

-- 答题记录
CREATE TABLE IF NOT EXISTS quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL REFERENCES profiles(device_id) ON DELETE CASCADE,
  question_type TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_spent_ms INTEGER DEFAULT 0,
  question_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 挑战结果
CREATE TABLE IF NOT EXISTS challenge_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL REFERENCES profiles(device_id) ON DELETE CASCADE,
  correct_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 10,
  time_spent_seconds INTEGER DEFAULT 0,
  challenge_week TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(device_id, challenge_week, created_at)
);

-- 错题本
CREATE TABLE IF NOT EXISTS wrong_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL REFERENCES profiles(device_id) ON DELETE CASCADE,
  question_type TEXT NOT NULL,
  question_data JSONB NOT NULL,
  review_count INTEGER DEFAULT 0,
  mastered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_quiz_answers_device ON quiz_answers(device_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_type ON quiz_answers(device_id, question_type);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_date ON quiz_answers(created_at);
CREATE INDEX IF NOT EXISTS idx_challenge_results_week ON challenge_results(challenge_week);
CREATE INDEX IF NOT EXISTS idx_challenge_results_device ON challenge_results(device_id);
CREATE INDEX IF NOT EXISTS idx_wrong_questions_device ON wrong_questions(device_id);

-- RLS Policies (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapter_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE wrong_questions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (all operations go through server)
CREATE POLICY "Service role full access" ON profiles FOR ALL USING (true);
CREATE POLICY "Service role full access" ON user_progress FOR ALL USING (true);
CREATE POLICY "Service role full access" ON chapter_progress FOR ALL USING (true);
CREATE POLICY "Service role full access" ON quiz_answers FOR ALL USING (true);
CREATE POLICY "Service role full access" ON challenge_results FOR ALL USING (true);
CREATE POLICY "Service role full access" ON wrong_questions FOR ALL USING (true);
