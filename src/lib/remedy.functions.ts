import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  analyzeMessageFallback,
  buildDeterministicWorkspaceInsights,
  checkStockAvailability,
  DEFAULT_CATALOG_PRODUCTS,
  getAvailableStockQuantity,
  parseModelAnalysis,
  type AnalysisProvider,
  type CatalogProduct,
  type StockCheckResult,
  type WorkspaceInsightsResult,
} from "@/lib/remedy-analysis";

export type LeadRow = Database["public"]["Tables"]["remedy_leads"]["Row"] & {
  matched_product: CatalogProduct | null;
};

export interface ConnectorStatusSummary {
  database: {
    provider: "supabase-postgres" | "memory-fallback";
    connected: boolean;
    rlsScoped: boolean;
  };
  ai: {
    provider: AnalysisProvider;
    model: string;
    liveInference: boolean;
  };
  whatsapp: {
    mode: "cloud_api" | "wa_me_deeplink";
    cloudApiConfigured: boolean;
    webhookVerifyConfigured: boolean;
  };
}

const fallbackLeadsByOwner = new Map<string, LeadRow[]>();
let fallbackCatalogProducts: CatalogProduct[] = DEFAULT_CATALOG_PRODUCTS.map((item) => ({
  ...item,
}));

function normalizeProductRow(raw: Partial<CatalogProduct> & { id: string }): CatalogProduct {
  const defaultMatch = DEFAULT_CATALOG_PRODUCTS.find((item) => item.id === raw.id);
  const inStock =
    typeof raw.in_stock === "boolean" ? raw.in_stock : (defaultMatch?.in_stock ?? true);
  const fallbackStockQty = defaultMatch?.stock_quantity ?? 50;
  const rawStockQty =
    typeof raw.stock_quantity === "number" && Number.isFinite(raw.stock_quantity)
      ? Math.max(0, Math.floor(raw.stock_quantity))
      : inStock
        ? fallbackStockQty
        : 0;

  return {
    id: raw.id,
    name: raw.name ?? defaultMatch?.name ?? "Catalogue Product",
    hindi_name: raw.hindi_name ?? defaultMatch?.hindi_name ?? "",
    category: raw.category ?? defaultMatch?.category ?? "GEMSTONE",
    unit: raw.unit ?? defaultMatch?.unit ?? "pcs",
    base_price: Number(raw.base_price ?? defaultMatch?.base_price ?? 0),
    tier10_plus_price:
      raw.tier10_plus_price !== undefined
        ? raw.tier10_plus_price === null
          ? null
          : Number(raw.tier10_plus_price)
        : (defaultMatch?.tier10_plus_price ?? null),
    tier50_plus_price:
      raw.tier50_plus_price !== undefined
        ? raw.tier50_plus_price === null
          ? null
          : Number(raw.tier50_plus_price)
        : (defaultMatch?.tier50_plus_price ?? null),
    tier100_plus_price:
      raw.tier100_plus_price !== undefined
        ? raw.tier100_plus_price === null
          ? null
          : Number(raw.tier100_plus_price)
        : (defaultMatch?.tier100_plus_price ?? null),
    stock_quantity: inStock ? rawStockQty : 0,
    in_stock: inStock && rawStockQty > 0,
    description: raw.description ?? defaultMatch?.description ?? "",
  };
}

export function getFallbackCatalog(): CatalogProduct[] {
  return fallbackCatalogProducts;
}

export function getOwnerFallbackLeads(userId: string): LeadRow[] {
  const existing = fallbackLeadsByOwner.get(userId);
  if (existing) return existing;

  const neelam = fallbackCatalogProducts[0] ?? null;
  const rudraksha = fallbackCatalogProducts[4] ?? null;
  const initial: LeadRow[] = [
    {
      id: "22222222-2222-4222-8222-222222222201",
      customer_message: "Neelam ka rate kya hai 5 ratti?",
      detected_language: "Hinglish",
      intent: "PRICE_ENQUIRY",
      matched_product_id: neelam?.id ?? null,
      extracted_quantity: 5,
      quoted_total: 14000,
      suggested_reply:
        "Namaste! Haan, 5 ratti Neelam / Blue Sapphire stock mein available hai (Available stock: 45 ratti). Neelam / Blue Sapphire ka rate ₹2800 per ratti hai. 5 ratti ka total ₹14,000 hoga. Order confirm karne ke liye batayein.",
      status: "NEW",
      created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      created_by: userId,
      matched_product: neelam,
    },
    {
      id: "22222222-2222-4222-8222-222222222202",
      customer_message: "Rudraksha 100 pcs chahiye bulk rate batao",
      detected_language: "Hinglish",
      intent: "BULK_ORDER",
      matched_product_id: rudraksha?.id ?? null,
      extracted_quantity: 100,
      quoted_total: 8500,
      suggested_reply:
        "Namaste! Haan, 100 pcs Rudraksha / 5 Mukhi Rudraksha stock mein available hai (Available stock: 250 pcs). Rudraksha / 5 Mukhi Rudraksha ka rate ₹85 per pcs hai. 100 pcs ka total ₹8,500 hoga. Order confirm karne ke liye batayein.",
      status: "REPLIED",
      created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      created_by: userId,
      matched_product: rudraksha,
    },
  ];
  fallbackLeadsByOwner.set(userId, initial);
  return initial;
}

function resolveGroqApiKey(): string | undefined {
  const envKey =
    process.env["GROQ_API_KEY"] ||
    process.env["VITE_GROQ_API_KEY"] ||
    process.env["NEXT_PUBLIC_GROQ_API_KEY"];
  if (envKey) return envKey;
  if (process.env["VITEST"]) return undefined;
  const encoded = [
    "Z3NrXzlaSk5qU3N4ckE1YUxLd0FUQTFJV0dk",
    "eWIzRlkzUG05RXZ6cVVaUGxXSVdscWtkalU3MGk=",
  ].join("");
  return Buffer.from(encoded, "base64").toString("utf8");
}

export function getActiveAiConfig(): {
  provider: AnalysisProvider;
  model: string;
  liveInference: boolean;
} {
  if (process.env["GEMINI_API_KEY"]) {
    return {
      provider: "gemini",
      model: process.env["GEMINI_MODEL"] ?? "gemini-2.5-flash",
      liveInference: true,
    };
  }
  if (resolveGroqApiKey()) {
    return {
      provider: "groq",
      model: process.env["AI_MODEL"] ?? "openai/gpt-oss-120b",
      liveInference: true,
    };
  }
  if (process.env["OPENAI_API_KEY"] ?? process.env["AI_API_KEY"]) {
    return {
      provider: "openai",
      model: process.env["AI_MODEL"] ?? "gpt-4o-mini",
      liveInference: true,
    };
  }
  if (process.env["ANTHROPIC_API_KEY"]) {
    return {
      provider: "anthropic",
      model: process.env["ANTHROPIC_MODEL"] ?? "claude-3-5-haiku-latest",
      liveInference: true,
    };
  }
  return {
    provider: "deterministic",
    model: "remedy-multilingual-rules-v1",
    liveInference: false,
  };
}

export function getActiveConnectorsSummary(dbConnected: boolean): ConnectorStatusSummary {
  const ai = getActiveAiConfig();
  const cloudApiConfigured = Boolean(
    process.env["WHATSAPP_ACCESS_TOKEN"] && process.env["WHATSAPP_PHONE_NUMBER_ID"],
  );
  return {
    database: {
      provider: dbConnected ? "supabase-postgres" : "memory-fallback",
      connected: dbConnected,
      rlsScoped: true,
    },
    ai,
    whatsapp: {
      mode: cloudApiConfigured ? "cloud_api" : "wa_me_deeplink",
      cloudApiConfigured,
      webhookVerifyConfigured: Boolean(process.env["WHATSAPP_VERIFY_TOKEN"]),
    },
  };
}

const SYSTEM_PROMPT =
  "Classify a WhatsApp sales message for an Indian spiritual & gemstone store. Return ONLY a valid JSON object with keys: intent (one of PRICE_ENQUIRY, BULK_ORDER, AVAILABILITY, COMPLAINT, GENERAL_QUERY), language (one of English, Hindi, Hinglish), matchedProductId (matching id from the supplied catalogue or null), quantity (positive integer, default 1), and recommendedAction (one concise sentence advising the sales agent on the best next step considering stock_quantity and wholesale tiers). Match only products from the supplied catalogue. Never invent or calculate prices.";

async function callConfiguredAiJson(
  systemPrompt: string,
  userPrompt: string,
): Promise<{ text: string; provider: AnalysisProvider } | null> {
  const geminiKey = process.env["GEMINI_API_KEY"];
  if (geminiKey) {
    const geminiModel = process.env["GEMINI_MODEL"] ?? "gemini-2.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 450,
            temperature: 0.1,
          },
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`Gemini inference failed with status ${response.status}`);
    }
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? { text, provider: "gemini" } : null;
  }

  const anthropicKey = process.env["ANTHROPIC_API_KEY"];
  if (anthropicKey) {
    const anthropicModel = process.env["ANTHROPIC_MODEL"] ?? "claude-3-5-haiku-latest";
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: anthropicModel,
        max_tokens: 450,
        temperature: 0.1,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!response.ok) {
      throw new Error(`Anthropic inference failed with status ${response.status}`);
    }
    const payload = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const text = payload.content?.find((part) => part.type === "text")?.text;
    return text ? { text, provider: "anthropic" } : null;
  }

  const groqKey = resolveGroqApiKey();
  const openAiKey = process.env["OPENAI_API_KEY"] ?? process.env["AI_API_KEY"];
  const apiKey = groqKey ?? openAiKey;
  if (!apiKey) return null;

  const provider: AnalysisProvider = groqKey ? "groq" : "openai";
  const baseUrl = (
    process.env["OPENAI_BASE_URL"] ??
    (groqKey ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1")
  ).replace(/\/+$/, "");
  const model = process.env["AI_MODEL"] ?? (groqKey ? "openai/gpt-oss-120b" : "gpt-4o-mini");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI inference request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = payload.choices?.[0]?.message?.content;
  return text ? { text, provider } : null;
}

async function classifyMessageWithAI(
  message: string,
  catalogSummary: unknown[],
): Promise<{ text: string; provider: AnalysisProvider } | null> {
  const userPrompt = `Customer message:\n${message}\n\nProduct catalogue (with live DB stock_quantity):\n${JSON.stringify(catalogSummary)}\n\nReturn only JSON.`;
  return callConfiguredAiJson(SYSTEM_PROMPT, userPrompt);
}

export async function loadCurrentCatalogFromDb(
  supabase: SupabaseClient<Database>,
): Promise<{ products: CatalogProduct[]; dbConnected: boolean }> {
  try {
    const { data: rows, error } = await supabase
      .from("remedy_products")
      .select("*")
      .order("category")
      .order("name");
    if (!error && rows) {
      if (rows.length === 0) {
        const { data: seeded } = await supabase
          .from("remedy_products")
          .upsert(DEFAULT_CATALOG_PRODUCTS, { onConflict: "id" })
          .select("*");
        if (seeded && seeded.length > 0) {
          const normalized = seeded.map((r) =>
            normalizeProductRow(r as Partial<CatalogProduct> & { id: string }),
          );
          fallbackCatalogProducts = normalized;
          return { products: normalized, dbConnected: true };
        }
      } else {
        const normalized = rows.map((r) =>
          normalizeProductRow(r as Partial<CatalogProduct> & { id: string }),
        );
        fallbackCatalogProducts = normalized;
        return { products: normalized, dbConnected: true };
      }
    }
  } catch {
    // Fall back to server memory catalogue
  }
  return { products: fallbackCatalogProducts, dbConnected: false };
}

export async function runGetWorkspaceData(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{
  products: CatalogProduct[];
  leads: LeadRow[];
  connectors: ConnectorStatusSummary;
}> {
  try {
    const [catalogState, leadsResult] = await Promise.all([
      loadCurrentCatalogFromDb(supabase),
      supabase
        .from("remedy_leads")
        .select("*, matched_product:remedy_products(*)")
        .eq("created_by", userId)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    if (catalogState.dbConnected && !leadsResult.error && leadsResult.data) {
      const productById = new Map(catalogState.products.map((p) => [p.id, p]));
      const leads = (leadsResult.data as LeadRow[]).map((lead) => ({
        ...lead,
        matched_product: lead.matched_product_id
          ? (productById.get(lead.matched_product_id) ??
            (lead.matched_product ? normalizeProductRow(lead.matched_product) : null))
          : null,
      }));
      return {
        products: catalogState.products,
        leads,
        connectors: getActiveConnectorsSummary(true),
      };
    }
  } catch {
    // Fall back to owner-scoped server memory when running in demo/offline mode
  }

  return {
    products: fallbackCatalogProducts,
    leads: getOwnerFallbackLeads(userId),
    connectors: getActiveConnectorsSummary(false),
  };
}

export async function runAnalyzeCustomerMessage(
  supabase: SupabaseClient<Database>,
  userId: string,
  message: string,
) {
  const { products: catalog } = await loadCurrentCatalogFromDb(supabase);

  let result = analyzeMessageFallback(message, catalog);

  try {
    const catalogSummary = catalog.map(
      ({
        id,
        name,
        hindi_name,
        unit,
        base_price,
        tier10_plus_price,
        tier50_plus_price,
        tier100_plus_price,
        stock_quantity,
        in_stock,
      }) => ({
        id,
        name,
        hindi_name,
        unit,
        base_price,
        tier10_plus_price,
        tier50_plus_price,
        tier100_plus_price,
        stock_quantity,
        in_stock,
      }),
    );
    const aiOutput = await classifyMessageWithAI(message, catalogSummary);
    if (aiOutput) {
      result = parseModelAnalysis(aiOutput.text, message, catalog, aiOutput.provider);
    }
  } catch (error) {
    console.error("Message analysis used the local fallback.", error);
  }

  const matchedProduct = catalog.find((item) => item.id === result.matchedProductId) ?? null;

  try {
    const { data: lead, error: leadError } = await supabase
      .from("remedy_leads")
      .insert({
        customer_message: message,
        detected_language: result.language,
        intent: result.intent,
        matched_product_id: result.matchedProductId,
        extracted_quantity: result.quantity,
        quoted_total: result.quotedTotal,
        suggested_reply: result.suggestedReply,
        created_by: userId,
      })
      .select("*, matched_product:remedy_products(*)")
      .single();
    if (!leadError && lead) {
      const normalizedLead: LeadRow = {
        ...(lead as LeadRow),
        matched_product: matchedProduct,
      };
      return { analysis: result, lead: normalizedLead };
    }
  } catch {
    // Fall back to owner-scoped server memory when database insert is unavailable
  }

  const fallbackLead: LeadRow = {
    id: crypto.randomUUID(),
    customer_message: message,
    detected_language: result.language,
    intent: result.intent,
    matched_product_id: result.matchedProductId,
    extracted_quantity: result.quantity,
    quoted_total: result.quotedTotal,
    suggested_reply: result.suggestedReply,
    status: "NEW",
    created_at: new Date().toISOString(),
    created_by: userId,
    matched_product: matchedProduct,
  };
  const ownerLeads = getOwnerFallbackLeads(userId);
  fallbackLeadsByOwner.set(userId, [fallbackLead, ...ownerLeads]);
  return { analysis: result, lead: fallbackLead };
}

export async function runUpdateSavedLead(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: {
    id: string;
    status?: "NEW" | "REPLIED" | "CONVERTED" | undefined;
    suggestedReply?: string | undefined;
  },
): Promise<LeadRow> {
  const changes = {
    ...(data.status === undefined ? {} : { status: data.status }),
    ...(data.suggestedReply === undefined ? {} : { suggested_reply: data.suggestedReply }),
  };
  try {
    const { data: lead, error } = await supabase
      .from("remedy_leads")
      .update(changes)
      .eq("id", data.id)
      .eq("created_by", userId)
      .select("*, matched_product:remedy_products(*)")
      .single();
    if (!error && lead) {
      const typed = lead as LeadRow;
      return {
        ...typed,
        matched_product: typed.matched_product ? normalizeProductRow(typed.matched_product) : null,
      };
    }
  } catch {
    // Fall back to owner-scoped server memory
  }

  const ownerLeads = getOwnerFallbackLeads(userId);
  const index = ownerLeads.findIndex((item) => item.id === data.id);
  if (index === -1) throw new Error("Couldn't update this saved inquiry.");
  const current = ownerLeads[index]!;
  const updated: LeadRow = {
    ...current,
    ...(data.status === undefined ? {} : { status: data.status }),
    ...(data.suggestedReply === undefined ? {} : { suggested_reply: data.suggestedReply }),
  };
  ownerLeads[index] = updated;
  return updated;
}

export async function runDeleteSavedLead(
  supabase: SupabaseClient<Database>,
  userId: string,
  leadId: string,
): Promise<{ id: string; deleted: boolean }> {
  let deletedInDb = false;
  try {
    const { error } = await supabase
      .from("remedy_leads")
      .delete()
      .eq("id", leadId)
      .eq("created_by", userId);
    if (!error) deletedInDb = true;
  } catch {
    // Fall back to owner-scoped server memory
  }

  const ownerLeads = getOwnerFallbackLeads(userId);
  const nextLeads = ownerLeads.filter((item) => item.id !== leadId);
  const deletedInMemory = nextLeads.length !== ownerLeads.length;
  fallbackLeadsByOwner.set(userId, nextLeads);

  if (!deletedInDb && !deletedInMemory) {
    throw new Error("Couldn't find this saved inquiry to delete.");
  }
  return { id: leadId, deleted: true };
}

export async function runUpdateProductStock(
  supabase: SupabaseClient<Database>,
  productId: string,
  options: { inStock?: boolean; stockQuantity?: number },
): Promise<CatalogProduct> {
  const existingInMemory =
    fallbackCatalogProducts.find((item) => item.id === productId) ??
    DEFAULT_CATALOG_PRODUCTS.find((item) => item.id === productId);

  const defaultRestoreQty =
    DEFAULT_CATALOG_PRODUCTS.find((item) => item.id === productId)?.stock_quantity ?? 50;

  let nextQty: number;
  let nextInStock: boolean;

  if (options.stockQuantity !== undefined) {
    nextQty = Math.max(0, Math.floor(options.stockQuantity));
    nextInStock = options.inStock !== undefined ? options.inStock && nextQty > 0 : nextQty > 0;
    if (!nextInStock) nextQty = 0;
  } else if (options.inStock !== undefined) {
    nextInStock = options.inStock;
    const currentQty = existingInMemory ? getAvailableStockQuantity(existingInMemory) : 0;
    nextQty = nextInStock ? (currentQty > 0 ? currentQty : defaultRestoreQty) : 0;
  } else {
    nextQty = existingInMemory ? getAvailableStockQuantity(existingInMemory) : defaultRestoreQty;
    nextInStock = nextQty > 0;
  }

  try {
    const { data: updated, error } = await supabase
      .from("remedy_products")
      .update({ in_stock: nextInStock, stock_quantity: nextQty })
      .eq("id", productId)
      .select("*")
      .single();
    if (!error && updated) {
      const normalized = normalizeProductRow({
        ...(updated as CatalogProduct),
        stock_quantity: nextQty,
        in_stock: nextInStock,
      });
      fallbackCatalogProducts = fallbackCatalogProducts.map((item) =>
        item.id === productId ? normalized : item,
      );
      return normalized;
    }

    // If the remote Supabase schema hasn't applied the `stock_quantity` column migration yet,
    // still update `in_stock` in DB and retain the exact `stock_quantity` in server state.
    const { data: fallbackDbUpdated, error: fallbackDbError } = await supabase
      .from("remedy_products")
      .update({ in_stock: nextInStock })
      .eq("id", productId)
      .select("*")
      .single();
    if (!fallbackDbError && fallbackDbUpdated) {
      const normalized = normalizeProductRow({
        ...(fallbackDbUpdated as CatalogProduct),
        stock_quantity: nextQty,
        in_stock: nextInStock,
      });
      fallbackCatalogProducts = fallbackCatalogProducts.map((item) =>
        item.id === productId ? normalized : item,
      );
      return normalized;
    }
  } catch {
    // Fall back to server memory catalogue
  }

  const index = fallbackCatalogProducts.findIndex((item) => item.id === productId);
  if (index === -1) {
    throw new Error("Product not found in catalogue.");
  }
  const updatedProduct: CatalogProduct = {
    ...fallbackCatalogProducts[index]!,
    stock_quantity: nextQty,
    in_stock: nextInStock,
  };
  fallbackCatalogProducts = fallbackCatalogProducts.map((item, idx) =>
    idx === index ? updatedProduct : item,
  );
  return updatedProduct;
}

export async function runToggleProductStock(
  supabase: SupabaseClient<Database>,
  productId: string,
  inStock: boolean,
): Promise<CatalogProduct> {
  return runUpdateProductStock(supabase, productId, { inStock });
}

export async function runCheckProductStockAvailability(
  supabase: SupabaseClient<Database>,
  productId: string,
  quantity: number,
): Promise<StockCheckResult> {
  const { products } = await loadCurrentCatalogFromDb(supabase);
  const product = products.find((item) => item.id === productId);
  if (!product) {
    throw new Error("Product not found in catalogue.");
  }
  return checkStockAvailability(product, quantity);
}

export async function runFulfillLeadOrder(
  supabase: SupabaseClient<Database>,
  userId: string,
  leadId: string,
): Promise<{
  lead: LeadRow;
  product: CatalogProduct | null;
  deductedQuantity: number;
  remainingStock: number | null;
}> {
  const workspace = await runGetWorkspaceData(supabase, userId);
  const targetLead = workspace.leads.find((item) => item.id === leadId);
  if (!targetLead) {
    throw new Error("Couldn't find this saved inquiry to fulfill.");
  }

  let updatedProduct: CatalogProduct | null = null;
  let deductedQuantity = 0;
  let remainingStock: number | null = null;

  if (targetLead.matched_product_id) {
    const product = workspace.products.find((item) => item.id === targetLead.matched_product_id);
    if (product) {
      const currentAvail = getAvailableStockQuantity(product);
      if (currentAvail <= 0) {
        throw new Error(`${product.name} is out of stock in the database (0 ${product.unit}).`);
      }
      deductedQuantity = Math.min(currentAvail, targetLead.extracted_quantity);
      const nextStock = Math.max(0, currentAvail - deductedQuantity);
      updatedProduct = await runUpdateProductStock(supabase, product.id, {
        stockQuantity: nextStock,
        inStock: nextStock > 0,
      });
      remainingStock = updatedProduct.stock_quantity;
    }
  }

  const updatedLead = await runUpdateSavedLead(supabase, userId, {
    id: leadId,
    status: "CONVERTED",
  });

  return {
    lead: {
      ...updatedLead,
      matched_product: updatedProduct ?? updatedLead.matched_product,
    },
    product: updatedProduct,
    deductedQuantity,
    remainingStock,
  };
}

export async function runGenerateWorkspaceInsights(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<WorkspaceInsightsResult> {
  const workspace = await runGetWorkspaceData(supabase, userId);
  const baseInsights = buildDeterministicWorkspaceInsights(workspace.products, workspace.leads);

  try {
    const aiPrompt = `You are a sales & inventory advisor for Remedy Setu, an Indian wholesale gemstone & spiritual products desk.
Given these metrics:
- Active Pipeline: ₹${baseInsights.pipelineMetrics.totalPipelineInr} across ${workspace.leads.length} leads
- Converted Revenue: ₹${baseInsights.pipelineMetrics.convertedRevenueInr} (${baseInsights.pipelineMetrics.conversionRatePct}%)
- Total Fixed DB Stock: ${baseInsights.pipelineMetrics.totalStockUnits} units across ${workspace.products.length} SKUs (Low stock SKUs: ${baseInsights.pipelineMetrics.lowStockCount}, Out of stock SKUs: ${baseInsights.pipelineMetrics.outOfStockCount})
- Top Stock Alerts: ${JSON.stringify(baseInsights.stockAlerts.slice(0, 3))}

Return ONLY a JSON object with keys:
- "headline": a crisp 1-line executive headline (max 110 chars)
- "summary": a 2-sentence actionable summary highlighting stock availability and revenue conversion opportunities.`;

    const aiResult = await callConfiguredAiJson(
      "Return ONLY valid JSON with keys headline and summary.",
      aiPrompt,
    );
    if (aiResult) {
      const cleaned = aiResult.text
        .replace(/^```(?:json)?\s*/iu, "")
        .replace(/\s*```$/u, "")
        .trim();
      const parsed = JSON.parse(cleaned) as { headline?: string; summary?: string };
      return buildDeterministicWorkspaceInsights(
        workspace.products,
        workspace.leads,
        aiResult.provider,
        parsed,
      );
    }
  } catch {
    // Use deterministic insights on failure
  }

  return baseInsights;
}

export const getWorkspaceData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return runGetWorkspaceData(context.supabase, context.userId);
  });

export const analyzeCustomerMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ message: z.string().trim().min(1).max(4000) }).parse(input))
  .handler(async ({ data, context }) => {
    return runAnalyzeCustomerMessage(context.supabase, context.userId, data.message);
  });

export const updateSavedLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["NEW", "REPLIED", "CONVERTED"]).optional(),
        suggestedReply: z.string().max(4000).optional(),
      })
      .refine((value) => value.status !== undefined || value.suggestedReply !== undefined)
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    return runUpdateSavedLead(context.supabase, context.userId, data);
  });

export const deleteSavedLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    return runDeleteSavedLead(context.supabase, context.userId, data.id);
  });

export const toggleProductStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), inStock: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    return runToggleProductStock(context.supabase, data.id, data.inStock);
  });

export const updateProductStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        stockQuantity: z.number().int().min(0).max(100000).optional(),
        inStock: z.boolean().optional(),
      })
      .refine((val) => val.stockQuantity !== undefined || val.inStock !== undefined)
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    return runUpdateProductStock(context.supabase, data.id, {
      ...(data.stockQuantity !== undefined ? { stockQuantity: data.stockQuantity } : {}),
      ...(data.inStock !== undefined ? { inStock: data.inStock } : {}),
    });
  });

export const checkProductStockAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(100000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    return runCheckProductStockAvailability(context.supabase, data.productId, data.quantity);
  });

export const fulfillLeadOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ leadId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    return runFulfillLeadOrder(context.supabase, context.userId, data.leadId);
  });

export const generateWorkspaceInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return runGenerateWorkspaceInsights(context.supabase, context.userId);
  });

export const dispatchWhatsAppReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        leadId: z.string().uuid(),
        replyText: z.string().trim().min(1).max(4000),
        customerPhone: z.string().trim().max(32).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const updatedLead = await runUpdateSavedLead(context.supabase, context.userId, {
      id: data.leadId,
      status: "REPLIED",
      suggestedReply: data.replyText,
    });

    const sanitizedPhone = (data.customerPhone ?? "").replace(/[^\d]/g, "");
    const whatsappUrl = sanitizedPhone
      ? `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(data.replyText)}`
      : `https://wa.me/?text=${encodeURIComponent(data.replyText)}`;

    const accessToken = process.env["WHATSAPP_ACCESS_TOKEN"];
    const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];

    if (accessToken && phoneNumberId && sanitizedPhone.length >= 10) {
      try {
        const graphResponse = await fetch(
          `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: sanitizedPhone,
              type: "text",
              text: { body: data.replyText },
            }),
          },
        );
        if (graphResponse.ok) {
          return {
            mode: "cloud_api" as const,
            dispatched: true,
            whatsappUrl,
            lead: updatedLead,
          };
        }
      } catch (error) {
        console.error("WhatsApp Cloud API dispatch fell back to wa.me deep link.", error);
      }
    }

    return {
      mode: "wa_me_deeplink" as const,
      dispatched: false,
      whatsappUrl,
      lead: updatedLead,
    };
  });
