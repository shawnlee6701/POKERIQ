import { Router } from 'express';
import { calculateOuts, type Card } from '../engine/outs-calculator.js';

export const calculatorRouter = Router();

/**
 * POST /api/calculator/compute
 * Body: { hand: Card[], board: Card[], playerCount: number }
 */
calculatorRouter.post('/compute', (req, res) => {
  try {
    const { hand, board, playerCount = 2 } = req.body;

    if (!hand || hand.length < 2) {
      return res.status(400).json({ error: '需要至少2张手牌' });
    }
    if (!board || board.length < 3) {
      return res.status(400).json({ error: '需要至少3张公共牌（翻牌）' });
    }

    const result = calculateOuts(hand as Card[], board as Card[], playerCount);
    return res.json(result);
  } catch (err: any) {
    console.error('Calculator error:', err);
    return res.status(500).json({ error: err.message });
  }
});
