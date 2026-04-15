<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## UI constraints

- Do not use native HTML form controls (input, select, textarea, button, etc.) directly in feature or page code. Always use components from `src/components/ui/`.
- If a needed form control does not exist yet, add it under `src/components/ui/` first, then consume that wrapper from business code.
- In editing flows especially, do not render raw `<input>`, `<select>`, `<textarea>`, or `<button>` elements directly.
- Never use native HTML attributes like `type="number"` on input elements - implement custom validation logic instead to avoid native browser UI (spinners, etc.).

## Code organization

- Keep each file under 800 lines. When a file exceeds this limit, refactor it by:
  - Extracting utility functions to separate files (e.g., `component-name/utils.ts`)
  - Extracting type definitions to separate files (e.g., `component-name/types.ts`)
  - Splitting large components into smaller sub-components
  - Moving related functions to dedicated modules
- All code must follow ECMAScript and TypeScript standards:
  - Use proper TypeScript types, avoid `any` unless absolutely necessary
  - Follow ES6+ syntax (arrow functions, destructuring, template literals, etc.)
  - Use `const` and `let` instead of `var`
  - Prefer named exports over default exports for better refactoring support
  - Use proper async/await instead of promise chains where appropriate

## State management

- Always initialize localStorage reads inside `useEffect` to avoid SSR hydration issues
- Use consistent naming conventions for localStorage keys (e.g., `feature_keyName` prefix pattern)
- Extract complex state logic into custom hooks for reusability
- Use `useMemo` to cache expensive computations
- Use `useCallback` to prevent unnecessary function recreations
- Ensure list items have stable keys (never use array index as key)

## Error handling

- All API calls must be wrapped in try-catch blocks
- Provide user-friendly error messages via the toast component
- Never expose sensitive error details (stack traces, internal paths) to users in production
- Log detailed errors server-side for debugging, show generic messages client-side
- Handle loading and error states explicitly in UI

## API design

- Use consistent response format: `{ success?: boolean, message?: string, data?: any }`
- Return appropriate HTTP status codes (200, 400, 401, 404, 500, etc.)
- Validate user session for all protected routes
- Validate and sanitize all user inputs
- Use TypeScript types for request/response payloads

## Security

- Never hardcode sensitive information (API keys, secrets) in client-side code
- Handle all sensitive data (API keys, credentials) exclusively on the server
- Validate and sanitize all user inputs to prevent injection attacks
- Use environment variables for configuration
- Implement proper authentication checks on API routes
<!-- END:nextjs-agent-rules -->
