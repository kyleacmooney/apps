export const CATEGORIES = [
  "All",
  "Upper Pull",
  "Upper Push",
  "Lower",
  "Core",
  "Mobility & Posture",
  "Grip",
  "Cardio & Conditioning",
  "Neck",
] as const

export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_STYLES: Record<
  Exclude<Category, "All">,
  { text: string; bg: string; border: string; tag: string; borderColor: string }
> = {
  "Upper Pull": {
    text: "text-upper-pull",
    bg: "bg-upper-pull-bg",
    border: "border-upper-pull-border",
    tag: "bg-upper-pull-tag text-upper-pull",
    borderColor: "var(--color-upper-pull-border)",
  },
  "Upper Push": {
    text: "text-upper-push",
    bg: "bg-upper-push-bg",
    border: "border-upper-push-border",
    tag: "bg-upper-push-tag text-upper-push",
    borderColor: "var(--color-upper-push-border)",
  },
  "Lower": {
    text: "text-lower",
    bg: "bg-lower-bg",
    border: "border-lower-border",
    tag: "bg-lower-tag text-lower",
    borderColor: "var(--color-lower-border)",
  },
  "Core": {
    text: "text-core",
    bg: "bg-core-bg",
    border: "border-core-border",
    tag: "bg-core-tag text-core",
    borderColor: "var(--color-core-border)",
  },
  "Mobility & Posture": {
    text: "text-mobility",
    bg: "bg-mobility-bg",
    border: "border-mobility-border",
    tag: "bg-mobility-tag text-mobility",
    borderColor: "var(--color-mobility-border)",
  },
  "Grip": {
    text: "text-grip",
    bg: "bg-grip-bg",
    border: "border-grip-border",
    tag: "bg-grip-tag text-grip",
    borderColor: "var(--color-grip-border)",
  },
  "Cardio & Conditioning": {
    text: "text-cardio",
    bg: "bg-cardio-bg",
    border: "border-cardio-border",
    tag: "bg-cardio-tag text-cardio",
    borderColor: "var(--color-cardio-border)",
  },
  "Neck": {
    text: "text-neck",
    bg: "bg-neck-bg",
    border: "border-neck-border",
    tag: "bg-neck-tag text-neck",
    borderColor: "var(--color-neck-border)",
  },
}

export function getCategoryStyle(category: string) {
  return CATEGORY_STYLES[category as Exclude<Category, "All">] ?? {
    text: "text-text-muted",
    bg: "bg-bg-secondary",
    border: "border-border-default",
    tag: "bg-bg-elevated text-text-muted",
    borderColor: "var(--color-border-default)",
  }
}
