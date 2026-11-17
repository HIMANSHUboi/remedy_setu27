export type ProductCategory = "GEMSTONE" | "RUDRAKSHA" | "SPIRITUAL_PRODUCT" | "PUJA_SERVICE";
export type LeadIntent =
  "PRICE_ENQUIRY" | "BULK_ORDER" | "AVAILABILITY" | "COMPLAINT" | "GENERAL_QUERY";
export type DetectedLanguage = "English" | "Hindi" | "Hinglish";
export type AnalysisProvider = "gemini" | "groq" | "openai" | "anthropic" | "deterministic";
export type StockAvailabilityStatus =
  "AVAILABLE" | "INSUFFICIENT_STOCK" | "OUT_OF_STOCK" | "UNMATCHED";

export interface CatalogProduct {
  id: string;
  name: string;
  hindi_name: string;
  category: ProductCategory;
  unit: string;
  base_price: number;
  tier10_plus_price: number | null;
  tier50_plus_price: number | null;
  tier100_plus_price: number | null;
  stock_quantity: number;
  in_stock: boolean;
  description: string;
}

export interface LeadAiInsights {
  urgency: "HIGH" | "MEDIUM" | "LOW";
  sentiment: "POSITIVE" | "NEUTRAL" | "URGENT" | "FRUSTRATED";
  conversionProbability: number;
  buyingSignals: string[];
  recommendedAction: string;
  upsellSuggestion: string | null;
  tierNudge: string | null;
  savingsVsRetail: number;
}

export interface AnalysisResult {
  intent: LeadIntent;
  language: DetectedLanguage;
  matchedProductId: string | null;
  quantity: number;
  quotedTotal: number | null;
  unitRate: number | null;
  availableStock: number | null;
  isQuantityAvailable: boolean;
  stockShortfall: number;
  stockStatus: StockAvailabilityStatus;
  suggestedReply: string;
  aiInsights: LeadAiInsights;
  provider?: AnalysisProvider;
}

export interface StockCheckResult {
  productId: string;
  productName: string;
  hindiName: string;
  unit: string;
  requestedQuantity: number;
  availableStock: number;
  isAvailable: boolean;
  shortfall: number;
  remainingAfterOrder: number;
  stockStatus: Exclude<StockAvailabilityStatus, "UNMATCHED">;
  unitRate: number;
  appliedTier: string;
  quotedTotal: number;
  availableStockTotal: number;
  savingsVsRetail: number;
  summaryMessage: string;
}

export interface WorkspaceInsightsResult {
  headline: string;
  summary: string;
  provider: AnalysisProvider;
  generatedAt: string;
  pipelineMetrics: {
    totalPipelineInr: number;
    convertedRevenueInr: number;
    conversionRatePct: number;
    avgOrderValueInr: number;
    totalStockUnits: number;
    totalInventoryValueInr: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  stockAlerts: Array<{
    productId: string;
    productName: string;
    unit: string;
    availableStock: number;
    openLeadDemand: number;
    status: "CRITICAL" | "LOW" | "DEMAND_EXCEEDS_STOCK" | "HEALTHY";
    recommendation: string;
  }>;
  strategicRecommendations: Array<{
    title: string;
    detail: string;
    impact: "HIGH" | "MEDIUM";
    category: "INVENTORY" | "PRICING" | "CONVERSION";
  }>;
  topProductDemand: Array<{
    productId: string;
    productName: string;
    unit: string;
    leadCount: number;
    requestedUnits: number;
    availableStock: number;
    quotedRevenue: number;
  }>;
}

export interface PlatformFeatureItem {
  id: string;
  title: string;
  category: "STOCK_DB" | "AI_INTELLIGENCE" | "WHATSAPP_CRM" | "PRICING_ENGINE";
  badge: string;
  description: string;
  highlights: string[];
}

export const PLATFORM_FEATURES: PlatformFeatureItem[] = [
  {
    id: "fixed-stock-db-check",
    title: "Fixed Stock Inventory & Real-Time DB Availability Check",
    category: "STOCK_DB",
    badge: "DB Verified",
    description:
      "Every catalogue product maintains a fixed stock quantity in PostgreSQL. Incoming inquiries automatically query the database to verify whether the exact requested quantity is available.",
    highlights: [
      "Distinguishes full availability, partial stock shortfall, and zero-stock states",
      "Drafts transparent multilingual replies quoting both available stock and full order value",
      "Supports live inline stock editing (+ / - / Set exact quantity) in the Price List tab",
    ],
  },
  {
    id: "order-fulfillment-deduction",
    title: "1-Click Order Fulfillment & Automatic Stock Deduction",
    category: "STOCK_DB",
    badge: "Inventory Sync",
    description:
      "When a customer confirms an order, agents can fulfill the lead with one click—automatically deducting the ordered quantity from database stock and updating `in_stock` status.",
    highlights: [
      "Prevents overselling scarce gemstones and Nepal Rudraksha beads",
      "Automatically flips product status to Out of Stock when quantity hits 0",
      "Updates lead lifecycle status to CONVERTED in the shared workspace",
    ],
  },
  {
    id: "ai-deal-coach",
    title: "AI Sales Coach & Per-Inquiry Buying Signals",
    category: "AI_INTELLIGENCE",
    badge: "AI Powered",
    description:
      "Analyzes customer urgency, sentiment, conversion probability, and buying signals while suggesting astrological cross-sells and next-best actions.",
    highlights: [
      "Calculates conversion probability score (0–100%) and urgency level",
      "Detects smart wholesale tier nudges when orders are near 10+, 50+, or 100+ thresholds",
      "Suggests relevant add-ons (silver/panchdhatu ring mounting, lab certificates, energized pouches)",
    ],
  },
  {
    id: "ai-workspace-insights",
    title: "AI Executive Insights & Demand-vs-Stock Forecasting",
    category: "AI_INTELLIGENCE",
    badge: "Executive AI",
    description:
      "Aggregates open customer leads against current database stock to flag products where pipeline demand exceeds available inventory before stockouts happen.",
    highlights: [
      "Compares open lead demand against fixed DB stock per SKU",
      "Generates AI strategic recommendations across Inventory, Pricing, and Conversion",
      "Tracks pipeline revenue, converted sales, average order value, and stock valuation",
    ],
  },
  {
    id: "smart-reply-enhancers",
    title: "Multilingual Smart Reply Enhancers & Quick Chips",
    category: "WHATSAPP_CRM",
    badge: "English · हिंदी · Hinglish",
    description:
      "One-click enhancers let sales agents append lab certification guarantees, wholesale tier upgrade offers, partial-dispatch options, or payment instructions in the customer's language.",
    highlights: [
      "Preserves deterministic INR pricing with zero hallucination",
      "Supports direct Meta WhatsApp Cloud API dispatch and 1-click wa.me deep links",
      "Includes CSV lead export and full status + intent filtering",
    ],
  },
  {
    id: "live-stock-calculator",
    title: "Interactive DB Stock & Wholesale Tier Simulator",
    category: "PRICING_ENGINE",
    badge: "Instant Quote",
    description:
      "Agents can select any gemstone, Rudraksha, mala, or puja kit and enter a quantity to immediately verify DB stock, applied wholesale tier, customer savings, and remaining inventory.",
    highlights: [
      "Shows exact savings compared to standard retail pricing",
      "Displays visual stock utilization bar and remaining inventory after order",
      "One-click transfers the simulated check directly into the WhatsApp reply assistant",
    ],
  },
];

export const DEFAULT_CATALOG_PRODUCTS: CatalogProduct[] = [
  {
    id: "11111111-1111-4111-8111-111111111101",
    name: "Neelam / Blue Sapphire",
    hindi_name: "नीलम",
    category: "GEMSTONE",
    unit: "ratti",
    base_price: 2800,
    tier10_plus_price: 2500,
    tier50_plus_price: 2200,
    tier100_plus_price: 1950,
    stock_quantity: 45,
    in_stock: true,
    description: "Ceylon origin lab-certified natural blue sapphire.",
  },
  {
    id: "11111111-1111-4111-8111-111111111102",
    name: "Pukhraj / Yellow Sapphire",
    hindi_name: "पुखराज",
    category: "GEMSTONE",
    unit: "ratti",
    base_price: 3200,
    tier10_plus_price: 2900,
    tier50_plus_price: 2600,
    tier100_plus_price: 2300,
    stock_quantity: 35,
    in_stock: true,
    description: "Natural unheated Ceylon yellow sapphire with lab certificate.",
  },
  {
    id: "11111111-1111-4111-8111-111111111103",
    name: "Panna / Emerald",
    hindi_name: "पन्ना",
    category: "GEMSTONE",
    unit: "ratti",
    base_price: 2400,
    tier10_plus_price: 2150,
    tier50_plus_price: 1900,
    tier100_plus_price: 1650,
    stock_quantity: 60,
    in_stock: true,
    description: "Zambian deep-green emerald for astrological wear.",
  },
  {
    id: "11111111-1111-4111-8111-111111111104",
    name: "Moonga / Red Coral",
    hindi_name: "मूंगा",
    category: "GEMSTONE",
    unit: "ratti",
    base_price: 950,
    tier10_plus_price: 820,
    tier50_plus_price: 720,
    tier100_plus_price: 640,
    stock_quantity: 80,
    in_stock: true,
    description: "Italian capsule-cut natural red coral gemstone.",
  },
  {
    id: "11111111-1111-4111-8111-111111111105",
    name: "Rudraksha / 5 Mukhi Rudraksha",
    hindi_name: "पंचमुखी रुद्राक्ष",
    category: "RUDRAKSHA",
    unit: "pcs",
    base_price: 180,
    tier10_plus_price: 140,
    tier50_plus_price: 110,
    tier100_plus_price: 85,
    stock_quantity: 250,
    in_stock: true,
    description: "Authentic Nepal-origin panchmukhi rudraksha beads.",
  },
  {
    id: "11111111-1111-4111-8111-111111111106",
    name: "7 Mukhi Rudraksha",
    hindi_name: "सप्तमुखी रुद्राक्ष",
    category: "RUDRAKSHA",
    unit: "pcs",
    base_price: 650,
    tier10_plus_price: 540,
    tier50_plus_price: 460,
    tier100_plus_price: 390,
    stock_quantity: 40,
    in_stock: true,
    description: "Certified Nepal 7 mukhi bead for Mahalakshmi kripa.",
  },
  {
    id: "11111111-1111-4111-8111-111111111107",
    name: "Sphatik Mala / Crystal Rosary",
    hindi_name: "स्फटिक माला",
    category: "SPIRITUAL_PRODUCT",
    unit: "mala",
    base_price: 450,
    tier10_plus_price: 380,
    tier50_plus_price: 320,
    tier100_plus_price: 270,
    stock_quantity: 75,
    in_stock: true,
    description: "Natural rock crystal japa mala with 108 diamond-cut beads.",
  },
  {
    id: "11111111-1111-4111-8111-111111111108",
    name: "Navgraha Shanti Puja Kit",
    hindi_name: "नवग्रह शांति पूजा किट",
    category: "PUJA_SERVICE",
    unit: "kit",
    base_price: 1250,
    tier10_plus_price: 1050,
    tier50_plus_price: 920,
    tier100_plus_price: 800,
    stock_quantity: 30,
    in_stock: true,
    description: "Complete samagri kit with energized yantra and vidhi booklet.",
  },
];

const intents: LeadIntent[] = [
  "PRICE_ENQUIRY",
  "BULK_ORDER",
  "AVAILABILITY",
  "COMPLAINT",
  "GENERAL_QUERY",
];
const languages: DetectedLanguage[] = ["English", "Hindi", "Hinglish"];

export function getAvailableStockQuantity(
  product: Pick<CatalogProduct, "in_stock"> & { stock_quantity?: number | null },
): number {
  if (!product.in_stock) return 0;
  const raw = product.stock_quantity;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.floor(raw));
  }
  return 50;
}

export function getTierRate(product: CatalogProduct, quantity: number): number {
  if (quantity >= 100 && product.tier100_plus_price != null) return product.tier100_plus_price;
  if (quantity >= 50 && product.tier50_plus_price != null) return product.tier50_plus_price;
  if (quantity >= 10 && product.tier10_plus_price != null) return product.tier10_plus_price;
  return product.base_price;
}

export function getTierLabel(quantity: number): string {
  if (quantity >= 100) return "100+ units (Bulk Tier 3)";
  if (quantity >= 50) return "50–99 units (Wholesale Tier 2)";
  if (quantity >= 10) return "10–49 units (Wholesale Tier 1)";
  return "1–9 units (Standard Retail)";
}

export function checkStockAvailability(
  product: CatalogProduct,
  requestedQuantity: number,
): StockCheckResult {
  const safeQuantity = Math.max(1, Math.floor(requestedQuantity));
  const availableStock = getAvailableStockQuantity(product);
  const unitRate = getTierRate(product, safeQuantity);
  const quotedTotal = unitRate * safeQuantity;
  const availableStockTotal = unitRate * Math.min(safeQuantity, availableStock);
  const retailTotal = product.base_price * safeQuantity;
  const savingsVsRetail = Math.max(0, retailTotal - quotedTotal);
  const isAvailable = product.in_stock && availableStock >= safeQuantity;
  const shortfall = isAvailable ? 0 : Math.max(0, safeQuantity - availableStock);
  const remainingAfterOrder = isAvailable ? availableStock - safeQuantity : 0;

  const stockStatus: Exclude<StockAvailabilityStatus, "UNMATCHED"> =
    !product.in_stock || availableStock <= 0
      ? "OUT_OF_STOCK"
      : isAvailable
        ? "AVAILABLE"
        : "INSUFFICIENT_STOCK";

  const summaryMessage =
    stockStatus === "AVAILABLE"
      ? `Yes — ${safeQuantity} ${product.unit} is available in DB stock (${availableStock} ${product.unit} on hand, ${remainingAfterOrder} ${product.unit} remaining after order).`
      : stockStatus === "INSUFFICIENT_STOCK"
        ? `Partial stock only — requested ${safeQuantity} ${product.unit}, but DB has ${availableStock} ${product.unit} available (${shortfall} ${product.unit} short).`
        : `Out of stock in DB — 0 ${product.unit} currently available for ${product.name}.`;

  return {
    productId: product.id,
    productName: product.name,
    hindiName: product.hindi_name,
    unit: product.unit,
    requestedQuantity: safeQuantity,
    availableStock,
    isAvailable,
    shortfall,
    remainingAfterOrder,
    stockStatus,
    unitRate,
    appliedTier: getTierLabel(safeQuantity),
    quotedTotal,
    availableStockTotal,
    savingsVsRetail,
    summaryMessage,
  };
}

export function extractQuantity(message: string): number {
  const unitMatch = message.match(
    /(?:^|\s|\b)(\d{1,6}(?:\.\d{1,2})?)\s*(?:pcs?|pieces?|units?|ratti|carats?|ct|malas?|kits?|beads?|नग|रत्ती|पीस|माला|किट)(?=\b|\s|$|[.,!?;:])/iu,
  );
  const fallbackMatch = message.match(/\b(\d{1,6}(?:\.\d{1,2})?)(?!\s*(?:mukhi|मुखी|beads))\b/iu);
  const raw = unitMatch?.[1] ?? fallbackMatch?.[1];
  if (!raw) return 1;
  const quantity = Math.floor(Number(raw));
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

export function findProduct(message: string, products: CatalogProduct[]): CatalogProduct | null {
  const normalized = message.toLocaleLowerCase().normalize("NFKC");
  let bestProduct: CatalogProduct | null = null;
  let bestScore = 0;

  for (const product of products) {
    const baseTerms = [
      product.name,
      product.hindi_name,
      ...product.name.split("/"),
      ...product.name.split(/[()]/),
    ]
      .map((term) => term.trim().toLocaleLowerCase().normalize("NFKC"))
      .filter((term) => term.length >= 2);

    for (const term of baseTerms) {
      if (normalized.includes(term) && term.length > bestScore) {
        bestScore = term.length;
        bestProduct = product;
      }
    }
  }

  return bestProduct;
}

export function buildLeadAiInsights({
  message,
  intent,
  product,
  quantity,
  stockStatus,
  availableStock,
  stockShortfall,
  unitRate,
  aiNote,
}: {
  message: string;
  intent: LeadIntent;
  product: CatalogProduct | null;
  quantity: number;
  stockStatus: StockAvailabilityStatus;
  availableStock: number | null;
  stockShortfall: number;
  unitRate: number | null;
  aiNote?: string;
}): LeadAiInsights {
  const normalized = message.toLocaleLowerCase();
  const buyingSignals: string[] = [];

  if (product) {
    buyingSignals.push(`Matched SKU: ${product.name} (${product.hindi_name})`);
  }
  if (quantity > 1) {
    buyingSignals.push(`Explicit quantity requested (${quantity} ${product?.unit ?? "units"})`);
  }
  if (/certifi|lab|original|natural|ceylon|nepal|authentic|असली|सर्टिफिकेट/iu.test(normalized)) {
    buyingSignals.push("High-trust buyer seeking authenticity / lab certification");
  }
  if (intent === "BULK_ORDER" || quantity >= 10) {
    buyingSignals.push("Wholesale volume buyer eligible for tier discount");
  }
  if (/urgent|jaldi|today|aaj|immediate|dispatch|अभी|जल्दी/iu.test(normalized)) {
    buyingSignals.push("Time-sensitive dispatch expectation");
  }

  const savingsVsRetail =
    product && unitRate != null ? Math.max(0, (product.base_price - unitRate) * quantity) : 0;

  let tierNudge: string | null = null;
  if (product) {
    if (quantity >= 6 && quantity < 10 && product.tier10_plus_price != null) {
      const extraNeeded = 10 - quantity;
      const perUnitSave = product.base_price - product.tier10_plus_price;
      tierNudge = `Add ${extraNeeded} more ${product.unit} (total 10 ${product.unit}) to unlock Tier-1 wholesale rate of ₹${product.tier10_plus_price}/${product.unit} (save ₹${perUnitSave}/${product.unit}).`;
    } else if (quantity >= 35 && quantity < 50 && product.tier50_plus_price != null) {
      const extraNeeded = 50 - quantity;
      const currentRate = getTierRate(product, quantity);
      const perUnitSave = currentRate - product.tier50_plus_price;
      tierNudge = `Add ${extraNeeded} more ${product.unit} (total 50 ${product.unit}) to unlock Tier-2 wholesale rate of ₹${product.tier50_plus_price}/${product.unit} (save ₹${perUnitSave}/${product.unit}).`;
    } else if (quantity >= 75 && quantity < 100 && product.tier100_plus_price != null) {
      const extraNeeded = 100 - quantity;
      const currentRate = getTierRate(product, quantity);
      const perUnitSave = currentRate - product.tier100_plus_price;
      tierNudge = `Add ${extraNeeded} more ${product.unit} (total 100 ${product.unit}) to unlock Best Bulk rate of ₹${product.tier100_plus_price}/${product.unit} (save ₹${perUnitSave}/${product.unit}).`;
    }
  }

  let upsellSuggestion: string | null = null;
  if (product) {
    if (product.category === "GEMSTONE") {
      upsellSuggestion =
        "Offer energized Silver or Panchdhatu ring/pendant mounting (+₹1,200) & complimentary GJEPC/IIGJ lab certificate photo.";
    } else if (product.category === "RUDRAKSHA") {
      upsellSuggestion =
        "Cross-sell Sphatik Mala (Crystal Rosary) or silver-capped Rudraksha thread with Vedic pran-pratishtha certificate.";
    } else if (product.category === "SPIRITUAL_PRODUCT") {
      upsellSuggestion =
        "Bundle with Navgraha Shanti Puja Kit or silk japa gomukhi bag for higher cart value.";
    } else {
      upsellSuggestion =
        "Offer live priest sankalp video add-on or bulk temple partner pack at 10+ kit pricing.";
    }
  }

  const urgency: LeadAiInsights["urgency"] =
    intent === "COMPLAINT" || intent === "BULK_ORDER" || quantity >= 25
      ? "HIGH"
      : intent === "PRICE_ENQUIRY" || intent === "AVAILABILITY"
        ? "MEDIUM"
        : "LOW";

  const sentiment: LeadAiInsights["sentiment"] =
    intent === "COMPLAINT"
      ? "FRUSTRATED"
      : intent === "BULK_ORDER"
        ? "URGENT"
        : product
          ? "POSITIVE"
          : "NEUTRAL";

  let conversionProbability = 50;
  if (intent === "COMPLAINT") {
    conversionProbability = 25;
  } else if (!product) {
    conversionProbability = 35;
  } else if (stockStatus === "OUT_OF_STOCK") {
    conversionProbability = 30;
  } else if (stockStatus === "INSUFFICIENT_STOCK") {
    conversionProbability = 62;
  } else {
    conversionProbability = intent === "BULK_ORDER" ? 88 : intent === "AVAILABILITY" ? 84 : 78;
    if (quantity > 1) conversionProbability = Math.min(95, conversionProbability + 5);
  }

  let recommendedAction: string;
  if (aiNote && aiNote.trim().length > 8) {
    recommendedAction = aiNote.trim();
  } else if (intent === "COMPLAINT") {
    recommendedAction =
      "Look up AWB / courier tracking immediately, share live dispatch status, and prioritize resolution.";
  } else if (!product) {
    recommendedAction =
      "Share digital wholesale rate card PDF and ask customer whether they need Gemstones (in ratti) or Rudraksha (in pcs).";
  } else if (stockStatus === "OUT_OF_STOCK") {
    recommendedAction = `Notify procurement to restock ${product.name} and offer to reserve the customer's ${quantity} ${product.unit} against the next lot.`;
  } else if (stockStatus === "INSUFFICIENT_STOCK") {
    recommendedAction = `Offer immediate partial dispatch of ${availableStock ?? 0} ${product.unit} in stock today and backorder the remaining ${stockShortfall} ${product.unit} (48–72h restock).`;
  } else if (tierNudge) {
    recommendedAction = `Confirm ${quantity} ${product.unit} is in DB stock (${availableStock} ${product.unit} ready) and pitch the wholesale tier upgrade to increase order size.`;
  } else {
    recommendedAction = `Confirm immediate dispatch from the ${availableStock} ${product.unit} in DB inventory and share UPI/bank details with certificate preview.`;
  }

  return {
    urgency,
    sentiment,
    conversionProbability,
    buyingSignals:
      buyingSignals.length > 0
        ? buyingSignals
        : ["General spiritual catalogue inquiry — qualify product & quantity"],
    recommendedAction,
    upsellSuggestion,
    tierNudge,
    savingsVsRetail,
  };
}

export function analyzeMessageFallback(
  message: string,
  products: CatalogProduct[],
): AnalysisResult {
  const normalized = message.toLocaleLowerCase();
  const quantity = extractQuantity(message);
  const complaint =
    /complain|complaint|parcel|dispatch|delivery|late|delay|not arrived|abhi tak|nahi aaya|nahi hua|problem|issue|damage|refund|tracking|शिकायत|पार्सल|डिलीवरी|देरी/u.test(
      normalized,
    );
  const bulk =
    /(?:^|\s|\b)(?:bulk|wholesale|thok|थोक|dealer|reseller)(?=\b|\s|$)/iu.test(normalized) ||
    quantity >= 10;
  const availability =
    /stock|available|availability|have you|do you have|hai kya|milega|स्टॉक|उपलब्ध|मिलेगा/u.test(
      normalized,
    );
  const intent: LeadIntent = complaint
    ? "COMPLAINT"
    : bulk
      ? "BULK_ORDER"
      : availability
        ? "AVAILABILITY"
        : /rate|price|cost|kitna|kya hai|batao|quote|भाव|दाम|रेट|कितना|कीमत/u.test(normalized)
          ? "PRICE_ENQUIRY"
          : "GENERAL_QUERY";
  const devanagari = /[\u0900-\u097f]/u.test(message);
  const romanHindi =
    /\b(ka|ki|ke|kya|chahiye|batao|hai|mera|abhi|tak|nahi|kitna|bhejo|aur|mein|liye|kaisa|milega)\b/u.test(
      normalized,
    );
  const language: DetectedLanguage = devanagari ? "Hindi" : romanHindi ? "Hinglish" : "English";
  const product = findProduct(message, products);
  return buildAnalysis({
    message,
    intent,
    language,
    product,
    quantity,
    provider: "deterministic",
  });
}

export function parseModelAnalysis(
  text: string,
  message: string,
  products: CatalogProduct[],
  provider: AnalysisProvider = "deterministic",
): AnalysisResult {
  const fallback = analyzeMessageFallback(message, products);
  try {
    const jsonText = text
      .replace(/^```(?:json)?\s*/iu, "")
      .replace(/\s*```$/u, "")
      .trim();
    const parsed: unknown = JSON.parse(jsonText);
    if (parsed == null || typeof parsed !== "object") return fallback;
    const data = parsed as {
      intent?: unknown;
      language?: unknown;
      quantity?: unknown;
      matchedProductId?: unknown;
      recommendedAction?: unknown;
    };
    const intent = intents.includes(data.intent as LeadIntent)
      ? (data.intent as LeadIntent)
      : fallback.intent;
    const language = languages.includes(data.language as DetectedLanguage)
      ? (data.language as DetectedLanguage)
      : fallback.language;
    const quantityCandidate = Number(data.quantity);
    const quantity =
      Number.isFinite(quantityCandidate) && quantityCandidate > 0
        ? Math.min(1_000_000, Math.floor(quantityCandidate))
        : fallback.quantity;
    const product =
      products.find((candidate) => candidate.id === data.matchedProductId) ??
      findProduct(message, products);
    const aiNote = typeof data.recommendedAction === "string" ? data.recommendedAction : undefined;
    return buildAnalysis({ message, intent, language, product, quantity, provider, aiNote });
  } catch {
    return fallback;
  }
}

function buildAnalysis({
  message = "",
  intent,
  language,
  product,
  quantity,
  provider = "deterministic",
  aiNote,
}: {
  message?: string;
  intent: LeadIntent;
  language: DetectedLanguage;
  product: CatalogProduct | null;
  quantity: number;
  provider?: AnalysisProvider;
  aiNote?: string;
}): AnalysisResult {
  const unitRate = product ? getTierRate(product, quantity) : null;
  const quotedTotal = unitRate == null ? null : unitRate * quantity;
  const productName = product?.name ?? "";
  const availableStock = product ? getAvailableStockQuantity(product) : null;
  const isQuantityAvailable = Boolean(
    product && product.in_stock && availableStock != null && availableStock >= quantity,
  );
  const stockShortfall =
    product && availableStock != null ? Math.max(0, quantity - availableStock) : 0;

  const stockStatus: StockAvailabilityStatus = !product
    ? "UNMATCHED"
    : !product.in_stock || (availableStock ?? 0) <= 0
      ? "OUT_OF_STOCK"
      : isQuantityAvailable
        ? "AVAILABLE"
        : "INSUFFICIENT_STOCK";

  let suggestedReply: string;

  if (intent === "COMPLAINT") {
    suggestedReply =
      language === "Hindi"
        ? "हमें हुई असुविधा के लिए खेद है। हम आपकी शिकायत की जाँच करके जल्द ही अपडेट देंगे। कृपया अपना ऑर्डर नंबर साझा करें।"
        : language === "Hinglish"
          ? "Delay ke liye humein khed hai. Hum aapke order ko check karke jaldi update denge. Kripya order number share karein."
          : "We're sorry for the delay. We'll check your order and update you shortly. Please share your order number.";
  } else if (!product) {
    suggestedReply =
      language === "Hindi"
        ? "नमस्कार! कृपया उत्पाद का नाम और आवश्यक मात्रा साझा करें, हम आपको सही जानकारी और दर भेज देंगे।"
        : language === "Hinglish"
          ? "Namaste! Product ka naam aur required quantity share karein, hum sahi details aur rate bhej denge."
          : "Hello! Please share the product name and quantity you need, and we'll send the right details and price.";
  } else if (stockStatus === "OUT_OF_STOCK") {
    suggestedReply =
      language === "Hindi"
        ? `${productName} फिलहाल स्टॉक में नहीं है (उपलब्ध स्टॉक: 0 ${product.unit})। उपलब्धता की जानकारी के लिए हमसे संपर्क करें।`
        : language === "Hinglish"
          ? `${productName} abhi stock mein nahi hai (Available stock: 0 ${product.unit}). Availability ke liye humein message karein.`
          : `${productName} is currently out of stock (0 ${product.unit} available in inventory). Message us and we'll confirm availability.`;
  } else if (stockStatus === "INSUFFICIENT_STOCK") {
    const onHand = availableStock ?? 0;
    const partialTotal = (unitRate ?? 0) * onHand;
    suggestedReply =
      language === "Hindi"
        ? `नमस्कार! आपने ${quantity} ${product.unit} ${productName} मांगा है, लेकिन अभी हमारे स्टॉक में केवल ${onHand} ${product.unit} उपलब्ध है (${stockShortfall} ${product.unit} कम है)। प्रति ${product.unit} भाव ₹${unitRate} है — उपलब्ध ${onHand} ${product.unit} का कुल ₹${partialTotal.toLocaleString("en-IN")} (पूरे ${quantity} ${product.unit} का कुल ₹${quotedTotal?.toLocaleString("en-IN")}) होगा। क्या हम अभी उपलब्ध ${onHand} ${product.unit} डिस्पैच करें?`
        : language === "Hinglish"
          ? `Namaste! Aapne ${quantity} ${product.unit} ${productName} manga hai, par abhi stock mein sirf ${onHand} ${product.unit} available hai (${stockShortfall} ${product.unit} short hai). Rate ₹${unitRate} per ${product.unit} hai — available ${onHand} ${product.unit} ka total ₹${partialTotal.toLocaleString("en-IN")} (full ${quantity} ${product.unit} ka total ₹${quotedTotal?.toLocaleString("en-IN")}) hoga. Kya abhi ${onHand} ${product.unit} confirm karein?`
          : `Hello! You requested ${quantity} ${product.unit} of ${productName}, but we currently have only ${onHand} ${product.unit} available in stock (${stockShortfall} ${product.unit} short). At ₹${unitRate} per ${product.unit}, the available ${onHand} ${product.unit} is ₹${partialTotal.toLocaleString("en-IN")} (full ${quantity} ${product.unit} total: ₹${quotedTotal?.toLocaleString("en-IN")}). Would you like to confirm the available ${onHand} ${product.unit} now?`;
  } else if (language === "Hindi") {
    suggestedReply = `नमस्कार! हाँ, ${quantity} ${product.unit} ${productName} स्टॉक में उपलब्ध है (उपलब्ध स्टॉक: ${availableStock} ${product.unit})। इसका भाव ₹${unitRate} प्रति ${product.unit} है। ${quantity} ${product.unit} का कुल ₹${quotedTotal?.toLocaleString("en-IN")} होगा। ऑर्डर पक्का करने के लिए बताइए।`;
  } else if (language === "Hinglish") {
    suggestedReply = `Namaste! Haan, ${quantity} ${product.unit} ${productName} stock mein available hai (Available stock: ${availableStock} ${product.unit}). ${productName} ka rate ₹${unitRate} per ${product.unit} hai. ${quantity} ${product.unit} ka total ₹${quotedTotal?.toLocaleString("en-IN")} hoga. Order confirm karne ke liye batayein.`;
  } else {
    suggestedReply = `Hello! Yes, ${quantity} ${product.unit} of ${productName} is in stock (${availableStock} ${product.unit} available) at ₹${unitRate} per ${product.unit}. Your total for ${quantity} ${product.unit} is ₹${quotedTotal?.toLocaleString("en-IN")}. Let us know if you'd like to confirm the order.`;
  }

  const aiInsights = buildLeadAiInsights({
    message,
    intent,
    product,
    quantity,
    stockStatus,
    availableStock,
    stockShortfall,
    unitRate,
    aiNote,
  });

  return {
    intent,
    language,
    matchedProductId: product?.id ?? null,
    quantity,
    quotedTotal,
    unitRate,
    availableStock,
    isQuantityAvailable,
    stockShortfall,
    stockStatus,
    suggestedReply,
    aiInsights,
    provider,
  };
}

export function buildDeterministicWorkspaceInsights(
  products: CatalogProduct[],
  leads: Array<{
    intent: LeadIntent;
    status: "NEW" | "REPLIED" | "CONVERTED";
    matched_product_id: string | null;
    extracted_quantity: number;
    quoted_total: number | null;
  }>,
  provider: AnalysisProvider = "deterministic",
  aiOverride?: { headline?: string; summary?: string },
): WorkspaceInsightsResult {
  const totalPipelineInr = leads.reduce((sum, lead) => sum + (Number(lead.quoted_total) || 0), 0);
  const convertedLeads = leads.filter((lead) => lead.status === "CONVERTED");
  const convertedRevenueInr = convertedLeads.reduce(
    (sum, lead) => sum + (Number(lead.quoted_total) || 0),
    0,
  );
  const conversionRatePct =
    leads.length > 0 ? Math.round((convertedLeads.length / leads.length) * 100) : 0;
  const quotedLeads = leads.filter((lead) => (Number(lead.quoted_total) || 0) > 0);
  const avgOrderValueInr =
    quotedLeads.length > 0 ? Math.round(totalPipelineInr / quotedLeads.length) : 0;

  let totalStockUnits = 0;
  let totalInventoryValueInr = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  const demandByProduct = new Map<
    string,
    { leadCount: number; openDemand: number; totalDemand: number; quotedRevenue: number }
  >();

  for (const lead of leads) {
    if (!lead.matched_product_id) continue;
    const current = demandByProduct.get(lead.matched_product_id) ?? {
      leadCount: 0,
      openDemand: 0,
      totalDemand: 0,
      quotedRevenue: 0,
    };
    current.leadCount += 1;
    current.totalDemand += lead.extracted_quantity;
    if (lead.status !== "CONVERTED") {
      current.openDemand += lead.extracted_quantity;
    }
    current.quotedRevenue += Number(lead.quoted_total) || 0;
    demandByProduct.set(lead.matched_product_id, current);
  }

  const stockAlerts: WorkspaceInsightsResult["stockAlerts"] = [];
  const topProductDemand: WorkspaceInsightsResult["topProductDemand"] = [];

  for (const product of products) {
    const avail = getAvailableStockQuantity(product);
    totalStockUnits += avail;
    totalInventoryValueInr += avail * product.base_price;

    const demand = demandByProduct.get(product.id) ?? {
      leadCount: 0,
      openDemand: 0,
      totalDemand: 0,
      quotedRevenue: 0,
    };

    if (!product.in_stock || avail === 0) {
      outOfStockCount += 1;
    } else if (avail <= 35) {
      lowStockCount += 1;
    }

    let status: WorkspaceInsightsResult["stockAlerts"][number]["status"] = "HEALTHY";
    let recommendation = `Stock level is healthy (${avail} ${product.unit} ready for dispatch).`;

    if (!product.in_stock || avail === 0) {
      status = "CRITICAL";
      recommendation = `Out of stock (0 ${product.unit}). Restock immediately to avoid losing ${demand.openDemand > 0 ? `${demand.openDemand} ${product.unit} in open inquiries` : "incoming inquiries"}.`;
    } else if (demand.openDemand > avail) {
      status = "DEMAND_EXCEEDS_STOCK";
      recommendation = `Open customer inquiries request ${demand.openDemand} ${product.unit}, exceeding current DB stock of ${avail} ${product.unit} by ${demand.openDemand - avail} ${product.unit}. Prioritize restocking.`;
    } else if (avail <= 35) {
      status = "LOW";
      recommendation = `Only ${avail} ${product.unit} remaining in fixed inventory. Schedule supplier replenishment above 50 ${product.unit}.`;
    }

    stockAlerts.push({
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      availableStock: avail,
      openLeadDemand: demand.openDemand,
      status,
      recommendation,
    });

    topProductDemand.push({
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      leadCount: demand.leadCount,
      requestedUnits: demand.totalDemand,
      availableStock: avail,
      quotedRevenue: demand.quotedRevenue,
    });
  }

  stockAlerts.sort((a, b) => {
    const rank = { CRITICAL: 0, DEMAND_EXCEEDS_STOCK: 1, LOW: 2, HEALTHY: 3 };
    return rank[a.status] - rank[b.status] || a.availableStock - b.availableStock;
  });

  topProductDemand.sort(
    (a, b) => b.quotedRevenue - a.quotedRevenue || b.requestedUnits - a.requestedUnits,
  );

  const openNewLeads = leads.filter((l) => l.status === "NEW").length;
  const bulkLeads = leads.filter((l) => l.intent === "BULK_ORDER").length;

  const strategicRecommendations: WorkspaceInsightsResult["strategicRecommendations"] = [
    {
      title:
        openNewLeads > 0
          ? `Follow up on ${openNewLeads} un-replied customer ${openNewLeads === 1 ? "inquiry" : "inquiries"}`
          : "All incoming customer inquiries have been replied to",
      detail:
        openNewLeads > 0
          ? "Sending a WhatsApp reply with lab-certificate confirmation within 15 minutes boosts gemstone & Rudraksha conversion by up to 2.4x."
          : "Maintain rapid response times and use 1-Click Fulfill & Deduct Stock when payments clear.",
      impact: "HIGH",
      category: "CONVERSION",
    },
    {
      title:
        outOfStockCount + lowStockCount > 0
          ? `Replenish ${outOfStockCount + lowStockCount} catalogue SKUs with low or zero stock`
          : "Fixed DB stock levels cover all active customer quotes",
      detail:
        outOfStockCount + lowStockCount > 0
          ? "Navgraha Puja Kits (30 kits) and Pukhraj / Yellow Sapphire (35 ratti) have tighter fixed buffer stock—replenish to support 50+ wholesale tier orders."
          : `Current catalogue holds ${totalStockUnits} total units worth ₹${totalInventoryValueInr.toLocaleString("en-IN")} at retail valuation.`,
      impact: "HIGH",
      category: "INVENTORY",
    },
    {
      title: `Pitch Tier-1 (10+) & Tier-2 (50+) wholesale nudges (${bulkLeads} bulk leads tracked)`,
      detail:
        "Customers inquiring for 6–9 ratti/pcs convert at higher order values when shown the exact per-unit savings at the 10+ unit tier.",
      impact: "MEDIUM",
      category: "PRICING",
    },
  ];

  const defaultHeadline =
    outOfStockCount > 0
      ? `${outOfStockCount} SKU out of stock · ₹${totalPipelineInr.toLocaleString("en-IN")} active pipeline across ${leads.length} leads`
      : `Inventory healthy (${totalStockUnits} units in DB) · ₹${totalPipelineInr.toLocaleString("en-IN")} active quote pipeline`;

  const defaultSummary = `Remedy Setu is tracking ${leads.length} customer inquiries worth ₹${totalPipelineInr.toLocaleString("en-IN")} (₹${convertedRevenueInr.toLocaleString("en-IN")} converted) against ${products.length} catalogue items with ${totalStockUnits} total units in fixed database stock.`;

  return {
    headline: aiOverride?.headline?.trim() || defaultHeadline,
    summary: aiOverride?.summary?.trim() || defaultSummary,
    provider,
    generatedAt: new Date().toISOString(),
    pipelineMetrics: {
      totalPipelineInr,
      convertedRevenueInr,
      conversionRatePct,
      avgOrderValueInr,
      totalStockUnits,
      totalInventoryValueInr,
      lowStockCount,
      outOfStockCount,
    },
    stockAlerts,
    strategicRecommendations,
    topProductDemand,
  };
}
