import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, holdingsTable } from "@workspace/db";
import {
  ListHoldingsQueryParams,
  ListHoldingsResponse,
  CreateHoldingBody,
  CreateHoldingResponse,
  GetHoldingParams,
  GetHoldingResponse,
  UpdateHoldingParams,
  UpdateHoldingBody,
  UpdateHoldingResponse,
  DeleteHoldingParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /holdings — list holdings (optionally filtered by portfolioId)
router.get("/holdings", async (req, res): Promise<void> => {
  const query = ListHoldingsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { portfolioId } = query.data;

  const holdings = await db
    .select()
    .from(holdingsTable)
    .where(portfolioId ? eq(holdingsTable.portfolioId, portfolioId) : undefined)
    .orderBy(holdingsTable.ticker);

  res.json(ListHoldingsResponse.parse(holdings));
});

// POST /holdings — add a holding to a portfolio
router.post("/holdings", async (req, res): Promise<void> => {
  const parsed = CreateHoldingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [holding] = await db
    .insert(holdingsTable)
    .values({
      portfolioId: parsed.data.portfolioId,
      ticker: parsed.data.ticker.toUpperCase(),
      assetType: parsed.data.assetType,
      quantity: parsed.data.quantity,
      avgCostBasis: parsed.data.avgCostBasis ?? null,
    })
    .returning();

  res.status(201).json(CreateHoldingResponse.parse(holding));
});

// GET /holdings/:id — get a holding
router.get("/holdings/:id", async (req, res): Promise<void> => {
  const params = GetHoldingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [holding] = await db
    .select()
    .from(holdingsTable)
    .where(eq(holdingsTable.id, params.data.id));

  if (!holding) {
    res.status(404).json({ error: "Holding not found" });
    return;
  }

  res.json(GetHoldingResponse.parse(holding));
});

// PATCH /holdings/:id — update a holding
router.patch("/holdings/:id", async (req, res): Promise<void> => {
  const params = UpdateHoldingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateHoldingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (
    parsed.data.quantity === undefined &&
    parsed.data.avgCostBasis === undefined
  ) {
    res.status(400).json({ error: "No fields provided to update" });
    return;
  }

  const [holding] = await db
    .update(holdingsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(holdingsTable.id, params.data.id))
    .returning();

  if (!holding) {
    res.status(404).json({ error: "Holding not found" });
    return;
  }

  res.json(UpdateHoldingResponse.parse(holding));
});

// DELETE /holdings/:id — remove a holding
router.delete("/holdings/:id", async (req, res): Promise<void> => {
  const params = DeleteHoldingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(holdingsTable)
    .where(eq(holdingsTable.id, params.data.id))
    .returning({ id: holdingsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Holding not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
