# Repository Memory & Architectural Invariants

> **File**: `.devmind/memory.md`  
> **Purpose**: Persistent facts, stack choices, conventions, and intentional shortcuts. Agents read this on session boot (~150 tokens) instead of re-analyzing the entire codebase.

## 📌 Verified Stack & Environment
- **Runtime & Language**: [e.g. Node 20+, TypeScript 5.5, pnpm]
- **Frameworks**: [e.g. Next.js 14 App Router, Express, etc.]
- **Database & ORM**: [e.g. PostgreSQL 16, Prisma / Drizzle]
- **Testing**: [e.g. Vitest, Playwright]

## 🧭 Project Conventions & Invariants
- [e.g. Strict Zod validation on all API inputs]
- [e.g. Use Server-Sent Events for streaming]
- [e.g. No Tailwind, vanilla CSS design tokens]

## 🏷️ Tracked Shortcuts (`// devmind:`)
- `// devmind: <ceiling>, <upgrade-path>`: [Description of intentional shortcut]

## 🚫 Anti-Patterns in this Repo
- [e.g. Never store tokens in localStorage]
- [e.g. Do not add lodash, use standard library]
