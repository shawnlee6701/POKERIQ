<div align="center">

# 🃏 PokerIQ

**一款专注「由直觉走向精确数学」的德牌辅助训练工具**

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-000?style=flat-square&logo=vercel)](https://pokeriq.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)

</div>

<br />

> 放弃那些仅靠“感觉”的 All-in。
> 
> PokerIQ 致力于提供系统化的实战牌局、瞬时响应的胜率计算器，和冷酷到底的错题本——帮助每一位德州扑克玩家构建基于数学概率底层的肌肉记忆。

<br />

## ✨ 核心亮点

不再有厚重的理论书，只有直击痛点的实战工具箱：

- 🎯 **[系统训练] 拆解每一个动作**
  从看懂翻牌前，到计算转牌圈的复杂听牌组合。海量牌面实时生成，步步为营提升算牌力。
  
- ⏱️ **[极速挑战] 全球反应力较量**
  限时答题模式。不仅要知道怎么算，还要算得比对手快。全球积分榜实时更新您的段位。
  
- 🧮 **[胜率沙盘] 所见即所得的计算器**
  复盘实录工具。拖拽选择底牌与公牌，引擎毫秒级反馈真实的 Outs（出路）数量、中牌概率及底池赔率。

- 🤖 **[AI 错题引擎] 你的私人量化教练**
  自动捕获失误决策，接入 Google Gemini 深度诊断并生成专属错题集，直至完全掌握。

<br />

## 🛠️ 技术底座

保持极致轻量、高效与现代。

*   **界面层 (Frontend)** — React 19, TypeScript, Tailwind CSS 4, Framer Motion
*   **计算芯 (Backend)** — Express Node.js, 手写高性能概率引擎
*   **数据仓 (Database)** — Supabase (Postgres), Vercel Serverless

<br />

## 🚀 3分钟快速启动

想自己造轮子或者二开？跑起来非常简单。

**1. 拉取代码并安装**
```bash
git clone https://github.com/shawnlee6701/POKERIQ.git
cd POKERIQ/webapp
npm install
```

**2. 注入环境变量**
```bash
cp .env.example .env
```
*(请在 `.env` 中补齐您的 Supabase 及 Gemini 凭证)*

**3. 点火起飞**
```bash
npm run dev
```
前端门户部署于 `http://localhost:3000`，后端引擎巡航于 `http://localhost:3001`。

<br />

## 📁 极简业务结构

```text
webapp/
├── src/
│   ├── components/    # 视觉组件 (挑战窗, 计算器, 全局图表)
│   ├── lib/           # 对外通讯 (API Client)
│   └── types.ts       # 全局业务类型
└── server/
    ├── engine/        # 德州核心发牌与算率引擎
    └── routes/        # 网关路由分配
```

<br />

---

<div align="center">
  <sub>MIT License · 设计与开发： <a href="https://github.com/shawnlee6701">shawnlee6701</a></sub>
</div>
