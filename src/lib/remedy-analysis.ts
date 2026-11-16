export type ProductCategory = "GEMSTONE" | "RUDRAKSHA" | "SPIRITUAL_PRODUCT" | "PUJA_SERVICE";
export type LeadIntent =
  "PRICE_ENQUIRY" | "BULK_ORDER" | "AVAILABILITY" | "COMPLAINT" | "GENERAL_QUERY";
export type DetectedLanguage = "English" | "Hindi" | "Hinglish";
export type AnalysisProvider = "gemini" | "groq" | "openai" | "anthropic" | "deterministic";

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
  in_stock: boolean;
  description: string;
}

export interface AnalysisResult {
  intent: LeadIntent;
  language: DetectedLanguage;
  matchedProductId: string | null;
  quantity: number;
  quotedTotal: number | null;
  unitRate: number | null;
  suggestedReply: string;
  provider?: AnalysisProvider;
}

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

export function getTierRate(product: CatalogProduct, quantity: number): number {
  if (quantity >= 100 && product.tier100_plus_price != null) return product.tier100_plus_price;
  if (quantity >= 50 && product.tier50_plus_price != null) return product.tier50_plus_price;
  if (quantity >= 10 && product.tier10_plus_price != null) return product.tier10_plus_price;
  return product.base_price;
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
  return buildAnalysis({ intent, language, product, quantity, provider: "deterministic" });
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
    return buildAnalysis({ intent, language, product, quantity, provider });
  } catch {
    return fallback;
  }
}

function buildAnalysis({
  intent,
  language,
  product,
  quantity,
  provider = "deterministic",
}: {
  intent: LeadIntent;
  language: DetectedLanguage;
  product: CatalogProduct | null;
  quantity: number;
  provider?: AnalysisProvider;
}): AnalysisResult {
  const unitRate = product ? getTierRate(product, quantity) : null;
  const quotedTotal = unitRate == null ? null : unitRate * quantity;
  const productName = product?.name ?? "";
  const stock = product?.in_stock ?? false;
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
  } else if (!stock) {
    suggestedReply =
      language === "Hindi"
        ? `${productName} फिलहाल स्टॉक में नहीं है। उपलब्धता की जानकारी के लिए हमसे संपर्क करें।`
        : language === "Hinglish"
          ? `${productName} abhi stock mein nahi hai. Availability ke liye humein message karein.`
          : `${productName} is currently out of stock. Message us and we'll confirm availability.`;
  } else if (language === "Hindi") {
    suggestedReply = `नमस्कार! ${productName} स्टॉक में उपलब्ध है। इसका भाव ₹${unitRate} प्रति ${product.unit} है। ${quantity} ${product.unit} का कुल ₹${quotedTotal?.toLocaleString("en-IN")} होगा। ऑर्डर पक्का करने के लिए बताइए।`;
  } else if (language === "Hinglish") {
    suggestedReply = `Namaste! ${productName} ka rate ₹${unitRate} per ${product.unit} hai. ${quantity} ${product.unit} ka total ₹${quotedTotal?.toLocaleString("en-IN")} hoga. Order confirm karne ke liye batayein.`;
  } else {
    suggestedReply = `Hello! Yes, ${productName} is in stock at ₹${unitRate} per ${product.unit}. Your total for ${quantity} ${product.unit} is ₹${quotedTotal?.toLocaleString("en-IN")}. Let us know if you'd like to confirm the order.`;
  }

  return {
    intent,
    language,
    matchedProductId: product?.id ?? null,
    quantity,
    quotedTotal,
    unitRate,
    suggestedReply,
    provider,
  };
}
