# LLM applications: retrieval

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 1 - RAG & Search Architecture (Retrieval Engineering)

80% of RAG hallucinations stem from retrieval failures: the necessary context was either missing from the top results or drowned in irrelevant chunks.

### 1.1 The Multi-Stage Retrieval Pipeline

```
User Query
   │
   ├───► 1. Sparse Retrieval (BM25 / Full-Text) ───► Top 50 Candidates ──┐
   │                                                                     ├──► 3. Rank Fusion (RRF, k=60) ──► Top 30 Pool
   └───► 2. Dense Vector Retrieval (Embeddings) ──► Top 50 Candidates ──┘          │
                                                                                   ▼
                                                                           4. Cross-Encoder Reranker (Cohere / BGE)
                                                                                   │
                                                                                   ▼
                                                                           Top 3–5 High-Precision Snippets
                                                                                   │
                                                                                   ▼
                                                                           LLM Generator with Grounding Anchor
```

### 1.2 Chunking Strategies: Avoid Naive Token Slicing

1. **Parent-Child (Small-to-Big) Retrieval (Recommended)**:
   - Index small child chunks (150–250 tokens) with dense embeddings for high-precision retrieval matches.
   - When a child chunk matches, fetch and send the larger parent document or section (800–1200 tokens) to the LLM to give full context.
2. **Contextual Retrieval (Anthropic Pattern)**:
   - When chunking a document, prepend a 50–100 token explanatory header to each chunk:
     `Document Title: [Title] | Section: [Section] | Summary of document: [1-2 sentences]`
   - This eliminates orphan chunks where context is lost (e.g. a table row that lacks column headers or company names).
3. **Preserve Provenance Metadata**:
   Every stored chunk MUST include:
   ```ts
   interface ChunkMetadata {
     chunkId: string;
     documentId: string;
     sourceUrl: string;
     title: string;
     section: string;
     tenantId: string;       // Mandatory for multi-tenant isolation
     allowedRoles: string[]; // Mandatory for object permissions
     updatedAt: string;
   }
   ```

### 1.3 Pre-Retrieval Filtering (Tenant & Permission Security)
- Enforce tenancy and role permissions at the database level:
  `WHERE tenant_id = :tenantId AND :userRole = ANY(allowed_roles)`
- **NEVER** retrieve unauthorized chunks and ask the LLM to *"filter out what the user cannot see"*.

### 1.4 Permission Freshness and Source Deletion

- Derive tenant and permission context from current application authority, not user-supplied filters or the model. Apply the same scope to sparse/vector search, reranking, parent-document expansion, citation fetches, and cached answers. A filtered child chunk does not authorize an unfiltered parent fetch.
- Keep source IDs and versions with derived chunks. Propagate edits, ACL changes, and deletions to indexes and caches. While an index update is pending, check current source authorization/deletion state before including material in model context; reject inaccessible or unverifiable sources rather than trust stale `allowedRoles` metadata.
- Scope cached answers to the authorization context that produced them and invalidate or reauthorize them after membership/ACL changes. A cache hit must not bypass the permission boundary.
- Make index/update jobs tolerate retries and reject stale versions or tombstoned sources so delayed ingestion cannot resurrect deleted content. Apply the project's retention policy to stored prompts, embeddings, traces, and provider copies; deleting only the source row leaves those copies behind.
- Verify with two tenants and a permission-change/deletion case: warm the cache/index, remove access, then search again and expand a parent. No unauthorized text may reach the model or response. Replay an old ingestion job and confirm the deleted source stays unavailable.

---
