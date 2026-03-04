# Visual Redesign with shadcn/ui

## Summary

Redesign all pages (Home, Exercises, Workouts) with a polished dark theme using shadcn/ui + Tailwind CSS v4. Mobile-first. Inspired by the old standalone exercise encyclopedia app.

## Route Changes

- `/` — Home hub with nav cards and auth
- `/exercises` — Exercise Encyclopedia (new, split from Workouts)
- `/workouts` — Workout Sessions (existing, refocused on sessions only)

## Tech Stack Additions

- Tailwind CSS v4
- shadcn/ui (Accordion, Card, Input, Badge, Button components)
- Inter + JetBrains Mono fonts (Google Fonts)

## Page Designs

### Home (`/`)

- Dark full-page, centered content
- App title
- Two nav cards (shadcn Card): "Exercise Encyclopedia" and "Workout Sessions" with hover effects
- Auth status: small top-right corner element
- Mobile: cards stack vertically, full-width

### Exercise Encyclopedia (`/exercises`)

- Sticky header: title + count, search Input, category filter chips
- Category colors from old app (teal/magenta/green/gold/etc.)
- Expandable Accordion cards: collapsed shows category badge + name; expanded shows form_cues, common_mistakes, current_working, progression, personal_notes (if populated)
- Updated date in card footer
- Mobile: full-width cards, horizontally scrollable filter chips, large touch targets

### Workout Sessions (`/workouts`)

- Header with title + count
- Session cards: date, title/type, energy level indicator, notes
- Back nav to Home
- Mobile: full-width cards

## Theme

- Base: shadcn dark mode
- Background: very dark blue-black (Tailwind custom color)
- Category-specific accent colors (carried from old app)
- Typography: Inter (body), JetBrains Mono (labels, counts)

## Mobile-First Priorities

- Touch-friendly tap targets (min 44px)
- Full-width cards and inputs on mobile
- Horizontally scrollable category filters
- Responsive padding/spacing via Tailwind breakpoints
