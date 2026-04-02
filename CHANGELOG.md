# Changelog

All notable changes to PokerIQ will be documented in this file.

## [v1.0.0] — 2026-04-02

### 🆕 新功能
- 补牌计算器（Outs Calculator）完整引擎：支持翻牌圈/转牌圈多种听牌类型识别
- 9 章学习路径：补牌 → 赔率 → 起手牌 → 胜率 → 位置 → 风格 → EV → 诈唬 → 综合实战
- 随机练习模式：支持难度筛选（容易/中等/困难/随机）
- 挑战模式（Challenge Quiz）+ 题库评估工具
- 错题强化系统：自动收集错题，支持专项复习
- 用户 Profile：10 种扑克风格头像选择、昵称编辑
- 学习数据全息仪表盘：近 5 周正确率趋势图 + 4 项专项分类统计表
- 关卡结果页（ChapterResult）：通过/未通过判定 + 下一关/重试导航
- 底部导航栏：训练/计算器/挑战/个人中心四大模块

### 🔧 Bug 修复
- 修复 learningChapter 类型缺少 name 字段导致的 TS 编译错误
- 修复 recharts activeDot shadow 非法属性的类型错误
- 修复 Training 组件 correct_questions 属性类型断言
- 修复 git 暂存区异常状态

### ⚡ 性能 / 维护
- UX 审计报告（UX_Audit_Report.md）
- Challenge 题库自动化评估脚本 + 100 题批量测试报告
- 配置 commit.gpgSign=false 避免签名卡顿
