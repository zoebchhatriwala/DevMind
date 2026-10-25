# Project & User Rules

> **File**: `.devmind/rules.md`  
> **Purpose**: Custom project constraints, team conventions, and developer preferences that override or extend default AI coding behaviors. Agents MUST adhere to these rules on every turn.

## 🎯 High-Priority Directives
- [e.g. Never delete database columns without an explicit two-step deprecation migration]
- [e.g. All public API endpoints must have an OpenAPI contract in /contracts]
- [e.g. Prefer native Web Streams over third-party streaming libraries]

## 🛠️ Code Style & Conventions
- **File Naming**: [e.g. kebab-case for filenames, PascalCase for React components]
- **Imports**: [e.g. Use '@/...' path aliases, group built-ins before third-party packages]
- **State Management**: [e.g. Zustand for global client state, TanStack Query for server cache]
- **Styling**: [e.g. Use design tokens in `tokens.css`, no ad-hoc inline styles]

## 🚫 Hard Constraints (What NEVER to do)
- [e.g. Never add new npm packages when stdlib or an existing package solves the task]
- [e.g. Never store auth tokens, JWTs, or session IDs in localStorage]
- [e.g. Never bypass authentication or validation middleware in production code]

## 💬 Communication Preferences
- [e.g. Concise diffs and direct code first; skip polite filler and design essays unless asked]
