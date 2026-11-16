# Remedy Setu — AI WhatsApp Sales Reply Assistant & Lead Desk

A multilingual WhatsApp sales reply assistant, wholesale spiritual-products & gemstones catalogue, and customer lead desk built with **TanStack Start**, **React 19**, **Tailwind CSS v4**, **Supabase**, and **Drizzle ORM**.

---

## 1. Setup Steps

### Prerequisites

- **Node.js** `>= 22.12.0` (or **Bun** `>= 1.1`)
- **npm** (or **bun**)

### Step 1: Clone & Install Dependencies

```bash
git clone <repository-url>
cd screenshot-scenery-studio-27-main
npm install
```

### Step 2: Configure Environment Variables

Copy [`.env.example`](./.env.example) to `.env` (a pre-configured template is included for immediate local development):

```bash
cp .env.example .env
```

- **Zero-Key Out-of-the-Box Mode**: The app runs immediately without requiring any paid third-party API keys. Click **"Instant Demo Sales Desk (No Email Needed)"** on the sign-in screen to use the built-in deterministic multilingual analyzer and owner-scoped persistence.
- **Optional AI LLM Upgrade**: Set any one of `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY` in `.env` to upgrade intent/language/product classification to live LLM inference while keeping price calculations 100% deterministic.
- **Optional WhatsApp Business Cloud API**: Set `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_VERIFY_TOKEN` to enable direct Graph API message dispatch and webhook ingestion (defaults to 1-click `wa.me` deep linking).

### Step 3: Database Migration & Catalogue Seeding (Supabase / PostgreSQL)

To apply the PostgreSQL schema (`remedy_products` and `remedy_leads` tables, enums, Row-Level Security policies, and the 8 seeded wholesale products), run the SQL migration in your Supabase SQL Editor or via Drizzle / psql:

- **SQL Migration File**: [`drizzle/migrations/0000_create_remedy_sales_workspace.sql`](./drizzle/migrations/0000_create_remedy_sales_workspace.sql) (also mirrored at [`supabase/migrations/20261116000000_create_remedy_sales_workspace.sql`](./supabase/migrations/20261116000000_create_remedy_sales_workspace.sql))
- **Drizzle Schema**: [`drizzle/schema.ts`](./drizzle/schema.ts)

### Step 4: Start the Development Server

```bash
npm run dev
```

Open `http://localhost:8080` in your browser.

### Step 5: Run Tests, Linter & Production Build

```bash
npm run test    # Run Vitest unit & API connector tests
npm run lint    # Run ESLint + Prettier checks
npm run build   # Build production client + SSR serverless bundles
```

---

## 2. Tech Stack

| Layer                    | Technology                                                                                                                                                                                         | Purpose                                                                                                           |
| :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| **Framework & SSR**      | **TanStack Start** (`@tanstack/react-start`) + **TanStack Router**                                                                                                                                 | Full-stack file-based routing, SSR, and type-safe RPC server functions (`createServerFn`)                         |
| **UI Library**           | **React 19** + **TypeScript 5.8**                                                                                                                                                                  | Interactive 3-tab workspace (`Reply Assistant`, `Saved Leads`, `Price List`)                                      |
| **Styling & Components** | **Tailwind CSS v4** + **Radix UI / shadcn/ui** + **Lucide Icons**                                                                                                                                  | Custom editorial spiritual/gemstone aesthetic, accessible dialogs, toast notifications (`sonner`)                 |
| **Database & Auth**      | **Supabase** (`@supabase/supabase-js`) + **PostgreSQL** + **Drizzle ORM** (`drizzle-orm`, `drizzle-kit`)                                                                                           | Email/Password + Google OAuth + Instant Demo Session, Row-Level Security (RLS), owner-scoped leads                |
| **AI & NLP Engine**      | **Google Gemini** (`gemini-2.5-flash`), **Groq** (`llama-3.3-70b-versatile`), **OpenAI** (`gpt-4o-mini`), **Anthropic Claude** (`claude-3-5-haiku-latest`) + **Deterministic Multilingual Engine** | Classifies intent, language (`English`, `Hindi`, `Hinglish`), product match, and quantity with automatic fallback |
| **Server Runtime**       | **Nitro** (`cloudflare-module` preset) + custom H3 error boundary                                                                                                                                  | Edge/serverless deployment ready with both RPC server functions and REST `/api/*` endpoints                       |
| **Testing & Quality**    | **Vitest**, **Testing Library**, **ESLint 9**, **Prettier**                                                                                                                                        | Unit tests for quantity-tier pricing, multilingual analysis, route matching, and REST API connectors              |

---

## 3. Features Done

### Core Application Features

1. **Multilingual WhatsApp Message Analyzer**:
   - Accepts customer inquiries in **English**, **Hindi (देवनागरी)**, and **Hinglish**.
   - Automatically detects language and classifies intent into one of 5 categories:
     - `PRICE_ENQUIRY`
     - `BULK_ORDER`
     - `AVAILABILITY`
     - `COMPLAINT`
     - `GENERAL_QUERY`
2. **Deterministic Wholesale Price & Tier Calculator (Zero Price Hallucination)**:
   - Matches inquiries against the **Remedy Setu Wholesale Catalogue** (Gemstones in `ratti`, Rudraksha in `pcs`, Spiritual Malas in `mala`, Puja Kits in `kit`).
   - Extracts requested quantities across English and Hindi units (`ratti`, `pcs`, `mala`, `kit`, `रत्ती`, `नग`, `पीस`, `माला`, `किट`) without confusing bead face counts (`5 Mukhi`, `7 Mukhi`) with order quantity.
   - Deterministically calculates unit rate and total quote in INR across 4 wholesale tiers:
     - **Standard Retail**: `1–9 units` (`base_price`)
     - **Tier 1 Wholesale**: `10–49 units` (`tier10_plus_price`)
     - **Tier 2 Wholesale**: `50–99 units` (`tier50_plus_price`)
     - **Tier 3 Bulk**: `100+ units` (`tier100_plus_price`)
3. **Contextual Multilingual Reply Generator**:
   - Generates a ready-to-send reply in the customer's exact language (`English`, `Hindi`, or `Hinglish`) including product availability, applied unit rate, quantity, and formatted INR total.
   - Handles special cases automatically: **order delay/complaint apologies**, **unmatched product clarification prompts**, and **out-of-stock notifications**.
4. **1-Click Copy & WhatsApp Dispatch**:
   - Editable reply box before sending.
   - **Copy Reply** to clipboard and **Send on WhatsApp** (supports optional customer phone number formatting via `wa.me/<phone>?text=...` or direct Meta WhatsApp Cloud API dispatch, while marking the lead as `REPLIED`).
5. **Wholesale Product Catalogue View**:
   - Displays all 8 seeded spiritual & gemstone items with Hindi names, descriptions, unit types, all 4 wholesale price tiers in INR, and live stock availability.

### Backend Connectors & API Architecture

- **TanStack Start Server Functions** ([`src/lib/remedy.functions.ts`](./src/lib/remedy.functions.ts)):
  - `getWorkspaceData`: Loads catalogue products, owner-scoped leads, and live connector status.
  - `analyzeCustomerMessage`: Runs AI/deterministic classification, computes tier quote, and saves the lead.
  - `updateSavedLead`: Updates lead status (`NEW` | `REPLIED` | `CONVERTED`) and/or edited reply text.
  - `deleteSavedLead`: Deletes an owner-scoped lead.
  - `toggleProductStock`: Toggles `in_stock` status for any catalogue item.
  - `dispatchWhatsAppReply`: Updates lead status to `REPLIED` and dispatches via Meta WhatsApp Cloud API or `wa.me` deep link.
- **REST API Endpoints** ([`src/lib/api-router.server.ts`](./src/lib/api-router.server.ts)):
  - `GET /api/health` & `GET /api/connectors` — Live health check and active connector configuration (`database`, `ai`, `whatsapp`).
  - `GET /api/products` — List catalogue products (supports `?category=` and `?in_stock=` filters).
  - `PATCH /api/products/:id` — Toggle product `inStock` status (`{ "inStock": boolean }`).
  - `POST /api/analyze` — Analyze a customer WhatsApp message (`{ "message": "..." }`) and persist an owner-scoped lead.
  - `GET /api/leads` — List owner-scoped leads (supports `?intent=`, `?status=`, and `?search=` filters).
  - `PATCH /api/leads/:id` — Update lead `status` or `suggestedReply`.
  - `DELETE /api/leads/:id` — Delete an owner-scoped lead.
  - `GET /api/whatsapp/webhook` & `POST /api/whatsapp/webhook` — Meta WhatsApp Cloud API webhook verification and inbound message processor.
  - `POST /api/cron/digest` — Authenticated cron endpoint (protected by `CRON_SECRET` via timing-safe SHA-256 verification).

---

## 4. Bonus Items Attempted

1. **Saved Customer Leads CRM Desk (`Saved leads` tab)**:
   - Every analyzed inquiry is automatically saved as an owner-scoped lead (`created_by = auth.uid()`).
   - **Lead Lifecycle Workflow**: Update lead status directly in the table (`New` → `Replied` → `Converted`).
   - **Search & Intent Filtering**: Filter saved inquiries by intent (`PRICE_ENQUIRY`, `BULK_ORDER`, `AVAILABILITY`, `COMPLAINT`, `GENERAL_QUERY`) and full-text search across customer messages, matched products, and replies.
   - **In-Place Reply Editor & Lead Deletion**: Open any saved lead in a modal to inspect the original message, edit and re-save the reply, copy it, or delete the lead.
2. **Multi-LLM Connector with Zero-Config Deterministic Fallback**:
   - Seamless plug-and-play support for **Google Gemini**, **Groq**, **OpenAI**, and **Anthropic Claude**, with automatic fallback to the deterministic multilingual analyzer ([`src/lib/remedy-analysis.ts`](./src/lib/remedy-analysis.ts)) so the app never breaks when offline or when API keys are omitted/rate-limited.
3. **Meta WhatsApp Business Cloud API + `wa.me` Hybrid Connector**:
   - Supports direct customer phone numbers, Meta Graph API message sending, webhook verification/ingestion (`/api/whatsapp/webhook`), and 1-click `wa.me` deep links.
4. **Interactive Catalogue Stock Toggle**:
   - Click any product's `In stock` / `Out` badge in the **Price List** tab to toggle stock availability live and test out-of-stock multilingual responses in the assistant.
5. **Instant Demo Sales Desk & Dual-Layer Persistence**:
   - One-click demo sign-in (`Instant Demo Sales Desk`) plus Supabase Auth (Email/Password & Google OAuth), backed by Supabase PostgreSQL RLS with automatic owner-scoped in-memory fallback.
6. **Automated Unit & API Connector Tests**:
   - Comprehensive Vitest suite ([`src/lib/remedy-analysis.test.ts`](./src/lib/remedy-analysis.test.ts) & [`src/test/app-routing.test.tsx`](./src/test/app-routing.test.tsx)) covering tier boundary math, Hinglish/Hindi/English intent & product disambiguation, malformed LLM output recovery, and `/api/*` REST endpoints.
