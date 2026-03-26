import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --------------- API Routes ---------------

// Auth - 匿名登录（设备号识别）
import { authRouter } from './routes/auth.js';
app.use('/api/auth', authRouter);

// Questions - 题目生成和校验
import { questionsRouter } from './routes/questions.js';
app.use('/api/questions', questionsRouter);

// Calculator - 概率计算
import { calculatorRouter } from './routes/calculator.js';
app.use('/api/calculator', calculatorRouter);

// Progress - 学习进度
import { progressRouter } from './routes/progress.js';
app.use('/api/progress', progressRouter);

// Challenge - 挑战+排行榜
import { challengeRouter } from './routes/challenge.js';
app.use('/api/challenge', challengeRouter);

// Profile - 个人资料
import { profileRouter } from './routes/profile.js';
app.use('/api/profile', profileRouter);

// --------------- Static Files (Production) ---------------
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ PokerIQ API server running on port ${PORT}`);
});

export default app;
