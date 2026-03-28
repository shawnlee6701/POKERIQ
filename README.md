<![CDATA[<div align="center">

# 🃏 PokerIQ

**测试和强化你的德州扑克算牌能力**

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-pokeriq.vercel.app-000?style=for-the-badge&labelColor=1a1a2e&color=16213e)](https://pokeriq.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)

</div>

---

## 📖 About

PokerIQ 是一款专注于德州扑克概率计算训练的 Web App。通过系统化的章节学习、实战挑战和 Outs 计算器，帮助玩家从"凭感觉打牌"进化为"用数学打牌"。

### ✨ Features

| 功能 | 描述 |
|------|------|
| 📚 **系统训练** | 章节化学习路径，从基础 Outs 到复杂公共牌面分析 |
| ⚡ **挑战模式** | 限时答题挑战，全球排行榜实时排名 |
| 🧮 **Outs 计算器** | 可视化选牌界面，实时计算 Outs、中牌概率和底池赔率 |
| 📊 **数据追踪** | 答题准确率、耗时分析、薄弱环节诊断 |
| 🔄 **错题强化** | 智能收集错题，支持标记已掌握与重复练习 |
| 👤 **个人中心** | 自定义昵称、牌桌主题、多语言支持 |

---

## 🏗️ Tech Stack

```
Frontend    React 19 · TypeScript · Tailwind CSS 4 · Motion · Recharts · Lucide Icons
Backend     Express · Node.js · Supabase (PostgreSQL + Auth)
AI          Google Gemini API (AI 错题分析)
Infra       Vite 6 · Vercel (Serverless)
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Supabase** 项目（[创建免费项目](https://supabase.com/dashboard)）

### 1. Clone & Install

```bash
git clone https://github.com/shawnlee6701/POKERIQ.git
cd POKERIQ/webapp
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

编辑 `.env`，填入你自己的 key：

```env
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
GEMINI_API_KEY="your-gemini-api-key"    # 可选，用于 AI 功能
PORT=3001
```

### 3. Run

```bash
npm run dev
```

前端运行在 `http://localhost:3000`，后端 API 运行在 `http://localhost:3001`。

---

## 📁 Project Structure

```
POKERIQ/
└── webapp/
    ├── src/
    │   ├── App.tsx               # 主应用入口 & 路由
    │   ├── components/
    │   │   ├── Training.tsx      # 系统训练模块
    │   │   ├── Challenge.tsx     # 挑战模式
    │   │   ├── ChallengeQuiz.tsx # 挑战答题界面
    │   │   ├── Calculator.tsx    # Outs 计算器
    │   │   ├── Quiz.tsx          # 通用答题组件
    │   │   ├── Feedback.tsx      # 答题反馈
    │   │   ├── Profile.tsx       # 个人中心 & 数据统计
    │   │   ├── PokerCard.tsx     # 扑克牌可视化组件
    │   │   └── BottomNav.tsx     # 底部导航栏
    │   ├── lib/
    │   │   └── api.ts            # API 客户端
    │   └── types.ts              # TypeScript 类型定义
    ├── server/
    │   ├── index.ts              # Express 服务入口
    │   ├── supabase.ts           # Supabase 客户端
    │   ├── engine/
    │   │   ├── question-generator.ts  # 题目生成引擎
    │   │   └── outs-calculator.ts     # Outs 概率计算引擎
    │   └── routes/
    │       ├── questions.ts      # 题目 API
    │       ├── challenge.ts      # 挑战 API
    │       ├── progress.ts       # 进度 & 排行榜 API
    │       ├── profile.ts        # 用户资料 API
    │       ├── calculator.ts     # 计算器 API
    │       └── auth.ts           # 设备认证 API
    └── supabase/                 # 数据库 Schema & Migrations
```

---

## 🤝 Contributing

欢迎提交 Issue 和 Pull Request！

1. Fork 这个仓库
2. 创建你的分支 (`git checkout -b feature/amazing-feature`)
3. 提交改动 (`git commit -m 'feat: add amazing feature'`)
4. 推送到远程 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

---

## 📄 License

MIT © [shawnlee6701](https://github.com/shawnlee6701)
]]>
