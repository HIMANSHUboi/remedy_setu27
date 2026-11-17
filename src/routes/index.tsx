import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import {
  ChevronDown,
  Clipboard,
  Download,
  LoaderCircle,
  LogOut,
  MessageCircle,
  Minus,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createDemoAgentToken,
  DEMO_SESSION_STORAGE_KEY,
} from "@/integrations/supabase/auth-attacher";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import type { Database } from "@/integrations/supabase/types";
import {
  analyzeCustomerMessage,
  checkProductStockAvailability,
  deleteSavedLead,
  dispatchWhatsAppReply,
  fulfillLeadOrder,
  generateWorkspaceInsights,
  getWorkspaceData,
  toggleProductStock,
  updateProductStock,
  updateSavedLead,
  type ConnectorStatusSummary,
} from "@/lib/remedy.functions";
import {
  buildDeterministicWorkspaceInsights,
  checkStockAvailability,
  getAvailableStockQuantity,
  PLATFORM_FEATURES,
  type AnalysisResult,
  type CatalogProduct,
  type ProductCategory,
  type StockCheckResult,
  type WorkspaceInsightsResult,
} from "@/lib/remedy-analysis";

type Product = CatalogProduct;
type Lead = Database["public"]["Tables"]["remedy_leads"]["Row"] & {
  matched_product: Product | null;
};
type WorkspaceTab = "assistant" | "leads" | "catalog" | "insights";
type IntentFilter = "ALL" | Database["public"]["Enums"]["remedy_lead_intent"];
type StatusFilter = "ALL" | Database["public"]["Enums"]["remedy_lead_status"];
type CategoryFilter = "ALL" | ProductCategory;
type AnalysisCard = { analysis: AnalysisResult; lead: Lead };

const samples = [
  "Neelam ka rate kya hai 5 ratti?",
  "Rudraksha 100 pcs chahiye bulk rate batao",
  "Do you have certified Yellow Sapphire 6.25 ratti in stock?",
  "Neelam 60 ratti urgent bulk order chahiye, kya itna stock available hai?",
  "Mera pichla parcel abhi tak dispatch nahi hua hai",
];

const intentLabels: Record<Database["public"]["Enums"]["remedy_lead_intent"], string> = {
  PRICE_ENQUIRY: "Price enquiry",
  BULK_ORDER: "Bulk order",
  AVAILABILITY: "Availability",
  COMPLAINT: "Complaint",
  GENERAL_QUERY: "General query",
};

const categoryLabels: Record<Database["public"]["Enums"]["remedy_product_category"], string> = {
  GEMSTONE: "Gemstones",
  RUDRAKSHA: "Rudraksha",
  SPIRITUAL_PRODUCT: "Spiritual goods",
  PUJA_SERVICE: "Puja & kits",
};

const featureCategoryLabels: Record<(typeof PLATFORM_FEATURES)[number]["category"], string> = {
  STOCK_DB: "Database Inventory",
  AI_INTELLIGENCE: "AI Intelligence",
  WHATSAPP_CRM: "WhatsApp & CRM",
  PRICING_ENGINE: "Wholesale Pricing",
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Remedy Setu — Sales & Inventory Desk" },
      {
        name: "description",
        content:
          "WhatsApp reply assistant, database stock availability verifier, and wholesale catalogue for Remedy Setu.",
      },
      { property: "og:title", content: "Remedy Setu — Sales & Inventory Desk" },
      {
        property: "og:description",
        content:
          "Verify database stock quantities, generate customer replies, and manage wholesale leads.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RemedySetuPage,
});

function RemedySetuPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("assistant");
  const [workspace, setWorkspace] = useState<{
    products: Product[];
    leads: Lead[];
    connectors?: ConnectorStatusSummary;
  }>({
    products: [],
    leads: [],
  });
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [message, setMessage] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [analysisCard, setAnalysisCard] = useState<AnalysisCard | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [savingReply, setSavingReply] = useState(false);
  const [search, setSearch] = useState("");
  const [intentFilter, setIntentFilter] = useState<IntentFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const [checkerProductId, setCheckerProductId] = useState<string>("");
  const [checkerQuantity, setCheckerQuantity] = useState<number>(10);
  const [liveStockCheck, setLiveStockCheck] = useState<StockCheckResult | null>(null);
  const [checkingStockDb, setCheckingStockDb] = useState(false);

  const [stockDrafts, setStockDrafts] = useState<Record<string, number>>({});
  const [updatingStockId, setUpdatingStockId] = useState<string | null>(null);
  const [fulfillingLeadId, setFulfillingLeadId] = useState<string | null>(null);

  const [aiInsightsData, setAiInsightsData] = useState<WorkspaceInsightsResult | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const loadWorkspace = useServerFn(getWorkspaceData);
  const analyzeMessageFn = useServerFn(analyzeCustomerMessage);
  const updateLeadFn = useServerFn(updateSavedLead);
  const deleteLeadFn = useServerFn(deleteSavedLead);
  const toggleStockFn = useServerFn(toggleProductStock);
  const updateStockFn = useServerFn(updateProductStock);
  const checkStockDbFn = useServerFn(checkProductStockAvailability);
  const fulfillLeadFn = useServerFn(fulfillLeadOrder);
  const generateInsightsFn = useServerFn(generateWorkspaceInsights);
  const dispatchWhatsAppFn = useServerFn(dispatchWhatsAppReply);

  const syncStockDrafts = useCallback((products: Product[]) => {
    const drafts: Record<string, number> = {};
    for (const item of products) {
      drafts[item.id] = getAvailableStockQuantity(item);
    }
    setStockDrafts(drafts);
    setCheckerProductId((current) => current || products[0]?.id || "");
  }, []);

  const refreshWorkspace = useCallback(async () => {
    setLoadingWorkspace(true);
    try {
      const data = await loadWorkspace();
      const products = data.products as Product[];
      const leads = data.leads as Lead[];
      setWorkspace({
        products,
        leads,
        connectors: data.connectors,
      });
      syncStockDrafts(products);
    } catch {
      toast.error("Couldn't load workspace data.");
    } finally {
      setLoadingWorkspace(false);
    }
  }, [loadWorkspace, syncStockDrafts]);

  const refreshAiInsights = useCallback(async () => {
    setLoadingInsights(true);
    try {
      const result = await generateInsightsFn();
      setAiInsightsData(result);
    } catch {
      toast.error("Couldn't refresh insights.");
    } finally {
      setLoadingInsights(false);
    }
  }, [generateInsightsFn]);

  useEffect(() => {
    let mounted = true;

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      if (tokenHash && type) {
        void supabase.auth
          .verifyOtp({
            token_hash: tokenHash,
            type: type as "signup" | "email" | "recovery" | "invite",
          })
          .finally(() => {
            window.history.replaceState({}, document.title, window.location.pathname);
          });
      }

      try {
        const storedDemo = window.localStorage.getItem(DEMO_SESSION_STORAGE_KEY);
        if (storedDemo) {
          const parsed = JSON.parse(storedDemo) as Session;
          if (parsed?.access_token && parsed?.user?.id) {
            setSession(parsed);
            setAuthLoading(false);
            return () => {
              mounted = false;
            };
          }
        }
      } catch {
        // Ignore invalid stored demo session
      }
    }

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) {
          setSession(data.session ?? null);
          setAuthLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setAuthLoading(false);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted && newSession) {
        setSession(newSession);
        setAuthLoading(false);
      }
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (userId) void refreshWorkspace();
  }, [userId, refreshWorkspace]);

  const computedInsights = useMemo(
    () =>
      aiInsightsData ?? buildDeterministicWorkspaceInsights(workspace.products, workspace.leads),
    [aiInsightsData, workspace.products, workspace.leads],
  );

  const selectedCheckerProduct = useMemo(
    () =>
      workspace.products.find((item) => item.id === checkerProductId) ??
      workspace.products[0] ??
      null,
    [workspace.products, checkerProductId],
  );

  const instantStockCheck = useMemo(() => {
    if (!selectedCheckerProduct) return null;
    if (
      liveStockCheck &&
      liveStockCheck.productId === selectedCheckerProduct.id &&
      liveStockCheck.requestedQuantity === checkerQuantity
    ) {
      return liveStockCheck;
    }
    return checkStockAvailability(selectedCheckerProduct, checkerQuantity);
  }, [selectedCheckerProduct, checkerQuantity, liveStockCheck]);

  const openLeads = useMemo(
    () => workspace.leads.filter((lead) => lead.status === "NEW").length,
    [workspace.leads],
  );

  const totalFixedStockUnits = useMemo(
    () => workspace.products.reduce((sum, item) => sum + getAvailableStockQuantity(item), 0),
    [workspace.products],
  );

  const filteredLeads = useMemo(
    () =>
      workspace.leads.filter((lead) => {
        const matchesIntent = intentFilter === "ALL" || lead.intent === intentFilter;
        const matchesStatus = statusFilter === "ALL" || lead.status === statusFilter;
        const normalizedSearch = search.trim().toLocaleLowerCase();
        const matchesSearch =
          !normalizedSearch ||
          `${lead.customer_message} ${lead.matched_product?.name ?? ""} ${lead.suggested_reply}`
            .toLocaleLowerCase()
            .includes(normalizedSearch);
        return matchesIntent && matchesStatus && matchesSearch;
      }),
    [workspace.leads, intentFilter, statusFilter, search],
  );

  const filteredProducts = useMemo(
    () =>
      workspace.products.filter(
        (item) => categoryFilter === "ALL" || item.category === categoryFilter,
      ),
    [workspace.products, categoryFilter],
  );

  function startInstantDemoSession() {
    const demoUserId = "33333333-3333-4333-8333-333333333333";
    const demoEmail = "desk.agent@remedysetu.in";
    const token = createDemoAgentToken(demoEmail, demoUserId);
    const demoSession = {
      access_token: token,
      refresh_token: "demo-refresh",
      expires_in: 86400,
      token_type: "bearer",
      user: {
        id: demoUserId,
        email: demoEmail,
        aud: "authenticated",
        role: "authenticated",
        app_metadata: {},
        user_metadata: { name: "Remedy Setu Agent" },
        created_at: new Date().toISOString(),
      },
    } as unknown as Session;

    if (typeof window !== "undefined") {
      window.localStorage.setItem(DEMO_SESSION_STORAGE_KEY, JSON.stringify(demoSession));
    }
    setSession(demoSession);
    toast.success("Signed in to Demo Workspace.");
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (isCreatingAccount) {
        const { error: rpcError } = await supabase.rpc("register_team_agent", {
          agent_email: email,
          agent_password: password,
        });
        if (rpcError) {
          toast.error(rpcError.message);
          return;
        }
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          toast.error(signInError.message);
          return;
        }
        if (signInData.session) {
          setSession(signInData.session);
          toast.success("Account created.");
        }
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (data.session) {
        setSession(data.session);
        toast.success("Signed in.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed.");
    }
  }

  async function generateReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const customerMessage = message.trim();
    if (!customerMessage) return;
    setAnalyzing(true);
    try {
      const result = await analyzeMessageFn({ data: { message: customerMessage } });
      const lead = result.lead as Lead;
      setAnalysisCard({ analysis: result.analysis, lead });
      setWorkspace((current) => ({
        ...current,
        leads: [lead, ...current.leads.filter((item) => item.id !== lead.id)],
      }));
      if (result.analysis.stockStatus === "INSUFFICIENT_STOCK") {
        toast.warning(
          `Requested ${result.analysis.quantity} units, only ${result.analysis.availableStock ?? 0} in DB stock.`,
        );
      } else if (result.analysis.stockStatus === "OUT_OF_STOCK") {
        toast.warning("Matched product is out of stock.");
      } else {
        toast.success("Reply generated and saved.");
      }
    } catch {
      toast.error("Couldn't generate reply. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function verifyStockInDatabase() {
    if (!selectedCheckerProduct) return;
    setCheckingStockDb(true);
    try {
      const checked = await checkStockDbFn({
        data: { productId: selectedCheckerProduct.id, quantity: checkerQuantity },
      });
      setLiveStockCheck(checked);
      if (checked.isAvailable) {
        toast.success(
          `${checked.requestedQuantity} ${checked.unit} available (${checked.availableStock} ${checked.unit} in DB).`,
        );
      } else {
        toast.warning(
          `Only ${checked.availableStock} ${checked.unit} in stock (short by ${checked.shortfall} ${checked.unit}).`,
        );
      }
    } catch {
      toast.error("Couldn't verify database stock.");
    } finally {
      setCheckingStockDb(false);
    }
  }

  async function updateLead(
    id: string,
    changes: { status?: Lead["status"]; suggestedReply?: string },
  ) {
    try {
      const updated = (await updateLeadFn({ data: { id, ...changes } })) as Lead;
      setWorkspace((current) => ({
        ...current,
        leads: current.leads.map((lead) => (lead.id === id ? updated : lead)),
      }));
      setSelectedLead((current) => (current?.id === id ? updated : current));
      setAnalysisCard((current) =>
        current?.lead.id === id
          ? {
              ...current,
              lead: updated,
              analysis: { ...current.analysis, suggestedReply: updated.suggested_reply },
            }
          : current,
      );
      return updated;
    } catch {
      toast.error("Couldn't save changes.");
      return null;
    }
  }

  async function handleFulfillLead(lead: Lead) {
    setFulfillingLeadId(lead.id);
    try {
      const result = await fulfillLeadFn({ data: { leadId: lead.id } });
      const updatedLead = result.lead as Lead;
      const updatedProduct = result.product as Product | null;

      setWorkspace((current) => ({
        ...current,
        products: updatedProduct
          ? current.products.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
          : current.products,
        leads: current.leads.map((item) => (item.id === updatedLead.id ? updatedLead : item)),
      }));

      if (updatedProduct) {
        setStockDrafts((current) => ({
          ...current,
          [updatedProduct.id]: updatedProduct.stock_quantity,
        }));
      }

      setAnalysisCard((current) =>
        current?.lead.id === updatedLead.id
          ? {
              ...current,
              lead: updatedLead,
              analysis: {
                ...current.analysis,
                availableStock: updatedProduct?.stock_quantity ?? current.analysis.availableStock,
              },
            }
          : current,
      );

      if (updatedProduct) {
        toast.success(
          `Order fulfilled. Deducted ${result.deductedQuantity} ${updatedProduct.unit} (${result.remainingStock} ${updatedProduct.unit} left).`,
        );
      } else {
        toast.success("Lead marked as converted.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't fulfill order.");
    } finally {
      setFulfillingLeadId(null);
    }
  }

  async function deleteLead(id: string) {
    try {
      await deleteLeadFn({ data: { id } });
      setWorkspace((current) => ({
        ...current,
        leads: current.leads.filter((lead) => lead.id !== id),
      }));
      setSelectedLead((current) => (current?.id === id ? null : current));
      setAnalysisCard((current) => (current?.lead.id === id ? null : current));
      toast.success("Lead deleted.");
    } catch {
      toast.error("Couldn't delete lead.");
    }
  }

  async function toggleStock(product: Product) {
    setUpdatingStockId(product.id);
    try {
      const updated = (await toggleStockFn({
        data: { id: product.id, inStock: !product.in_stock },
      })) as Product;
      setWorkspace((current) => ({
        ...current,
        products: current.products.map((item) => (item.id === product.id ? updated : item)),
      }));
      setStockDrafts((current) => ({
        ...current,
        [product.id]: getAvailableStockQuantity(updated),
      }));
      toast.success(
        `${updated.name}: ${updated.in_stock ? `In stock (${updated.stock_quantity} ${updated.unit})` : "Out of stock (0)"}.`,
      );
    } catch {
      toast.error("Couldn't update stock status.");
    } finally {
      setUpdatingStockId(null);
    }
  }

  async function saveFixedStockQuantity(product: Product, nextQty: number) {
    const clamped = Math.max(0, Math.min(100000, Math.floor(nextQty)));
    setUpdatingStockId(product.id);
    try {
      const updated = (await updateStockFn({
        data: { id: product.id, stockQuantity: clamped, inStock: clamped > 0 },
      })) as Product;
      setWorkspace((current) => ({
        ...current,
        products: current.products.map((item) => (item.id === product.id ? updated : item)),
      }));
      setStockDrafts((current) => ({
        ...current,
        [product.id]: updated.stock_quantity,
      }));
      toast.success(`Stock updated: ${updated.name} (${updated.stock_quantity} ${updated.unit}).`);
    } catch {
      toast.error("Couldn't update stock quantity.");
    } finally {
      setUpdatingStockId(null);
    }
  }

  function appendSmartEnhancer(kind: "certificate" | "tier" | "partial" | "payment") {
    if (!analysisCard) return;
    const { language } = analysisCard.analysis;
    const product = analysisCard.lead.matched_product;
    const unit = product?.unit ?? "units";
    const avail = analysisCard.analysis.availableStock ?? 0;

    let snippet = "";
    if (kind === "certificate") {
      snippet =
        language === "Hindi"
          ? " सभी रत्न एवं रुद्राक्ष प्रमाणित लैब सर्टिफिकेट और पक्के बिल के साथ भेजे जाते हैं।"
          : language === "Hinglish"
            ? " Sabhi items original lab certificate aur GST invoice ke saath dispatch hote hain."
            : " All items ship with an authentic lab certificate and official GST invoice.";
    } else if (kind === "tier") {
      snippet = analysisCard.analysis.aiInsights.tierNudge
        ? ` ${analysisCard.analysis.aiInsights.tierNudge}`
        : language === "Hindi"
          ? " 10+ और 50+ मात्रा पर विशेष थोक छूट उपलब्ध है।"
          : language === "Hinglish"
            ? " 10+ aur 50+ quantity par special wholesale tier discount bhi milega."
            : " Special wholesale tier discounts apply at 10+, 50+, and 100+ units.";
    } else if (kind === "partial") {
      snippet =
        language === "Hindi"
          ? ` हमारे स्टॉक में ${avail} ${unit} तुरंत डिस्पैच के लिए तैयार है और शेष मात्रा 48 घंटे में भेजी जा सकती है।`
          : language === "Hinglish"
            ? ` Hum abhi ${avail} ${unit} turant dispatch kar sakte hain aur baaki stock 48 hours mein bhej denge.`
            : ` We can dispatch ${avail} ${unit} from ready stock today and ship the balance within 48 hours.`;
    } else {
      snippet =
        language === "Hindi"
          ? " ऑर्डर कन्फर्म करने के लिए कृपया अपना पिनकोड साझा करें, हम UPI / बैंक विवरण भेज रहे हैं।"
          : language === "Hinglish"
            ? " Order lock karne ke liye apna delivery pincode bhejein, hum UPI details share kar rahe hain."
            : " Please share your delivery pincode to lock the stock and receive UPI/bank payment details.";
    }

    setAnalysisCard((current) =>
      current
        ? {
            ...current,
            analysis: {
              ...current.analysis,
              suggestedReply: `${current.analysis.suggestedReply.trim()}${snippet}`,
            },
          }
        : current,
    );
    toast.success("Added note to reply.");
  }

  function exportLeadsCsv() {
    if (filteredLeads.length === 0) {
      toast.error("No leads to export.");
      return;
    }
    const headers = [
      "Received At",
      "Customer Message",
      "Language",
      "Intent",
      "Matched Product",
      "Requested Qty",
      "DB Stock Qty",
      "Quoted Total INR",
      "Status",
      "Suggested Reply",
    ];
    const rows = filteredLeads.map((lead) => [
      lead.created_at,
      lead.customer_message,
      lead.detected_language,
      lead.intent,
      lead.matched_product?.name ?? "Unmatched",
      String(lead.extracted_quantity),
      String(lead.matched_product?.stock_quantity ?? 0),
      String(lead.quoted_total ?? ""),
      lead.status,
      lead.suggested_reply,
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `remedy-setu-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredLeads.length} leads.`);
  }

  async function copyReply(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Reply copied.");
    } catch {
      toast.error("Couldn't copy reply.");
    }
  }

  async function sendOnWhatsApp() {
    if (!analysisCard) return;
    const reply = analysisCard.analysis.suggestedReply;
    try {
      const dispatched = await dispatchWhatsAppFn({
        data: {
          leadId: analysisCard.lead.id,
          replyText: reply,
          ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
        },
      });
      const updated = dispatched.lead as Lead;
      setWorkspace((current) => ({
        ...current,
        leads: current.leads.map((lead) => (lead.id === updated.id ? updated : lead)),
      }));
      setAnalysisCard((current) =>
        current
          ? {
              ...current,
              lead: updated,
              analysis: { ...current.analysis, suggestedReply: updated.suggested_reply },
            }
          : current,
      );
      if (dispatched.mode === "cloud_api" && dispatched.dispatched) {
        toast.success("Sent via WhatsApp Cloud API.");
        return;
      }
      window.open(dispatched.whatsappUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Couldn't send WhatsApp reply.");
    }
  }

  async function handleSignOut() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
    }
    setWorkspace({ products: [], leads: [] });
    setAnalysisCard(null);
    setSession(null);
    await supabase.auth.signOut().catch(() => undefined);
  }

  if (authLoading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" aria-label="Loading sign-in" />
      </div>
    );
  if (!session)
    return (
      <main className="login-screen">
        <div className="login-content glass-panel">
          <div className="mb-5 flex justify-center">
            <RemedySetuLogo />
          </div>
          <h1>{isCreatingAccount ? "Create team account" : "Sign in"}</h1>
          <p className="login-description">
            Manage customer WhatsApp inquiries, live database inventory, and wholesale quotes.
          </p>
          <div className="provider-actions">
            <Button
              type="button"
              variant="secondary"
              className="w-full font-semibold"
              onClick={startInstantDemoSession}
            >
              Open Demo Workspace
            </Button>
          </div>
          <div className="provider-divider">
            <span />
            <span>OR USE EMAIL</span>
            <span />
          </div>
          <form className="login-form" onSubmit={signIn}>
            <label htmlFor="email" className="field-label">
              Work email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="you@remedysetu.com"
              className="field-input"
            />
            <label htmlFor="password" className="field-label">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete={isCreatingAccount ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              placeholder="At least 6 characters"
              className="field-input"
            />
            <Button type="submit" className="w-full" disabled={!email || !password}>
              {isCreatingAccount ? "Create account" : "Sign in"}
            </Button>
          </form>
          <div className="login-switch">
            <span>{isCreatingAccount ? "Already have an account?" : "Need an account?"}</span>
            <Button variant="link" onClick={() => setIsCreatingAccount((value) => !value)}>
              {isCreatingAccount ? "Sign in" : "Create account"}
            </Button>
          </div>
        </div>
      </main>
    );

  return (
    <main className="workspace-shell">
      <header className="topbar glass-topbar">
        <a href="#workspace" className="topbar-brand" aria-label="Remedy Setu home">
          <RemedySetuLogo />
        </a>
        <nav className="primary-nav" aria-label="Workspace views">
          <NavButton active={activeTab === "assistant"} onClick={() => setActiveTab("assistant")}>
            Reply Assistant
          </NavButton>
          <NavButton active={activeTab === "leads"} onClick={() => setActiveTab("leads")}>
            Leads <span className="nav-count">{workspace.leads.length}</span>
          </NavButton>
          <NavButton active={activeTab === "catalog"} onClick={() => setActiveTab("catalog")}>
            Inventory & Rates <span className="nav-count">{totalFixedStockUnits}</span>
          </NavButton>
          <NavButton
            active={activeTab === "insights"}
            onClick={() => {
              setActiveTab("insights");
              if (!aiInsightsData) void refreshAiInsights();
            }}
          >
            Insights & Features
          </NavButton>
        </nav>
        <div className="account-control">
          <span className="online-indicator" />
          <span className="account-email">{session.user.email}</span>
          <Button
            variant="ghost"
            size="icon"
            title="Sign out"
            aria-label="Sign out"
            onClick={() => void handleSignOut()}
          >
            <LogOut />
          </Button>
        </div>
      </header>

      <div className="workspace-content" id="workspace">
        <section className="kpi-ribbon" aria-label="Workspace stock and sales summary">
          <div className="kpi-card glass-panel">
            <span className="kpi-label">Open Leads</span>
            <strong>
              {openLeads} <span>/ {workspace.leads.length} total</span>
            </strong>
          </div>
          <div className="kpi-card glass-panel">
            <span className="kpi-label">Quote Pipeline</span>
            <strong>
              {formatRupees(computedInsights.pipelineMetrics.totalPipelineInr)}{" "}
              <span>
                ({formatRupees(computedInsights.pipelineMetrics.convertedRevenueInr)} converted)
              </span>
            </strong>
          </div>
          <div className="kpi-card glass-panel">
            <span className="kpi-label">Available DB Stock</span>
            <strong>
              {totalFixedStockUnits} <span>units ({workspace.products.length} SKUs)</span>
            </strong>
          </div>
          <div className="kpi-card glass-panel">
            <span className="kpi-label">Stock Health</span>
            <strong>
              {computedInsights.pipelineMetrics.outOfStockCount === 0
                ? "All In Stock"
                : `${computedInsights.pipelineMetrics.outOfStockCount} Out of Stock`}{" "}
              <span>({computedInsights.pipelineMetrics.lowStockCount} low stock)</span>
            </strong>
          </div>
        </section>

        {activeTab === "assistant" && (
          <section className="assistant-grid" aria-label="WhatsApp reply assistant">
            <div className="input-column">
              <section className="workspace-section glass-panel">
                <SectionHeading
                  title="Customer Inquiry"
                  subtitle="Paste a WhatsApp message in English, Hindi, or Hinglish to check DB stock and generate a quote."
                />
                <form onSubmit={generateReply}>
                  <Textarea
                    aria-label="Customer WhatsApp message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="e.g. Neelam 5 ratti rate? or Neelam 60 ratti stock hai kya?"
                    className="message-input"
                    maxLength={4000}
                    required
                  />
                  <div className="message-meta">
                    <span>{message.length}/4,000</span>
                    <span>English / Hindi / Hinglish</span>
                  </div>
                  <Button
                    type="submit"
                    className="generate-button w-full"
                    disabled={analyzing || !message.trim()}
                  >
                    {analyzing && <LoaderCircle className="animate-spin" />}
                    {analyzing ? "Checking DB stock…" : "Check Stock & Generate Reply"}
                  </Button>
                </form>
              </section>

              <section className="workspace-section glass-panel">
                <SectionHeading
                  title="Quick DB Stock Checker"
                  subtitle="Check whether a specific product quantity is available in the database."
                />
                <div className="simulator-controls">
                  <label className="simulator-field">
                    <span>PRODUCT</span>
                    <div className="select-wrap w-full">
                      <select
                        aria-label="Select product to check stock"
                        className="w-full"
                        value={selectedCheckerProduct?.id ?? ""}
                        onChange={(event) => {
                          setCheckerProductId(event.target.value);
                          setLiveStockCheck(null);
                        }}
                      >
                        {workspace.products.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({getAvailableStockQuantity(item)} {item.unit} in DB)
                          </option>
                        ))}
                      </select>
                      <ChevronDown />
                    </div>
                  </label>
                  <label className="simulator-field simulator-qty-field">
                    <span>QTY ({selectedCheckerProduct?.unit ?? "units"})</span>
                    <Input
                      type="number"
                      min={1}
                      max={10000}
                      value={checkerQuantity}
                      onChange={(event) => {
                        setCheckerQuantity(Math.max(1, Number(event.target.value) || 1));
                        setLiveStockCheck(null);
                      }}
                      aria-label="Quantity to check"
                    />
                  </label>
                </div>

                {instantStockCheck && (
                  <div
                    className={`stock-check-banner status-${instantStockCheck.stockStatus.toLowerCase()}`}
                  >
                    <div className="stock-check-header">
                      <strong>
                        {instantStockCheck.isAvailable
                          ? "Available in DB"
                          : instantStockCheck.stockStatus === "INSUFFICIENT_STOCK"
                            ? "Insufficient DB Stock"
                            : "Out of Stock"}
                      </strong>
                      <span>
                        DB Stock: <b>{instantStockCheck.availableStock}</b> {instantStockCheck.unit}
                      </span>
                    </div>
                    <p>{instantStockCheck.summaryMessage}</p>
                    <div className="stock-check-metrics">
                      <div>
                        <span>Unit Rate</span>
                        <strong>
                          {formatRupees(instantStockCheck.unitRate)} / {instantStockCheck.unit}
                        </strong>
                      </div>
                      <div>
                        <span>Total Quote</span>
                        <strong>{formatRupees(instantStockCheck.quotedTotal)}</strong>
                      </div>
                      <div>
                        <span>Tier Savings</span>
                        <strong>
                          {instantStockCheck.savingsVsRetail > 0
                            ? formatRupees(instantStockCheck.savingsVsRetail)
                            : "Standard"}
                        </strong>
                      </div>
                    </div>
                    <div className="simulator-actions">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={checkingStockDb}
                        onClick={() => void verifyStockInDatabase()}
                      >
                        <RefreshCw className={checkingStockDb ? "animate-spin" : ""} />
                        Check DB
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setMessage(
                            `Do you have ${instantStockCheck.requestedQuantity} ${instantStockCheck.unit} of ${instantStockCheck.productName} available in stock? Please share the rate.`,
                          );
                        }}
                      >
                        Use in Assistant
                      </Button>
                    </div>
                  </div>
                )}
              </section>

              <div className="sample-section glass-panel">
                <p className="sample-label">Sample Messages</p>
                <div className="sample-list">
                  {samples.map((sample) => (
                    <Button
                      key={sample}
                      type="button"
                      variant="ghost"
                      className="sample-item"
                      onClick={() => setMessage(sample)}
                    >
                      <span>{sample}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="output-column">
              {!analysisCard ? (
                <div className="empty-reply glass-panel">
                  <h2>No inquiry selected</h2>
                  <p>
                    Enter a customer message or pick a sample on the left to check database stock
                    availability, calculate tier pricing, and generate a reply.
                  </p>
                </div>
              ) : (
                <section className="reply-result glass-panel">
                  <div className="result-header">
                    <h2>Generated Reply & Quote</h2>
                    <span className="saved-indicator">Saved</span>
                  </div>
                  <div className="signal-row">
                    <span className="signal-label">Intent</span>
                    <span className="signal-chip">
                      {intentLabels[analysisCard.analysis.intent]}
                    </span>
                    <span className="signal-label">Language</span>
                    <span className="language-chip">{analysisCard.analysis.language}</span>
                    {analysisCard.analysis.provider && (
                      <>
                        <span className="signal-label">Engine</span>
                        <span className="signal-chip">
                          {analysisCard.analysis.provider.toUpperCase()}
                        </span>
                      </>
                    )}
                  </div>

                  {analysisCard.lead.matched_product && (
                    <div
                      className={`db-stock-verification-box status-${analysisCard.analysis.stockStatus.toLowerCase()}`}
                    >
                      <div className="db-stock-top">
                        <div>
                          <span className="db-stock-badge">
                            {analysisCard.analysis.stockStatus === "AVAILABLE"
                              ? "AVAILABLE IN DB"
                              : analysisCard.analysis.stockStatus === "INSUFFICIENT_STOCK"
                                ? "INSUFFICIENT DB STOCK"
                                : "OUT OF STOCK"}
                          </span>
                          <strong>
                            {analysisCard.analysis.stockStatus === "AVAILABLE"
                              ? `Yes — ${analysisCard.analysis.quantity} ${analysisCard.lead.matched_product.unit} available (${analysisCard.analysis.availableStock} ${analysisCard.lead.matched_product.unit} in DB)`
                              : analysisCard.analysis.stockStatus === "INSUFFICIENT_STOCK"
                                ? `No — Requested ${analysisCard.analysis.quantity} ${analysisCard.lead.matched_product.unit}, only ${analysisCard.analysis.availableStock ?? 0} ${analysisCard.lead.matched_product.unit} in DB (Short by ${analysisCard.analysis.stockShortfall} ${analysisCard.lead.matched_product.unit})`
                                : `No — 0 ${analysisCard.lead.matched_product.unit} available in DB`}
                          </strong>
                        </div>
                        <span className="db-stock-remaining">
                          {analysisCard.analysis.stockStatus === "AVAILABLE"
                            ? `${(analysisCard.analysis.availableStock ?? 0) - analysisCard.analysis.quantity} ${analysisCard.lead.matched_product.unit} left after order`
                            : `${analysisCard.analysis.availableStock ?? 0} ${analysisCard.lead.matched_product.unit} on hand`}
                        </span>
                      </div>
                      <div className="stock-meter-track" aria-hidden="true">
                        <div
                          className="stock-meter-fill"
                          style={{
                            width: `${Math.min(
                              100,
                              analysisCard.analysis.availableStock &&
                                analysisCard.analysis.availableStock > 0
                                ? Math.round(
                                    (analysisCard.analysis.quantity /
                                      analysisCard.analysis.availableStock) *
                                      100,
                                  )
                                : 100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="quote-panel">
                    <div className="quote-product">
                      <div>
                        <strong>
                          {analysisCard.lead.matched_product?.name ?? "Product not matched"}
                        </strong>
                        <span>
                          {analysisCard.lead.matched_product?.hindi_name ??
                            "Confirm product details"}
                        </span>
                      </div>
                      {analysisCard.lead.matched_product && (
                        <span
                          className={`stock-status ${analysisCard.lead.matched_product.in_stock ? "" : "unavailable"}`}
                        >
                          <span
                            className={
                              analysisCard.lead.matched_product.in_stock
                                ? "stock-dot"
                                : "stock-dot out-of-stock"
                            }
                          />
                          {analysisCard.lead.matched_product.in_stock
                            ? `${analysisCard.analysis.availableStock ?? getAvailableStockQuantity(analysisCard.lead.matched_product)} ${analysisCard.lead.matched_product.unit} in stock`
                            : "Out of stock"}
                        </span>
                      )}
                    </div>
                    {analysisCard.lead.matched_product ? (
                      <>
                        <div className="quote-breakdown">
                          <QuoteItem
                            label="Unit rate"
                            value={`${formatRupees(analysisCard.analysis.unitRate ?? 0)} / ${analysisCard.lead.matched_product.unit}`}
                          />
                          <QuoteItem
                            label="Requested / Available"
                            value={`${analysisCard.analysis.quantity} / ${analysisCard.analysis.availableStock ?? 0} ${analysisCard.lead.matched_product.unit}`}
                          />
                          <QuoteItem
                            label="Tier"
                            value={quantityTier(analysisCard.analysis.quantity)}
                          />
                        </div>
                        <div className="quote-total">
                          <div>
                            <span>TOTAL QUOTE</span>
                            {analysisCard.analysis.aiInsights.savingsVsRetail > 0 && (
                              <small className="tier-savings-pill">
                                Saves{" "}
                                {formatRupees(analysisCard.analysis.aiInsights.savingsVsRetail)} vs
                                retail
                              </small>
                            )}
                          </div>
                          <strong>{formatRupees(analysisCard.analysis.quotedTotal ?? 0)}</strong>
                        </div>
                      </>
                    ) : (
                      <p className="unmatched-note">
                        No catalogue match found. Verify the product name and quantity.
                      </p>
                    )}
                  </div>

                  <div className="ai-coach-panel">
                    <div className="ai-coach-header">
                      <span>AI Deal Insights</span>
                      <div className="ai-coach-badges">
                        <span
                          className={`urgency-pill urgency-${analysisCard.analysis.aiInsights.urgency.toLowerCase()}`}
                        >
                          {analysisCard.analysis.aiInsights.urgency}
                        </span>
                        <span className="conversion-pill">
                          {analysisCard.analysis.aiInsights.conversionProbability}% conversion
                        </span>
                      </div>
                    </div>
                    <p className="ai-coach-action">
                      <strong>Action:</strong> {analysisCard.analysis.aiInsights.recommendedAction}
                    </p>
                    {analysisCard.analysis.aiInsights.tierNudge && (
                      <div className="ai-tier-nudge">
                        <span>
                          <strong>Tier Nudge:</strong> {analysisCard.analysis.aiInsights.tierNudge}
                        </span>
                      </div>
                    )}
                    {analysisCard.analysis.aiInsights.upsellSuggestion && (
                      <p className="ai-upsell-note">
                        <strong>Add-on:</strong> {analysisCard.analysis.aiInsights.upsellSuggestion}
                      </p>
                    )}
                  </div>

                  <div className="reply-enhancer-bar">
                    <span className="reply-enhancer-label">Add note:</span>
                    <button
                      type="button"
                      className="enhancer-chip"
                      onClick={() => appendSmartEnhancer("certificate")}
                    >
                      + Lab Certificate
                    </button>
                    <button
                      type="button"
                      className="enhancer-chip"
                      onClick={() => appendSmartEnhancer("tier")}
                    >
                      + Tier Discount
                    </button>
                    {analysisCard.analysis.stockStatus === "INSUFFICIENT_STOCK" && (
                      <button
                        type="button"
                        className="enhancer-chip"
                        onClick={() => appendSmartEnhancer("partial")}
                      >
                        + Partial Dispatch
                      </button>
                    )}
                    <button
                      type="button"
                      className="enhancer-chip"
                      onClick={() => appendSmartEnhancer("payment")}
                    >
                      + UPI Details
                    </button>
                  </div>

                  <label className="reply-label" htmlFor="suggested-reply">
                    WHATSAPP REPLY
                  </label>
                  <Textarea
                    id="suggested-reply"
                    value={analysisCard.analysis.suggestedReply}
                    onChange={(event) =>
                      setAnalysisCard((current) =>
                        current
                          ? {
                              ...current,
                              analysis: {
                                ...current.analysis,
                                suggestedReply: event.target.value,
                              },
                            }
                          : current,
                      )
                    }
                    className="reply-editor"
                    maxLength={4000}
                  />
                  <div className="mb-3">
                    <Input
                      type="tel"
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      placeholder="Customer WhatsApp number (optional, e.g. +91 98765 43210)"
                      aria-label="Customer WhatsApp number"
                    />
                  </div>
                  <div className="result-actions">
                    <Button
                      variant="outline"
                      onClick={() => void copyReply(analysisCard.analysis.suggestedReply)}
                    >
                      <Clipboard />
                      Copy reply
                    </Button>
                    {analysisCard.lead.matched_product &&
                      analysisCard.lead.status !== "CONVERTED" &&
                      (analysisCard.analysis.availableStock ?? 0) > 0 && (
                        <Button
                          variant="secondary"
                          disabled={fulfillingLeadId === analysisCard.lead.id}
                          onClick={() => void handleFulfillLead(analysisCard.lead)}
                        >
                          <PackageCheck />
                          {fulfillingLeadId === analysisCard.lead.id
                            ? "Deducting…"
                            : "Fulfill & Deduct Stock"}
                        </Button>
                      )}
                    <Button className="whatsapp-button" onClick={() => void sendOnWhatsApp()}>
                      <MessageCircle />
                      Send on WhatsApp
                    </Button>
                  </div>
                </section>
              )}
            </div>
          </section>
        )}

        {activeTab === "leads" && (
          <section className="listing-section glass-panel">
            <div className="listing-heading">
              <SectionHeading
                title={`Saved Leads (${workspace.leads.length})`}
                subtitle={`${openLeads} open inquiries awaiting reply.`}
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={exportLeadsCsv}>
                  <Download />
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void refreshWorkspace()}
                  disabled={loadingWorkspace}
                >
                  <RefreshCw className={loadingWorkspace ? "animate-spin" : ""} />
                  Refresh
                </Button>
              </div>
            </div>
            <div className="filter-bar">
              <label className="search-field">
                <Search />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search saved leads"
                  placeholder="Search messages or products…"
                />
              </label>
              <label className="filter-field">
                <span>INTENT</span>
                <div className="select-wrap">
                  <select
                    aria-label="Filter leads by intent"
                    value={intentFilter}
                    onChange={(event) => setIntentFilter(event.target.value as IntentFilter)}
                  >
                    <option value="ALL">All inquiries</option>
                    {Object.entries(intentLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown />
                </div>
              </label>
              <label className="filter-field">
                <span>STATUS</span>
                <div className="select-wrap">
                  <select
                    aria-label="Filter leads by status"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  >
                    <option value="ALL">All statuses</option>
                    <option value="NEW">New</option>
                    <option value="REPLIED">Replied</option>
                    <option value="CONVERTED">Converted</option>
                  </select>
                  <ChevronDown />
                </div>
              </label>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>RECEIVED</th>
                    <th>CUSTOMER MESSAGE</th>
                    <th>INTENT</th>
                    <th>PRODUCT & QUOTE</th>
                    <th>DB STOCK</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => {
                    const avail = lead.matched_product
                      ? getAvailableStockQuantity(lead.matched_product)
                      : null;
                    const enough = avail != null && avail >= lead.extracted_quantity;
                    return (
                      <tr key={lead.id}>
                        <td className="time-cell">{formatDate(lead.created_at)}</td>
                        <td className="message-cell">
                          <span>{lead.customer_message}</span>
                        </td>
                        <td>
                          <IntentBadge intent={lead.intent} />
                        </td>
                        <td className="price-cell">
                          {lead.matched_product
                            ? `${lead.matched_product.name} (${lead.extracted_quantity} ${lead.matched_product.unit})`
                            : "—"}
                          <span>
                            {lead.quoted_total == null
                              ? "Not quoted"
                              : formatRupees(lead.quoted_total)}
                          </span>
                        </td>
                        <td>
                          {lead.matched_product ? (
                            <span
                              className={`stock-pill ${
                                avail === 0
                                  ? "stock-pill-out"
                                  : enough
                                    ? "stock-pill-ok"
                                    : "stock-pill-low"
                              }`}
                            >
                              {avail === 0
                                ? `0 ${lead.matched_product.unit}`
                                : enough
                                  ? `${avail} ${lead.matched_product.unit} available`
                                  : `${avail} / ${lead.extracted_quantity} ${lead.matched_product.unit}`}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Unmatched</span>
                          )}
                        </td>
                        <td>
                          <select
                            aria-label={`Update status for ${lead.customer_message.slice(0, 36)}`}
                            className={`status-select status-${lead.status.toLowerCase()}`}
                            value={lead.status}
                            onChange={(event) =>
                              void updateLead(lead.id, {
                                status: event.target.value as Lead["status"],
                              })
                            }
                          >
                            <option value="NEW">New</option>
                            <option value="REPLIED">Replied</option>
                            <option value="CONVERTED">Converted</option>
                          </select>
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1.5">
                            {lead.matched_product &&
                              lead.status !== "CONVERTED" &&
                              (avail ?? 0) > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={fulfillingLeadId === lead.id}
                                  onClick={() => void handleFulfillLead(lead)}
                                >
                                  Fulfill
                                </Button>
                              )}
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`View saved reply for ${lead.customer_message.slice(0, 36)}`}
                              onClick={() => setSelectedLead(lead)}
                            >
                              Edit Reply
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredLeads.length === 0 && (
                <EmptyListing loading={loadingWorkspace} kind="leads" />
              )}
            </div>
          </section>
        )}

        {activeTab === "catalog" && (
          <section className="listing-section glass-panel">
            <div className="listing-heading">
              <SectionHeading
                title="Product Catalogue & Fixed DB Stock"
                subtitle={`${workspace.products.length} products · ${totalFixedStockUnits} total units in stock.`}
              />
              <Button
                variant="outline"
                onClick={() => void refreshWorkspace()}
                disabled={loadingWorkspace}
              >
                <RefreshCw className={loadingWorkspace ? "animate-spin" : ""} />
                Refresh
              </Button>
            </div>
            <div className="catalog-filter-row">
              <div
                className="category-pills"
                role="group"
                aria-label="Filter catalogue by category"
              >
                <button
                  type="button"
                  className={`category-pill ${categoryFilter === "ALL" ? "active" : ""}`}
                  onClick={() => setCategoryFilter("ALL")}
                >
                  All ({workspace.products.length})
                </button>
                {(Object.entries(categoryLabels) as Array<[ProductCategory, string]>).map(
                  ([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`category-pill ${categoryFilter === key ? "active" : ""}`}
                      onClick={() => setCategoryFilter(key)}
                    >
                      {label}
                    </button>
                  ),
                )}
              </div>
            </div>
            <div className="table-wrap">
              <table className="data-table catalog-table">
                <thead>
                  <tr>
                    <th>PRODUCT</th>
                    <th>CATEGORY</th>
                    <th>UNIT</th>
                    <th>RETAIL</th>
                    <th>10–49 UNITS</th>
                    <th>50–99 UNITS</th>
                    <th>100+ UNITS</th>
                    <th>FIXED DB STOCK</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const currentStock = getAvailableStockQuantity(product);
                    const draftValue = stockDrafts[product.id] ?? currentStock;
                    const isDirty = draftValue !== currentStock;
                    return (
                      <tr key={product.id}>
                        <td className="catalog-name">
                          <strong>{product.name}</strong>
                          <span>
                            {product.hindi_name} — {product.description}
                          </span>
                        </td>
                        <td>{categoryLabels[product.category]}</td>
                        <td>{product.unit}</td>
                        <td className="retail-price">{formatRupees(product.base_price)}</td>
                        <td>{formatOptionalRupees(product.tier10_plus_price)}</td>
                        <td>{formatOptionalRupees(product.tier50_plus_price)}</td>
                        <td className="bulk-price">
                          {formatOptionalRupees(product.tier100_plus_price)}
                        </td>
                        <td>
                          <div className="stock-qty-editor">
                            <button
                              type="button"
                              className="qty-step-btn"
                              title="Decrease stock by 5"
                              aria-label={`Decrease stock for ${product.name}`}
                              disabled={updatingStockId === product.id || currentStock <= 0}
                              onClick={() =>
                                void saveFixedStockQuantity(product, Math.max(0, currentStock - 5))
                              }
                            >
                              <Minus className="size-3" />
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={100000}
                              aria-label={`Fixed stock quantity for ${product.name}`}
                              className="stock-qty-input"
                              value={draftValue}
                              onChange={(event) =>
                                setStockDrafts((current) => ({
                                  ...current,
                                  [product.id]: Math.max(0, Number(event.target.value) || 0),
                                }))
                              }
                            />
                            <span className="stock-unit-label">{product.unit}</span>
                            <button
                              type="button"
                              className="qty-step-btn"
                              title="Increase stock by 5"
                              aria-label={`Increase stock for ${product.name}`}
                              disabled={updatingStockId === product.id}
                              onClick={() => void saveFixedStockQuantity(product, currentStock + 5)}
                            >
                              <Plus className="size-3" />
                            </button>
                            {isDirty && (
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={updatingStockId === product.id}
                                onClick={() => void saveFixedStockQuantity(product, draftValue)}
                              >
                                Save
                              </Button>
                            )}
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => void toggleStock(product)}
                            title="Click to toggle stock availability"
                            className={`stock-status cursor-pointer border-0 bg-transparent p-0 ${product.in_stock && currentStock > 0 ? "" : "unavailable"}`}
                          >
                            <span
                              className={
                                product.in_stock && currentStock > 0
                                  ? "stock-dot"
                                  : "stock-dot out-of-stock"
                              }
                            />
                            {product.in_stock && currentStock > 0
                              ? currentStock <= 35
                                ? `Low (${currentStock})`
                                : `In stock (${currentStock})`
                              : "Out (0)"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredProducts.length === 0 && (
                <EmptyListing loading={loadingWorkspace} kind="products" />
              )}
            </div>
          </section>
        )}

        {activeTab === "insights" && (
          <div className="insights-stack">
            <section className="listing-section glass-panel">
              <div className="listing-heading">
                <div>
                  <h2>{computedInsights.headline}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{computedInsights.summary}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => void refreshAiInsights()}
                  disabled={loadingInsights}
                >
                  <RefreshCw className={loadingInsights ? "animate-spin" : ""} />
                  {loadingInsights ? "Refreshing…" : "Refresh Insights"}
                </Button>
              </div>

              <div className="recommendations-grid">
                {computedInsights.strategicRecommendations.map((rec) => (
                  <div key={rec.title} className="recommendation-card">
                    <div className="recommendation-top">
                      <span className="rec-category">{rec.category}</span>
                      <span className={`rec-impact impact-${rec.impact.toLowerCase()}`}>
                        {rec.impact}
                      </span>
                    </div>
                    <h3>{rec.title}</h3>
                    <p>{rec.detail}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="listing-section glass-panel">
              <div className="listing-heading">
                <SectionHeading
                  title="DB Stock vs. Open Lead Demand"
                  subtitle="Compares fixed database inventory against active customer inquiries."
                />
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>PRODUCT</th>
                      <th>DB STOCK</th>
                      <th>OPEN DEMAND</th>
                      <th>STATUS</th>
                      <th>RECOMMENDATION</th>
                      <th>RESTOCK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedInsights.stockAlerts.map((alert) => {
                      const productObj = workspace.products.find((p) => p.id === alert.productId);
                      return (
                        <tr key={alert.productId}>
                          <td>
                            <strong>{alert.productName}</strong>
                          </td>
                          <td>
                            <strong>
                              {alert.availableStock} {alert.unit}
                            </strong>
                          </td>
                          <td>
                            {alert.openLeadDemand} {alert.unit}
                          </td>
                          <td>
                            <span
                              className={`stock-pill ${
                                alert.status === "CRITICAL" ||
                                alert.status === "DEMAND_EXCEEDS_STOCK"
                                  ? "stock-pill-out"
                                  : alert.status === "LOW"
                                    ? "stock-pill-low"
                                    : "stock-pill-ok"
                              }`}
                            >
                              {alert.status.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="text-xs text-muted-foreground">{alert.recommendation}</td>
                          <td>
                            {productObj && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={updatingStockId === productObj.id}
                                onClick={() =>
                                  void saveFixedStockQuantity(productObj, alert.availableStock + 50)
                                }
                              >
                                +50 {alert.unit}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="listing-section glass-panel">
              <div className="listing-heading">
                <SectionHeading
                  title="Workspace Features"
                  subtitle="Capabilities enabled in this sales and inventory desk."
                />
              </div>
              <div className="features-grid">
                {PLATFORM_FEATURES.map((feature) => (
                  <article key={feature.id} className="feature-card">
                    <div className="feature-card-top">
                      <span className="feature-category-tag">
                        {featureCategoryLabels[feature.category]}
                      </span>
                      <span className="feature-badge">{feature.badge}</span>
                    </div>
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                    <ul className="feature-highlights">
                      {feature.highlights.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {selectedLead && (
        <div
          className="dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedLead(null);
          }}
        >
          <section
            className="lead-dialog glass-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-dialog-title"
          >
            <div className="dialog-heading">
              <h2 id="lead-dialog-title">Saved Lead Details</h2>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Close lead details"
                onClick={() => setSelectedLead(null)}
              >
                Close
              </Button>
            </div>
            <div className="dialog-message">
              <span>CUSTOMER MESSAGE</span>
              <p>{selectedLead.customer_message}</p>
            </div>
            <div className="dialog-reply">
              <span>REPLY</span>
              <Textarea
                value={selectedLead.suggested_reply}
                onChange={(event) =>
                  setSelectedLead({ ...selectedLead, suggested_reply: event.target.value })
                }
                className="reply-editor"
              />
            </div>
            <div className="dialog-actions">
              <Button
                variant="ghost"
                onClick={() => void deleteLead(selectedLead.id)}
                aria-label="Delete saved lead"
              >
                <Trash2 />
                Delete
              </Button>
              <Button
                variant="outline"
                onClick={() => void copyReply(selectedLead.suggested_reply)}
              >
                <Clipboard />
                Copy reply
              </Button>
              <Button
                disabled={savingReply}
                onClick={() => {
                  setSavingReply(true);
                  void updateLead(selectedLead.id, {
                    suggestedReply: selectedLead.suggested_reply,
                  })
                    .then((updated) => {
                      if (updated) toast.success("Reply saved.");
                    })
                    .finally(() => setSavingReply(false));
                }}
              >
                {savingReply ? "Saving…" : "Save reply"}
              </Button>
            </div>
          </section>
        </div>
      )}

      <footer className="workspace-footer glass-topbar">
        <span>Remedy Setu</span>
        <div className="footer-meta">
          {workspace.connectors && (
            <>
              <span>AI: {workspace.connectors.ai.provider.toUpperCase()}</span>
              <span>
                DB:{" "}
                {workspace.connectors.database.provider === "supabase-postgres"
                  ? "Supabase"
                  : "Memory"}
              </span>
            </>
          )}
          <span>{session.user.email}</span>
        </div>
      </footer>
    </main>
  );
}

function RemedySetuLogo() {
  return (
    <img
      src="/remedy-setu-logo.svg"
      alt="Remedy Setu"
      className="brand-logo"
      width={185}
      height={44}
    />
  );
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      className={`nav-button ${active ? "active" : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}

function QuoteItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="quote-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function IntentBadge({ intent }: { intent: Lead["intent"] }) {
  return (
    <span className={`intent-badge intent-${intent.toLowerCase()}`}>{intentLabels[intent]}</span>
  );
}

function EmptyListing({ loading, kind }: { loading: boolean; kind: "leads" | "products" }) {
  return (
    <div className="empty-listing">
      {loading && <LoaderCircle className="animate-spin" />}
      <span>
        {loading
          ? "Loading workspace…"
          : kind === "leads"
            ? "No matching leads found."
            : "No products found."}
      </span>
    </div>
  );
}

function formatRupees(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatOptionalRupees(amount: number | null): string {
  return amount == null ? "—" : formatRupees(amount);
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
function quantityTier(quantity: number): string {
  return quantity >= 100
    ? "100+ units"
    : quantity >= 50
      ? "50–99 units"
      : quantity >= 10
        ? "10–49 units"
        : "Standard";
}
