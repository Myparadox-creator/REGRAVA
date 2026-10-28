# Supported Patterns and Known Limitations

RepoSentinel prioritizes high precision on a well-defined set of modern full-stack patterns rather than making speculative claims about arbitrary dynamic code.

## Supported Backend Patterns (Python / FastAPI / Pydantic)

| Pattern | Supported | Description |
| :--- | :--- | :--- |
| **FastAPI Route Decorators** | ✅ Supported | `@app.get(...)`, `@app.post(...)`, `@router.put(...)`, `@router.delete(...)`, `@app.api_route(methods=[...])` |
| **Explicit `response_model`** | ✅ Supported | Full cross-file schema resolution for `response_model=UserResponse` |
| **Pydantic Model Definitions** | ✅ Supported | `class User(BaseModel): name: str` with annotations, default values, and `Field(...)` |
| **Dictionary Literal Returns** | ✅ Supported (Fallback) | Static extraction of dictionary return keys when `response_model` is omitted |
| **Path, Query & Body Parameters** | ✅ Supported | Explicit argument typing, default value inspection, and required/optional determination |
| **Removed Response Fields** | ✅ Supported | Accurately flagged as breaking contract modification |
| **Added Response Fields** | ✅ Supported | Correctly flagged as non-breaking additive change (INFO severity) |
| **Field Type Alterations** | ✅ Supported | Changes from `int` to `str`, etc., flagged as breaking regression risk |
| **Removed Routes** | ✅ Supported | Detection of deleted endpoint declarations |
| **Newly Required Parameters** | ✅ Supported | Optional query params converted to required parameters flagged as breaking |

## Supported Frontend Patterns (React / TypeScript / TSX)

| Pattern | Supported | Description |
| :--- | :--- | :--- |
| **Property Access Expressions** | ✅ Supported | `user.user_id`, `response.data.id`, nested object property accesses |
| **Object Destructuring** | ✅ Supported | `const { user_id, name } = response;` |
| **TypeScript Interface Declarations** | ✅ Supported | `interface UserResponse { user_id: number; }` field inspection |
| **Type Alias Signatures** | ✅ Supported | `type User = { user_id: number; }` |
| **API Client String Literals** | ✅ Supported | `fetch('/api/users')`, `axios.get('/api/users')`, endpoint string matching |
| **Test Block Discovery** | ✅ Supported | `describe(...)`, `it(...)`, and `test(...)` in `.test.ts`, `.spec.tsx` |

## Known Limitations & Out-of-Scope Patterns

1. **Dynamic Route Registration**: Routes constructed via runtime loops (e.g. `for path in paths: app.add_api_route(path, ...)`) are not detected by static AST analysis.
2. **Dynamic Property Access**: Bracket access with dynamic variables (e.g. `response[dynamicKey]`) cannot be evaluated statically.
3. **Complex Type Metaprogramming**: Dynamic Pydantic models created via `create_model(...)` at runtime are outside static AST scope.
4. **Third-Party Code Execution**: RepoSentinel does not execute backend code, invoke Docker containers, or run actual test suites. Test evidence reflects static test presence, not assertion passing.
5. **Runtime API Gateways**: Network-level rewrites (e.g. NGINX path rewrites, Kong gateway transformations) outside the repository code are not inspected.
