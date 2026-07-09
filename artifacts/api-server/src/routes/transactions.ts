import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, transactionsTable } from "@workspace/db";
import {
  ListTransactionsQueryParams,
  ListTransactionsResponse,
  CreateTransactionBody,
  CreateTransactionResponse,
  GetTransactionParams,
  GetTransactionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /transactions — list transactions (filtered by portfolioId and/or ticker)
router.get("/transactions", async (req, res): Promise<void> => {
  const query = ListTransactionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { portfolioId, ticker } = query.data;

  const conditions = [];
  if (portfolioId) conditions.push(eq(transactionsTable.portfolioId, portfolioId));
  if (ticker) conditions.push(eq(transactionsTable.ticker, ticker.toUpperCase()));

  const transactions = await db
    .select()
    .from(transactionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(transactionsTable.transactedAt);

  res.json(ListTransactionsResponse.parse(transactions));
});

// POST /transactions — record a new transaction
router.post("/transactions", async (req, res): Promise<void> => {
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [transaction] = await db
    .insert(transactionsTable)
    .values({
      portfolioId: parsed.data.portfolioId,
      ticker: parsed.data.ticker.toUpperCase(),
      transactionType: parsed.data.transactionType,
      quantity: parsed.data.quantity ?? null,
      pricePerUnit: parsed.data.pricePerUnit,
      totalAmount: parsed.data.totalAmount,
      notes: parsed.data.notes ?? null,
      transactedAt: new Date(parsed.data.transactedAt),
    })
    .returning();

  res.status(201).json(CreateTransactionResponse.parse(transaction));
});

// GET /transactions/:id — get a transaction
router.get("/transactions/:id", async (req, res): Promise<void> => {
  const params = GetTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [transaction] = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.id, params.data.id));

  if (!transaction) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  res.json(GetTransactionResponse.parse(transaction));
});

export default router;
