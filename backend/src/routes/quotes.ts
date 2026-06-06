import { Router } from 'express';
import { prisma } from '../services/db.js';

export const quotesRouter = Router();

/**
 * GET /api/quotes/stocks/:tradeCode
 * Time-ordered tick series for one stock, used to seed the chart on load.
 */
quotesRouter.get('/stocks/:tradeCode', async (req, res, next) => {
    try {
        const ticks = await prisma.stockTick.findMany({
            where: { tradeCode: req.params.tradeCode.toUpperCase() },
            orderBy: { time: 'asc' },
            take: 500,
        });
        res.json(ticks);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/quotes/index/:indexId
 * Time-ordered tick series for one market index.
 */
quotesRouter.get('/index/:indexId', async (req, res, next) => {
    try {
        const ticks = await prisma.indexTick.findMany({
            where: { indexId: req.params.indexId },
            orderBy: { time: 'asc' },
            take: 500,
        });
        res.json(ticks);
    } catch (err) {
        next(err);
    }
});
