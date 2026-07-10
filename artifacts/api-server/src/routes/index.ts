import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountsRouter from "./accounts";
import portfoliosRouter from "./portfolios";
import holdingsRouter from "./holdings";
import transactionsRouter from "./transactions";
// Investment-platform routes
import authRouter from "./auth";
import investmentsRouter from "./investments";
import depositRouter from "./deposit";
import adminRouter from "./admin";
import profitRouter from "./profit";
import userTransactionsRouter from "./userTransactions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(accountsRouter);
router.use(portfoliosRouter);
router.use(holdingsRouter);
router.use(transactionsRouter);
// Investment-platform routes
router.use(authRouter);
router.use(investmentsRouter);
router.use(depositRouter);
router.use(adminRouter);
router.use(profitRouter);
router.use(userTransactionsRouter);

export default router;
