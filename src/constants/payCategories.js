/** Pay formula categories for STT groups (stored on Group.pay_category). */
export const PAY_CATEGORIES = [
  {
    id: "AB",
    name: "AB (Audio)",
    description: "(reviewed + trashed) min × 5 + reviewed tasks × 2",
  },
  {
    id: "MV",
    name: "MV",
    description: "(reviewed + trashed) min × 5 + reviewed syllables × 0.35",
  },
  {
    id: "TT",
    name: "TT (Tibetan Teaching)",
    description: "(reviewed + trashed) min × 5 + reviewed syllables × 0.3",
  },
  {
    id: "GR",
    name: "GR",
    description: "transcriber syllables × 0.5",
  },
];

export const PAY_CATEGORY_LABELS = Object.fromEntries(
  PAY_CATEGORIES.map((c) => [c.id, c.name])
);
