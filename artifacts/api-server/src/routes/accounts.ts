import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, accountsTable } from "@workspace/db";
import {
  CreateAccountBody,
  CreateAccountResponse,
  GetAccountParams,
  GetAccountResponse,
  UpdateAccountParams,
  UpdateAccountBody,
  UpdateAccountResponse,
  DeleteAccountParams,
  ListAccountsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /accounts — list all accounts
router.get("/accounts", async (_req, res): Promise<void> => {
  const accounts = await db
    .select()
    .from(accountsTable)
    .orderBy(accountsTable.createdAt);
  res.json(ListAccountsResponse.parse(accounts));
});

// POST /accounts — create a new account
router.post("/accounts", async (req, res): Promise<void> => {
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Check for duplicate email
  const [existing] = await db
    .select({ id: accountsTable.id })
    .from(accountsTable)
    .where(eq(accountsTable.email, parsed.data.email));

  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const [account] = await db
    .insert(accountsTable)
    .values({ email: parsed.data.email, fullName: parsed.data.fullName })
    .returning();

  res.status(201).json(CreateAccountResponse.parse(account));
});

// GET /accounts/:id — get a single account
router.get("/accounts/:id", async (req, res): Promise<void> => {
  const params = GetAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.id, params.data.id));

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  res.json(GetAccountResponse.parse(account));
});

// PATCH /accounts/:id — update an account
router.patch("/accounts/:id", async (req, res): Promise<void> => {
  const params = UpdateAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "No fields provided to update" });
    return;
  }

  const [account] = await db
    .update(accountsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(accountsTable.id, params.data.id))
    .returning();

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  res.json(UpdateAccountResponse.parse(account));
});

// DELETE /accounts/:id — delete an account
router.delete("/accounts/:id", async (req, res): Promise<void> => {
  const params = DeleteAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(accountsTable)
    .where(eq(accountsTable.id, params.data.id))
    .returning({ id: accountsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
