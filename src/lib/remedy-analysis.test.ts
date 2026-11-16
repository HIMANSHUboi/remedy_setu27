import { describe, expect, it } from "vitest";

import { createDemoAgentToken } from "@/integrations/supabase/auth-attacher";
import { handleApiRequest } from "./api-router.server";
import {
  analyzeMessageFallback,
  DEFAULT_CATALOG_PRODUCTS,
  getTierRate,
  parseModelAnalysis,
  type CatalogProduct,
} from "./remedy-analysis";

const product: CatalogProduct = {
  id: "neelam-id",
  name: "Neelam / Blue Sapphire",
  hindi_name: "नीलम",
  category: "GEMSTONE",
  unit: "ratti",
  base_price: 2800,
  tier10_plus_price: 2500,
  tier50_plus_price: 2200,
  tier100_plus_price: 1950,
  in_stock: true,
  description: "Certified blue sapphire.",
};

describe("Remedy Setu price tiers", () => {
  it("uses the base rate below 10 units", () => expect(getTierRate(product, 9)).toBe(2800));
  it("applies the 10+ rate starting at 10 units", () =>
    expect(getTierRate(product, 10)).toBe(2500));
  it("keeps the 10+ rate through 49 units", () => expect(getTierRate(product, 49)).toBe(2500));
  it("applies the 50+ rate starting at 50 units", () =>
    expect(getTierRate(product, 50)).toBe(2200));
  it("keeps the 50+ rate through 99 units", () => expect(getTierRate(product, 99)).toBe(2200));
  it("applies the 100+ rate starting at 100 units", () =>
    expect(getTierRate(product, 100)).toBe(1950));
});

describe("message analysis fallback", () => {
  it("matches the sample Hinglish Neelam request and calculates its exact quote", () => {
    const result = analyzeMessageFallback("Neelam ka rate kya hai 5 ratti?", [product]);
    expect(result).toMatchObject({
      intent: "PRICE_ENQUIRY",
      language: "Hinglish",
      matchedProductId: "neelam-id",
      quantity: 5,
      unitRate: 2800,
      quotedTotal: 14000,
    });
    expect(result.suggestedReply).toContain("₹14,000");
  });

  it("matches bulk Rudraksha orders against the full catalogue and applies 100+ tier pricing", () => {
    const result = analyzeMessageFallback(
      "Rudraksha 100 pcs chahiye bulk rate batao",
      DEFAULT_CATALOG_PRODUCTS,
    );
    expect(result).toMatchObject({
      intent: "BULK_ORDER",
      language: "Hinglish",
      matchedProductId: "11111111-1111-4111-8111-111111111105",
      quantity: 100,
      unitRate: 85,
      quotedTotal: 8500,
    });
    expect(result.suggestedReply).toContain("₹8,500");
  });

  it("disambiguates 7 Mukhi Rudraksha from 5 Mukhi Rudraksha by specificity", () => {
    const result = analyzeMessageFallback(
      "7 Mukhi Rudraksha 10 pcs ka rate batao",
      DEFAULT_CATALOG_PRODUCTS,
    );
    expect(result).toMatchObject({
      intent: "BULK_ORDER",
      language: "Hinglish",
      matchedProductId: "11111111-1111-4111-8111-111111111106",
      quantity: 10,
      unitRate: 540,
      quotedTotal: 5400,
    });
  });

  it("extracts Devanagari Hindi units and generates a Hindi reply", () => {
    const result = analyzeMessageFallback(
      "नीलम 10 रत्ती का भाव क्या है?",
      DEFAULT_CATALOG_PRODUCTS,
    );
    expect(result).toMatchObject({
      intent: "BULK_ORDER",
      language: "Hindi",
      matchedProductId: "11111111-1111-4111-8111-111111111101",
      quantity: 10,
      unitRate: 2500,
      quotedTotal: 25000,
    });
    expect(result.suggestedReply).toContain("₹25,000");
  });

  it("classifies English stock availability inquiries without misclassifying decimals as bulk", () => {
    const result = analyzeMessageFallback(
      "Do you have certified Yellow Sapphire 6.25 ratti in stock?",
      DEFAULT_CATALOG_PRODUCTS,
    );
    expect(result).toMatchObject({
      intent: "AVAILABILITY",
      language: "English",
      matchedProductId: "11111111-1111-4111-8111-111111111102",
      quantity: 6,
      unitRate: 3200,
      quotedTotal: 19200,
    });
  });

  it("detects complaint messages and drafts an order-check apology", () => {
    const result = analyzeMessageFallback(
      "Mera pichla parcel abhi tak dispatch nahi hua hai",
      DEFAULT_CATALOG_PRODUCTS,
    );
    expect(result.intent).toBe("COMPLAINT");
    expect(result.language).toBe("Hinglish");
    expect(result.suggestedReply).toContain("order number");
  });

  it("uses a safe deterministic analysis when model output is invalid", () => {
    const result = parseModelAnalysis(
      "not valid json",
      "Rudraksha 100 pcs chahiye bulk rate batao",
      [product],
    );
    expect(result).toMatchObject({
      intent: "BULK_ORDER",
      language: "Hinglish",
      quantity: 100,
      matchedProductId: null,
      quotedTotal: null,
    });
  });
});

describe("REST API connectors (/api/*)", () => {
  const demoToken = createDemoAgentToken(
    "agent@remedysetu.in",
    "33333333-3333-4333-8333-333333333333",
  );

  it("returns connector health on GET /api/health", async () => {
    const response = await handleApiRequest(new Request("http://localhost:8080/api/health"));
    expect(response?.status).toBe(200);
    const body = (await response?.json()) as { status: string; connectors: unknown };
    expect(body.status).toBe("ok");
    expect(body.connectors).toBeDefined();
  });

  it("returns owner-scoped workspace products and leads via GET /api/products and GET /api/leads", async () => {
    const productsRes = await handleApiRequest(
      new Request("http://localhost:8080/api/products?category=GEMSTONE", {
        headers: {
          Authorization: `Bearer ${demoToken}`,
        },
      }),
    );
    expect(productsRes?.status).toBe(200);
    const productsBody = (await productsRes?.json()) as { products: CatalogProduct[] };
    expect(productsBody.products.length).toBeGreaterThan(0);
    expect(productsBody.products.every((item) => item.category === "GEMSTONE")).toBe(true);

    const leadsRes = await handleApiRequest(
      new Request("http://localhost:8080/api/leads", {
        headers: {
          Authorization: `Bearer ${demoToken}`,
        },
      }),
    );
    expect(leadsRes?.status).toBe(200);
    const leadsBody = (await leadsRes?.json()) as { leads: Array<{ created_by: string }> };
    expect(leadsBody.leads.length).toBeGreaterThan(0);
    expect(
      leadsBody.leads.every((item) => item.created_by === "33333333-3333-4333-8333-333333333333"),
    ).toBe(true);
  });

  it("analyzes a customer message and persists the owner-scoped lead via POST /api/analyze", async () => {
    const response = await handleApiRequest(
      new Request("http://localhost:8080/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${demoToken}`,
        },
        body: JSON.stringify({ message: "Panna 50 ratti bulk price?" }),
      }),
    );
    expect(response?.status).toBe(201);
    const payload = (await response?.json()) as {
      analysis: { quotedTotal: number; intent: string };
      lead: { id: string; created_by: string };
    };
    expect(payload.analysis.intent).toBe("BULK_ORDER");
    expect(payload.analysis.quotedTotal).toBe(95000);
    expect(payload.lead.created_by).toBe("33333333-3333-4333-8333-333333333333");
  });

  it("verifies Meta WhatsApp webhook challenge on GET /api/whatsapp/webhook", async () => {
    const response = await handleApiRequest(
      new Request(
        "http://localhost:8080/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=remedy_setu_verify&hub.challenge=challenge_12345",
      ),
    );
    expect(response?.status).toBe(200);
    expect(await response?.text()).toBe("challenge_12345");
  });
});
