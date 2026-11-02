# API contracts: graphql

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 8 - GraphQL API Architecture Standards

If building GraphQL APIs:
1. **Relay Connection Specification**: Structure paginated queries using `edges`, `node`, and `pageInfo` with opaque cursor strings.
2. **Dedicated Mutation Input and Payload Types**:
   Never accept loose arguments in mutations. Always require a single input argument (e.g. `updateUser(input: UpdateUserInput!): UpdateUserPayload!`).
3. **Query Complexity & Depth Limiting**: Protect against recursive query DoS attacks using `graphql-depth-limit` (Max depth: 6).

---
