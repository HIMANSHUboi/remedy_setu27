import { z } from "zod";
import { authenticateBearerRequest } from "@/integrations/supabase/auth-middleware";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import {
  getActiveConnectorsSummary,
  getFallbackCatalog,
  runAnalyzeCustomerMessage,
  runCheckProductStockAvailability,
  runDeleteSavedLead,
  runFulfillLeadOrder,
  runGenerateWorkspaceInsights,
  runGetWorkspaceData,
  runUpdateProductStock,
  runUpdateSavedLead,
} from "@/lib/remedy.functions";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export async function handleApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  if (!pathname.startsWith("/api/")) {
    return null;
  }

  const method = request.method.toUpperCase();

  // 1. Health & Backend Connectors Status
  if ((pathname === "/api/health" || pathname === "/api/connectors") && method === "GET") {
    const hasSupabaseEnv = Boolean(
      process.env["SUPABASE_URL"] && process.env["SUPABASE_PUBLISHABLE_KEY"],
    );
    return jsonResponse({
      status: "ok",
      service: "remedy-setu-api",
      timestamp: new Date().toISOString(),
      connectors: getActiveConnectorsSummary(hasSupabaseEnv),
      endpoints: [
        "GET /api/health",
        "GET /api/connectors",
        "GET /api/products",
        "PATCH /api/products/:id",
        "POST /api/stock-check",
        "POST /api/analyze",
        "GET /api/insights",
        "GET /api/leads",
        "PATCH /api/leads/:id",
        "POST /api/leads/:id/fulfill",
        "DELETE /api/leads/:id",
        "GET /api/whatsapp/webhook",
        "POST /api/whatsapp/webhook",
        "POST /api/cron/digest",
      ],
    });
  }

  // 2. Meta WhatsApp Cloud API Webhook (Verification & Inbound Messages)
  if (pathname === "/api/whatsapp/webhook") {
    if (method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      const expectedToken = process.env["WHATSAPP_VERIFY_TOKEN"] ?? "remedy_setu_verify";

      if (mode === "subscribe" && token === expectedToken && challenge) {
        return new Response(challenge, {
          status: 200,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
      return jsonResponse({ error: "Webhook verification failed" }, 403);
    }

    if (method === "POST") {
      try {
        const payload = (await request.json()) as {
          entry?: Array<{
            changes?: Array<{
              value?: {
                messages?: Array<{
                  from?: string;
                  text?: { body?: string };
                }>;
              };
            }>;
          }>;
        };
        const incomingText =
          payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body?.trim();
        if (!incomingText) {
          return jsonResponse({ received: true, processed: false });
        }

        const auth = await authenticateBearerRequest(request).catch(() => null);
        if (!auth) {
          return jsonResponse({ error: "Unauthorized webhook caller" }, 401);
        }

        const result = await runAnalyzeCustomerMessage(auth.supabase, auth.userId, incomingText);
        return jsonResponse({ received: true, processed: true, ...result }, 201);
      } catch {
        return jsonResponse({ error: "Invalid webhook payload" }, 400);
      }
    }
  }

  // 3. Scheduled Cron Digest Endpoint
  if (pathname === "/api/cron/digest" && method === "POST") {
    const authFailure = await authenticateCronRequest(request);
    if (authFailure) return authFailure;

    return jsonResponse({
      status: "ok",
      checkedAt: new Date().toISOString(),
      catalogCount: getFallbackCatalog().length,
    });
  }

  // 4. Authenticated Workspace Endpoints (/api/products, /api/stock-check, /api/analyze, /api/insights, /api/leads)
  let authContext: Awaited<ReturnType<typeof authenticateBearerRequest>>;
  try {
    authContext = await authenticateBearerRequest(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return jsonResponse({ error: message }, 401);
  }

  if (pathname === "/api/products" && method === "GET") {
    const workspace = await runGetWorkspaceData(authContext.supabase, authContext.userId);
    const category = url.searchParams.get("category");
    const inStockParam = url.searchParams.get("in_stock");
    const filtered = workspace.products.filter((product) => {
      if (category && product.category !== category) return false;
      if (inStockParam === "true" && !product.in_stock) return false;
      if (inStockParam === "false" && product.in_stock) return false;
      return true;
    });
    return jsonResponse({ products: filtered });
  }

  if (pathname.startsWith("/api/products/") && method === "PATCH") {
    const productId = pathname.slice("/api/products/".length);
    try {
      const body = z
        .object({
          inStock: z.boolean().optional(),
          stockQuantity: z.number().int().min(0).max(100000).optional(),
        })
        .refine((val) => val.inStock !== undefined || val.stockQuantity !== undefined)
        .parse(await request.json());
      const product = await runUpdateProductStock(authContext.supabase, productId, {
        ...(body.inStock !== undefined ? { inStock: body.inStock } : {}),
        ...(body.stockQuantity !== undefined ? { stockQuantity: body.stockQuantity } : {}),
      });
      return jsonResponse({ product });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid request";
      return jsonResponse({ error: message }, 400);
    }
  }

  if (pathname === "/api/stock-check" && method === "POST") {
    try {
      const body = z
        .object({
          productId: z.string().uuid(),
          quantity: z.number().int().min(1).max(100000),
        })
        .parse(await request.json());
      const check = await runCheckProductStockAvailability(
        authContext.supabase,
        body.productId,
        body.quantity,
      );
      return jsonResponse({ stockCheck: check });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid stock check request";
      return jsonResponse({ error: message }, 400);
    }
  }

  if (pathname === "/api/insights" && method === "GET") {
    try {
      const insights = await runGenerateWorkspaceInsights(authContext.supabase, authContext.userId);
      return jsonResponse({ insights });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate insights";
      return jsonResponse({ error: message }, 500);
    }
  }

  if (pathname === "/api/analyze" && method === "POST") {
    try {
      const body = z
        .object({ message: z.string().trim().min(1).max(4000) })
        .parse(await request.json());
      const result = await runAnalyzeCustomerMessage(
        authContext.supabase,
        authContext.userId,
        body.message,
      );
      return jsonResponse(result, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid request";
      return jsonResponse({ error: message }, 400);
    }
  }

  if (pathname === "/api/leads" && method === "GET") {
    const workspace = await runGetWorkspaceData(authContext.supabase, authContext.userId);
    const intent = url.searchParams.get("intent");
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search")?.trim().toLocaleLowerCase();

    const leads = workspace.leads.filter((lead) => {
      if (intent && intent !== "ALL" && lead.intent !== intent) return false;
      if (status && status !== "ALL" && lead.status !== status) return false;
      if (
        search &&
        !`${lead.customer_message} ${lead.matched_product?.name ?? ""} ${lead.suggested_reply}`
          .toLocaleLowerCase()
          .includes(search)
      ) {
        return false;
      }
      return true;
    });
    return jsonResponse({ leads });
  }

  if (pathname.startsWith("/api/leads/")) {
    const subPath = pathname.slice("/api/leads/".length);
    if (subPath.endsWith("/fulfill") && method === "POST") {
      const leadId = subPath.slice(0, -"/fulfill".length);
      const idCheck = z.string().uuid().safeParse(leadId);
      if (!idCheck.success) {
        return jsonResponse({ error: "Invalid lead ID" }, 400);
      }
      try {
        const fulfilled = await runFulfillLeadOrder(
          authContext.supabase,
          authContext.userId,
          idCheck.data,
        );
        return jsonResponse(fulfilled);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fulfill lead order";
        return jsonResponse({ error: message }, 400);
      }
    }

    const idCheck = z.string().uuid().safeParse(subPath);
    if (!idCheck.success) {
      return jsonResponse({ error: "Invalid lead ID" }, 400);
    }

    if (method === "PATCH") {
      try {
        const body = z
          .object({
            status: z.enum(["NEW", "REPLIED", "CONVERTED"]).optional(),
            suggestedReply: z.string().max(4000).optional(),
          })
          .refine((val) => val.status !== undefined || val.suggestedReply !== undefined)
          .parse(await request.json());
        const lead = await runUpdateSavedLead(authContext.supabase, authContext.userId, {
          id: idCheck.data,
          ...body,
        });
        return jsonResponse({ lead });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update lead";
        return jsonResponse({ error: message }, 400);
      }
    }

    if (method === "DELETE") {
      try {
        const result = await runDeleteSavedLead(
          authContext.supabase,
          authContext.userId,
          idCheck.data,
        );
        return jsonResponse(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete lead";
        return jsonResponse({ error: message }, 404);
      }
    }
  }

  return jsonResponse({ error: `Not found: ${method} ${pathname}` }, 404);
}
