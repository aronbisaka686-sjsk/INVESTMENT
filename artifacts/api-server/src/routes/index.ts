import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountsRouter from "./accounts";
import portfoliosRouter from "./portfolios";
import holdingsRouter from "./holdings";
import transactionsRouter from "./transactions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(accountsRouter);
router.use(portfoliosRouter);
router.use(holdingsRouter);
router.use(transactionsRouter);

export default router;
