---
name: strata
description: >-
  MANDATORY TRIGGER: Activates when the user asks to "generate code map", "code map", "visualize code", "visualize app", "map architecture", "show what I built", "what did I build", "strata", or asks to inspect application structure, journeys, and trust boundaries without reading code.
trigger: model_decision
---

# strata: Code Visualization for Vibe Coders & Seniors

You are operating under the **Strata** standard. Strata is a visual map of an application designed for people who didn't write the code (vibe coders) to understand what was built, and for senior engineers to review blast radius and trust boundaries before merging.

When the user asks to **"generate code map"**, **"visualize this app"**, **"show what I built"**, or **"run strata"**, you **MUST NOT** tell the user to run an npm command. The user's project does not have a `strata` npm script. You as the AI coding agent must inspect the repository, run the 10 checks, generate `.devmind/strata.html`, and provide the user with the direct clickable file link.

---

## 🚨 Pre-Flight Gate

Before authoring `.devmind/strata.html`:

1. **Inspect Codebase Structure**:
   - Locate user-facing entry points (Next.js `app/`, `pages/`, components, screens).
   - Identify backend handlers (API routes `route.ts`, Server Actions, controllers).
   - Identify persistent data stores (Supabase tables, Firebase collections, Prisma models, SQL migrations).
   - Identify third-party services (Stripe, Resend/SendGrid email, Supabase/Firebase Auth, external APIs).
2. **Execute the 10 High-Value Security & Flow Checks**:
   - `SEC-001`: Leaked secrets in client components (`STRIPE_SECRET_KEY` in `'use client'`).
   - `SEC-002`: Public DB tables without RLS (`supabase.from('users')` lacking restrictive RLS policies).
   - `SEC-003`: Unauthenticated server routes / actions mutating data without `auth()`.
   - `SEC-004`: SQL / NoSQL injection via unescaped string interpolation.
   - `SEC-005`: Webhook endpoints lacking cryptographic signature verification (`constructEvent()`).
   - `FLOW-006`: Dead weight / orphaned AI code (files with 0 inbound references).
   - `FLOW-007`: Silent failure / swallowed errors in payment, auth, or DB mutations (`catch {}`).
   - `FLOW-008`: Dead-end UI buttons with missing or empty handlers (`onClick={() => {}}` or `#`).
   - `SEC-009`: Missing input validation boundary (routes parsing `req.json()` without Zod).
   - `SEC-010`: Client-side price or role tampering (`amount` or `role` sent in client payload).
3. **Summarize AI Consequences (The Change Ledger)**:
   - Identify what recent edits changed in terms of real-world consequences: services added, secrets touched, tables exposed, or blast radius expanded.
4. **Target Destination**:
   - Write `.devmind/strata.html` into the project root. Ensure `.devmind/` is added to `.gitignore` if not already tracked.

---

## ⚡ Golden Patterns

### 1. The 3 Behavioral Zones (Not Folder Trees)

Structure the application into 3 visual zones separated by physical trust boundary walls:

```
[ ZONE 1: BROWSER (Client) ]
  ├── Screens (/checkout, /login, /dashboard)
  └── Interactive Buttons & Client Forms (CheckoutButton, LoginForm)
      │
  🧱 [ THE BROWSER WALL: Client-Server Gateway ]
      │
[ ZONE 2: SERVER (Backend) ]
  ├── Route Handlers (/api/checkout, /api/webhooks/stripe)
  └── Server Actions & Middleware (createOrderAction, authGuard)
      │
  🧱 [ THE DATABASE & CLOUD WALL: Backend-Persistence Gateway ]
      │
[ ZONE 3: DATABASE & OUTSIDE SERVICES ]
  ├── Data Tables (users, orders, subscriptions)
  └── External Services (Stripe Payments, Supabase Auth, Resend Email)
```

### 2. The 3 Visual Overlays (One Map, Three Questions)

1. **Structure Overlay ("What did I actually build?")**:
   - Plain-language labels on every card ("Checkout Button", "Charge Card", "Customer Table", "Send Receipt Email").
   - Directional wires showing connections without having to open source files.
2. **Flow Overlay ("What happens when a user does X?")**:
   - Interactive user journeys (e.g. User Checkout & Payment, Authentication & Onboarding, Password Reset).
   - Selecting a journey lights up the active path with animated glowing flows.
   - Dead ends show immediately where light stops (unhandled button, empty stub, or swallowed error).
3. **Security Overlay ("What could go wrong?")**:
   - Physical trust boundaries glow red where ungated crossings occur.
   - Leaked secrets, open database tables, and unauthenticated endpoints pulse in red.
   - Dead-weight / orphaned AI code is greyed out with dashed borders.
   - Clickable Red Spots display:
     - Exact `file:line` evidence and code snippet.
     - Confidence score (e.g. 98% High Confidence).
     - Plain-language explanation (Junior mode) and Senior Threat Model / Blast Radius.
     - **"Copy Fix Prompt"** button for immediate AI remediation.

### 3. Agent Execution Protocol

When the user asks to "generate code map", "visualize this app", or "show what I built":
1. **Analyze Project Structure**: Map files into Browser (screens, components, buttons), Server (routes, actions), and Database/Services (tables, external APIs).
2. **Evaluate the 10 Checks**: Scan for leaked secrets, missing RLS, unauthenticated endpoints, SQL injection, unverified webhooks, dead weight, swallowed errors, dead-end buttons, missing Zod validation, and price tampering.
3. **Generate `.devmind/strata.html`**: Write a standalone, self-contained interactive HTML file (using SVG, CSS, and vanilla JS) into `.devmind/strata.html` in the user's project root.
4. **Deliver Clickable Link**: Return `file://<project-root>/.devmind/strata.html` with a concise receipt badge.

### 4. Output Response Format

Always provide the clickable file link and a compact receipt:

```text
🧠 [DevMind: strata | Checked: 3 zones mapped, 10 checks evaluated, .devmind/strata.html generated]

Here is your interactive code map:
👉 file://<absolute-path-to-project>/.devmind/strata.html

- Overlay 1: What did I build? (Structure & components)
- Overlay 2: User Journeys (Flow & dead-end detection)
- Overlay 3: Security & Trust Boundaries (10 checks & copyable fix prompts)
- Switch between Junior Mode (plain language) and Senior Mode (blast radius & code).
```

---

## 🔍 Anti-Amnesia Receipt

Every coding agent generating or updating a code map MUST output the receipt badge:

```text
🧠 [DevMind: strata | Checked: <zones mapped>, <issues flagged>, <output verified>]
```

---

## ✅ Post-Implementation Checklist

- [ ] Inspected user-facing components, server routes, database tables, and external services.
- [ ] Arranged modules by behavior across 3 zones (Browser, Server, Database & Services).
- [ ] Evaluated all 10 high-value security & flow checks (`SEC-001` through `SEC-010`).
- [ ] Provided exact file:line evidence, confidence scores, and ready-made fix prompts on all red spots.
- [ ] Included the Change Ledger summarizing recent AI edits by consequences.
- [ ] Supported both Junior Mode (plain English) and Senior Mode (blast radius & technical IDs).
- [ ] Generated or updated `.devmind/strata.html` in the target project.
- [ ] Delivered a direct clickable `file://...` link to `.devmind/strata.html`.
- [ ] Printed the Anti-Amnesia Receipt badge.

