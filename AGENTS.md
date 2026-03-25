<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## UI constraints

- Do not use native form controls directly in feature or page code. Prefer existing components in `src/components/ui/`.
- If a needed form control does not exist yet, add it under `src/components/ui/` first, then consume that wrapper from business code.
- In editing flows especially, do not render raw `<select>` / `<textarea>` style controls directly.
<!-- END:nextjs-agent-rules -->
