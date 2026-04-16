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

// [Security] 限制 CORS 只允许已知域名
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.ALLOWED_ORIGIN,       // Vercel 部署后填入生产域名
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // 允许服务端自身调用（无 origin，如 curl/Postman 本地测试）或白名单内域名
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));

// [Security] HTTP 安全响应头（不依赖 helmet）
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '50kb' })); // [Security] 限制请求体大小，防止 DoS

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
