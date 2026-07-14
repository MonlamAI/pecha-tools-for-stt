// [Reason] Tool Selection list ported from the Auth app's seed (`prisma/seed.js`).
// The Auth DB is NOT merged, so the tool catalog lives here as static config.
// Speech To Text opens the authenticated STT app in-app (no iframe, no ?session).

export type ToolLink = {
  name: string;
  label: string;
  // Internal (same-app) route or external absolute URL.
  href: string;
  external: boolean;
};

// [Reason] Scoped this app down to a single worker tool (Speech To Text) per
// product decision; the other external Pecha tools are intentionally omitted so
// the post-login home stays focused. Admin access is handled separately via the
// FINAL_REVIEWER-only "Admin" tile on the home page.
export const TOOLS: ToolLink[] = [
  { name: "Speech_To_Text", label: "Speech To Text", href: "/stt", external: false },
];
