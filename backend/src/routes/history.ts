import { Router } from 'express';
import { fetchIndexHistory, fetchStockHistory } from '../services/history.js';

export const historyRouter = Router();

/**
 * GET /api/history/index/:id
 * 1-minute aggregated series for a market index, market open → now.
 * Response: [{ time, value, yesterdayClose }]
 */
historyRouter.get('/index/:id', async (req, res, next) => {
    try {
        const { data } = await fetchIndexHistory(req.params.id);
        res.json(data);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/history/stock/:code
 * 1-minute aggregated series for a stock, market open → now.
 * Response: [{ time, value, yesterdayClose }]
 */
historyRouter.get('/stock/:code', async (req, res, next) => {
    try {
        const { data } = await fetchStockHistory(req.params.code.toUpperCase());
        res.json(data);
    } catch (err) {
        next(err);
    }
});
