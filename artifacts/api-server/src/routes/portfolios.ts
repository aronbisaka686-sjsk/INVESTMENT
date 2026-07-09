import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, portfoliosTable } from "@workspace/db";
import {
  ListPortfoliosQueryParams,
  ListPortfoliosResponse,
  CreatePortfolioBody,
  CreatePortfolioResponse,
  GetPortfolioParams,
  GetPortfolioResponse,
  UpdatePortfolioParams,
  UpdatePortfolioBody,
  UpdatePortfolioResponse,
  DeletePortfolioParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /portfolios — list portfolios (optionally filtered by accountId)
router.get("/portfolios", async (req, res): Promise<void> => {
  const query = ListPortfoliosQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { accountId } = query.data;

  const portfolios = await db
    .select()
    .from(portfoliosTable)
    .where(accountId ? eq(portfoliosTable.accountId, accountId) : undefined)
    .orderBy(portfoliosTable.createdAt);

  res.json(ListPortfoliosResponse.parse(portfolios));
});

// POST /portfolios — create a portfolio
router.post("/portfolios", async (req, res): Promise<void> => {
  const parsed = CreatePortfolioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [portfolio] = await db
    .insert(portfoliosTable)
    .values({
      accountId: parsed.data.accountId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .returning();

  res.status(201).json(CreatePortfolioResponse.parse(portfolio));
});

// GET /portfolios/:id — get a portfolio
router.get("/portfolios/:id", async (req, res): Promise<void> => {
  const params = GetPortfolioParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [portfolio] = await db
    .select()
    .from(portfoliosTable)
    .where(eq(portfoliosTable.id, params.data.id));

  if (!portfolio) {
    res.status(404).json({ error: "Portfolio not found" });
    return;
  }

  res.json(GetPortfolioResponse.parse(portfolio));
});

// PATCH /portfolios/:id — update a portfolio
router.patch("/portfolios/:id", async (req, res): Promise<void> => {
  const params = UpdatePortfolioParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePortfolioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "No fields provided to update" });
    return;
  }

  const [portfolio] = await db
    .update(portfoliosTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(portfoliosTable.id, params.data.id))
    .returning();

  if (!portfolio) {
    res.status(404).json({ error: "Portfolio not found" });
    return;
  }

  res.json(UpdatePortfolioResponse.parse(portfolio));
});

// DELETE /portfolios/:id — delete a portfolio
router.delete("/portfolios/:id", async (req, res): Promise<void> => {
  const params = DeletePortfolioParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(portfoliosTable)
    .where(eq(portfoliosTable.id, params.data.id))
    .returning({ id: portfoliosTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Portfolio not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
