import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  Clipboard,
  Gem,
  Languages,
  LoaderCircle,
  LogOut,
  MessageCircle,
  PackageCheck,
  Search,
  Send,
  Sparkles,
  Tags,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import type { Database } from "@/integrations/supabase/types";
import {
  analyzeCustomerMessage,
  deleteSavedLead,
  dispatchWhatsAppReply,
  getWorkspaceData,
  toggleProductStock,
  updateSavedLead,
  type ConnectorStatusSummary,
} from "@/lib/remedy.functions";
import type { AnalysisResult } from "@/lib/remedy-analysis";

type Product = Database["public"]["Tables"]["remedy_products"]["Row"];
type Lead = Database["public"]["Tables"]["remedy_leads"]["Row"] & {
  matched_product: Product | null;
};
type WorkspaceTab = "assistant" | "leads" | "catalog";
type IntentFilter = "ALL" | Database["public"]["Enums"]["remedy_lead_intent"];
type AnalysisCard = { analysis: AnalysisResult; lead: Lead };

const samples = [
  "Neelam ka rate kya hai 5 ratti?",
  "Rudraksha 100 pcs chahiye bulk rate batao",
  "Do you have certified Yellow Sapphire 6.25 ratti in stock?",
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Remedy Setu — Sales Desk" },
      {
        name: "description",
        content:
          "A multilingual WhatsApp reply assistant, customer lead desk, and wholesale spiritual-products catalogue.",
      },
      { property: "og:title", content: "Remedy Setu — Sales Desk" },
      {
        property: "og:description",
        content: "Prepare customer replies, keep shared sales leads, and verify product rates.",
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
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const loadWorkspace = useServerFn(getWorkspaceData);
  const analyzeMessageFn = useServerFn(analyzeCustomerMessage);
  const updateLeadFn = useServerFn(updateSavedLead);
  const deleteLeadFn = useServerFn(deleteSavedLead);
  const toggleStockFn = useServerFn(toggleProductStock);
  const dispatchWhatsAppFn = useServerFn(dispatchWhatsAppReply);

  const refreshWorkspace = useCallback(async () => {
    setLoadingWorkspace(true);
    try {
      const data = await loadWorkspace();
      setWorkspace({
        products: data.products,
        leads: data.leads as Lead[],
        connectors: data.connectors,
      });
    } catch {
      toast.error("Couldn't load your shared sales workspace.");
    } finally {
      setLoadingWorkspace(false);
    }
  }, [loadWorkspace]);

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
      if (mounted) {
        setSession(newSession ?? null);
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

  const openLeads = useMemo(
    () => workspace.leads.filter((lead) => lead.status === "NEW").length,
    [workspace.leads],
  );
  const filteredLeads = useMemo(
    () =>
      workspace.leads.filter((lead) => {
        const matchesIntent = intentFilter === "ALL" || lead.intent === intentFilter;
        const normalizedSearch = search.trim().toLocaleLowerCase();
        const matchesSearch =
          !normalizedSearch ||
          `${lead.customer_message} ${lead.matched_product?.name ?? ""} ${lead.suggested_reply}`
            .toLocaleLowerCase()
            .includes(normalizedSearch);
        return matchesIntent && matchesSearch;
      }),
    [workspace.leads, intentFilter, search],
  );

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (isCreatingAccount) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error && !/already registered/i.test(error.message)) {
          toast.error(error.message);
          return;
        }
        if (data?.session) {
          setSession(data.session);
          toast.success("Account created — welcome to Remedy Setu.");
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
          toast.success("Account ready — welcome to Remedy Setu.");
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
        toast.success("Signed in to the Remedy Setu sales desk.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed.");
    }
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
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
      toast.success("Reply ready — this inquiry is saved.");
    } catch {
      toast.error("Couldn't prepare a reply. Your message is still here; please try again.");
    } finally {
      setAnalyzing(false);
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
      toast.error("Couldn't save your changes. Please try again.");
      return null;
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
      toast.success("Lead removed from your workspace.");
    } catch {
      toast.error("Couldn't remove this lead.");
    }
  }

  async function toggleStock(product: Product) {
    try {
      const updated = await toggleStockFn({
        data: { id: product.id, inStock: !product.in_stock },
      });
      setWorkspace((current) => ({
        ...current,
        products: current.products.map((item) => (item.id === product.id ? updated : item)),
      }));
      toast.success(`${updated.name} marked as ${updated.in_stock ? "In stock" : "Out of stock"}.`);
    } catch {
      toast.error("Couldn't update product stock status.");
    }
  }

  async function copyReply(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Reply copied.");
    } catch {
      toast.error("Couldn't copy this reply.");
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
        toast.success("Dispatched directly via WhatsApp Business Cloud API.");
        return;
      }
      window.open(dispatched.whatsappUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Couldn't dispatch WhatsApp reply. Please try again.");
    }
  }

  async function handleSignOut() {
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
        <div className="login-brand">
          <BrandMark />
          <div>
            <span className="brand-name">Remedy Setu</span>
            <span className="brand-caption">Sales desk</span>
          </div>
        </div>
        <div className="login-content">
          <div className="eyebrow">
            <span className="eyebrow-mark" /> RETAIL & ASTROLOGY PARTNERS
          </div>
          <h1>
            Better conversations
            <br />
            begin <span>with care.</span>
          </h1>
          <p className="login-description">
            Your shared desk for customer replies, product rates, and every next step.
          </p>
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
              placeholder="you@company.com"
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
              {isCreatingAccount ? "Create team account" : "Sign in to the sales desk"}
              <ArrowUpRight />
            </Button>
          </form>
          <div className="login-switch">
            <span>{isCreatingAccount ? "Already have an account?" : "New to the sales desk?"}</span>
            <Button variant="link" onClick={() => setIsCreatingAccount((value) => !value)}>
              {isCreatingAccount ? "Sign in" : "Create an account"}
            </Button>
          </div>
          <div className="provider-divider">
            <span />
            <span>OR CONTINUE WITH</span>
            <span />
          </div>
          <div className="provider-actions">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void signInWithGoogle()}
            >
              <GoogleMark />
              Continue with Google
            </Button>
          </div>
          <p className="login-footnote">
            Team leads and prices stay in your shared, signed-in workspace.
          </p>
        </div>
      </main>
    );

  return (
    <main className="workspace-shell">
      <header className="topbar">
        <a href="#workspace" className="topbar-brand" aria-label="Remedy Setu home">
          <BrandMark />
          <span className="brand-name">Remedy Setu</span>
          <span className="brand-divider" />
          <span className="topbar-label">SALES DESK</span>
        </a>
        <nav className="primary-nav" aria-label="Workspace views">
          <NavButton active={activeTab === "assistant"} onClick={() => setActiveTab("assistant")}>
            <WandSparkles />
            Reply assistant
          </NavButton>
          <NavButton active={activeTab === "leads"} onClick={() => setActiveTab("leads")}>
            Saved leads <span className="nav-count">{workspace.leads.length}</span>
          </NavButton>
          <NavButton active={activeTab === "catalog"} onClick={() => setActiveTab("catalog")}>
            <Tags />
            Price list
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
        <div className="workspace-heading">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-mark" /> REMEDY SETU · TEAM WORKSPACE
            </div>
            <h1>
              {activeTab === "assistant"
                ? "Every reply, a little more personal."
                : activeTab === "leads"
                  ? "The customer conversation, continued."
                  : "Thoughtful goods. Clear rates."}
            </h1>
            <p>
              {activeTab === "assistant"
                ? "Understand the request. Share a considered reply. Keep the whole team in the loop."
                : activeTab === "leads"
                  ? "Keep track of incoming requests, shared quotes, and customer follow-ups."
                  : "Wholesale tiers are ready at a glance for your next customer conversation."}
            </p>
          </div>
          <div className="heading-mark" aria-hidden="true">
            <span>ॐ</span>
          </div>
        </div>

        {activeTab === "assistant" && (
          <section className="assistant-grid" aria-label="WhatsApp reply assistant">
            <div className="input-column">
              <section className="workspace-section">
                <SectionHeading
                  eyebrow="01 · CUSTOMER MESSAGE"
                  title="A note from your customer"
                  subtitle="Paste their WhatsApp message. English, Hindi, or Hinglish — each in their own voice."
                />
                <form onSubmit={generateReply}>
                  <Textarea
                    aria-label="Customer WhatsApp message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Paste the customer's message here…"
                    className="message-input"
                    maxLength={4000}
                    required
                  />
                  <div className="message-meta">
                    <span>{message.length}/4,000 characters</span>
                    <span>
                      <Languages /> English · हिंदी · Hinglish
                    </span>
                  </div>
                  <Button
                    type="submit"
                    className="generate-button w-full"
                    disabled={analyzing || !message.trim()}
                  >
                    {analyzing ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                    {analyzing ? "Preparing a thoughtful reply…" : "Generate reply & save lead"}
                    {!analyzing && <ArrowUpRight className="button-trailing" />}
                  </Button>
                </form>
              </section>
              <div className="sample-section">
                <p className="sample-label">TRY A CUSTOMER MESSAGE</p>
                <div className="sample-list">
                  {samples.map((sample, index) => (
                    <Button
                      key={sample}
                      type="button"
                      variant="ghost"
                      className="sample-item"
                      onClick={() => setMessage(sample)}
                    >
                      <span className="sample-index">0{index + 1}</span>
                      <span>{sample}</span>
                      <ArrowUpRight />
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="output-column">
              {!analysisCard ? (
                <div className="empty-reply">
                  <div className="empty-art">
                    <MessageCircle />
                    <span>
                      <Gem />
                    </span>
                  </div>
                  <span className="empty-eyebrow">A CONVERSATION, CARED FOR</span>
                  <h2>
                    Your next reply
                    <br />
                    will find its words.
                  </h2>
                  <p>
                    A useful reply with accurate catalogue pricing appears here, and the customer
                    enquiry is saved for the team.
                  </p>
                  <div className="empty-signature">
                    <span />
                    <span>REMEDY SETU</span>
                    <span />
                  </div>
                </div>
              ) : (
                <section className="reply-result">
                  <div className="result-header">
                    <div>
                      <span className="result-eyebrow">02 · READY TO SEND</span>
                      <h2>A reply, ready for you.</h2>
                    </div>
                    <span className="saved-indicator">
                      <CheckCheck /> SAVED TO LEADS
                    </span>
                  </div>
                  <div className="signal-row">
                    <span className="signal-label">INTENT</span>
                    <span className="signal-chip">
                      {intentLabels[analysisCard.analysis.intent]}
                    </span>
                    <span className="signal-dot" />
                    <span className="signal-label">LANGUAGE</span>
                    <span className="language-chip">
                      <Languages />
                      {analysisCard.analysis.language}
                    </span>
                  </div>
                  <div className="quote-panel">
                    <div className="quote-heading">
                      <span>YOUR QUOTE</span>
                      <span>INR · WHOLESALE PRICE</span>
                    </div>
                    <div className="quote-product">
                      <span className="quote-product-icon">
                        <Gem />
                      </span>
                      <div>
                        <strong>
                          {analysisCard.lead.matched_product?.name ?? "Product not matched"}
                        </strong>
                        <span>
                          {analysisCard.lead.matched_product?.hindi_name ??
                            "Please verify product details"}
                        </span>
                      </div>
                      {analysisCard.lead.matched_product && (
                        <span className="stock-status">
                          <span
                            className={
                              analysisCard.lead.matched_product.in_stock
                                ? "stock-dot"
                                : "stock-dot out-of-stock"
                            }
                          />
                          {analysisCard.lead.matched_product.in_stock ? "In stock" : "Out of stock"}
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
                            label="Quantity"
                            value={`${analysisCard.analysis.quantity} ${analysisCard.lead.matched_product.unit}`}
                          />
                          <QuoteItem
                            label="Applied tier"
                            value={quantityTier(analysisCard.analysis.quantity)}
                          />
                        </div>
                        <div className="quote-total">
                          <span>ESTIMATED TOTAL</span>
                          <strong>{formatRupees(analysisCard.analysis.quotedTotal ?? 0)}</strong>
                        </div>
                      </>
                    ) : (
                      <p className="unmatched-note">
                        No close catalogue match — confirm the item and price before quoting.
                      </p>
                    )}
                  </div>
                  <label className="reply-label" htmlFor="suggested-reply">
                    YOUR WHATSAPP REPLY <span>EDIT BEFORE SENDING</span>
                  </label>
                  <Textarea
                    id="suggested-reply"
                    value={analysisCard.analysis.suggestedReply}
                    onChange={(event) =>
                      setAnalysisCard((current) =>
                        current
                          ? {
                              ...current,
                              analysis: { ...current.analysis, suggestedReply: event.target.value },
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
                      placeholder="Optional customer WhatsApp number (e.g. +91 98765 43210)"
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
                    <Button className="whatsapp-button" onClick={() => void sendOnWhatsApp()}>
                      <MessageCircle />
                      Send on WhatsApp
                      <ArrowUpRight />
                    </Button>
                  </div>
                  <div className="saved-note">
                    <Check />
                    <span>Lead saved to the shared team workspace.</span>
                    <Button
                      variant="link"
                      onClick={() => {
                        setActiveTab("leads");
                        void refreshWorkspace();
                      }}
                    >
                      View lead
                      <ArrowDownToLine />
                    </Button>
                  </div>
                </section>
              )}
            </div>
          </section>
        )}

        {activeTab === "leads" && (
          <section className="listing-section">
            <div className="listing-heading">
              <div>
                <SectionHeading
                  eyebrow="CUSTOMER CONVERSATIONS"
                  title={`${workspace.leads.length} saved ${workspace.leads.length === 1 ? "lead" : "leads"}`}
                  subtitle={`${openLeads} open ${openLeads === 1 ? "inquiry" : "inquiries"} awaiting reply across your sales workspace.`}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => void refreshWorkspace()}
                disabled={loadingWorkspace}
              >
                <ArrowDownToLine />
                Refresh list
              </Button>
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
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>RECEIVED</th>
                    <th>CUSTOMER MESSAGE</th>
                    <th>INTENT</th>
                    <th>PRODUCT & QUOTE</th>
                    <th>STATUS</th>
                    <th>
                      <span className="sr-only">Open lead</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td className="time-cell">{formatDate(lead.created_at)}</td>
                      <td className="message-cell">
                        <span>{lead.customer_message}</span>
                        <button
                          type="button"
                          className="row-link"
                          onClick={() => setSelectedLead(lead)}
                        >
                          VIEW REPLY
                        </button>
                      </td>
                      <td>
                        <IntentBadge intent={lead.intent} />
                      </td>
                      <td className="price-cell">
                        {lead.matched_product?.name ?? "—"}
                        <span>
                          {lead.quoted_total == null
                            ? "Not quoted"
                            : formatRupees(lead.quoted_total)}
                        </span>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          title="View reply"
                          aria-label={`View saved reply for ${lead.customer_message.slice(0, 36)}`}
                          onClick={() => setSelectedLead(lead)}
                        >
                          <ArrowUpRight />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredLeads.length === 0 && (
                <EmptyListing loading={loadingWorkspace} kind="leads" />
              )}
            </div>
          </section>
        )}

        {activeTab === "catalog" && (
          <section className="listing-section">
            <div className="listing-heading">
              <SectionHeading
                eyebrow="THE REMEDY SETU CATALOGUE"
                title={`${workspace.products.length} considered essentials`}
                subtitle="Clear unit rates. A little more room for your wholesale partners."
              />
              <Button
                variant="outline"
                onClick={() => void refreshWorkspace()}
                disabled={loadingWorkspace}
              >
                <ArrowDownToLine />
                Refresh list
              </Button>
            </div>
            <div className="catalog-legend">
              <span>
                <span className="legend-mark base-mark" /> PER UNIT
              </span>
              <span>
                <span className="legend-mark tier-mark" /> WHOLESALE TIER
              </span>
              <span>
                <PackageCheck /> PRICES IN INR
              </span>
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
                    <th>STOCK</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.products.map((product) => (
                    <tr key={product.id}>
                      <td className="catalog-name">
                        <strong>{product.name}</strong>
                        <span>
                          {product.hindi_name} · {product.description}
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
                        <button
                          type="button"
                          onClick={() => void toggleStock(product)}
                          title="Click to toggle stock availability"
                          className={`stock-status cursor-pointer border-0 bg-transparent p-0 ${product.in_stock ? "" : "unavailable"}`}
                        >
                          <span
                            className={product.in_stock ? "stock-dot" : "stock-dot out-of-stock"}
                          />
                          {product.in_stock ? "In stock" : "Out"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {workspace.products.length === 0 && (
                <EmptyListing loading={loadingWorkspace} kind="products" />
              )}
            </div>
          </section>
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
            className="lead-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-dialog-title"
          >
            <div className="dialog-heading">
              <div>
                <span className="result-eyebrow">CUSTOMER REPLY</span>
                <h2 id="lead-dialog-title">A saved conversation.</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close lead details"
                onClick={() => setSelectedLead(null)}
              >
                ×
              </Button>
            </div>
            <div className="dialog-message">
              <span>CUSTOMER MESSAGE</span>
              <p>{selectedLead.customer_message}</p>
            </div>
            <div className="dialog-reply">
              <span>YOUR REPLY</span>
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
                  void updateLead(selectedLead.id, { suggestedReply: selectedLead.suggested_reply })
                    .then((updated) => {
                      if (updated) toast.success("Reply saved.");
                    })
                    .finally(() => setSavingReply(false));
                }}
              >
                {savingReply ? "Saving…" : "Save reply"}
                <Check />
              </Button>
            </div>
          </section>
        </div>
      )}

      <footer className="workspace-footer">
        <span>
          REMEDY SETU <span className="footer-separator">/</span> THOUGHTFULLY SOURCED,
          CONSIDERATELY SHARED
          {workspace.connectors && (
            <>
              {" "}
              <span className="footer-separator">·</span> AI:{" "}
              {workspace.connectors.ai.provider.toUpperCase()} ({workspace.connectors.ai.model}){" "}
              <span className="footer-separator">·</span> DB:{" "}
              {workspace.connectors.database.provider === "supabase-postgres"
                ? "SUPABASE RLS"
                : "LOCAL MEMORY"}
            </>
          )}
        </span>
        <span>{session.user.email}</span>
      </footer>
    </main>
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

function BrandMark() {
  return (
    <span className="brand-mark">
      <Gem strokeWidth={1.8} />
      <span className="brand-mark-dot" />
    </span>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="section-heading">
      <span className="section-eyebrow">{eyebrow}</span>
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
      {loading ? (
        <LoaderCircle className="animate-spin" />
      ) : kind === "leads" ? (
        <MessageCircle />
      ) : (
        <Gem />
      )}
      <span>
        {loading
          ? "Loading the shared workspace…"
          : kind === "leads"
            ? "No customer inquiries match this search."
            : "The product price list isn't available right now."}
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
