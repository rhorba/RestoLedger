# UI Foundation: RestoLedger
**UX Reference**: docs/ux-restoledger.md
**Version**: 1.0 | **Date**: 2026-08-20 | **Author**: UI Designer

## 1. Design Approach
- **Strategy**: Tailwind CSS + shadcn/ui on web (Next.js); NativeWind (Tailwind for React Native) + a small shared token file on mobile (Expo)
- **Rationale**: One token source (colors/spacing/type scale) shared between web and mobile via Tailwind config, avoids building two design systems for a solo/small team (YAGNI). shadcn/ui gives accessible, unstyled-by-default components fast on web; NativeWind keeps mobile visually consistent without duplicating styling logic.

## 2. Design Tokens
```css
/* Colors — financial SaaS: calm, trustworthy, high legibility for numbers */
--color-primary:     #1E6F5C;  /* deep teal-green — money/growth without cliché "finance blue" */
--color-secondary:   #2D3142;  /* near-black slate for text/nav */
--color-background:  #F7F7F5;
--color-surface:     #FFFFFF;
--color-error:       #C0392B;  /* expenses/negative, distinct from revenue green */
--color-success:     #1E6F5C;  /* revenue/positive reuses primary */
--color-text:         #2D3142;
--color-text-muted:   #6B7280;
--color-border:       #E5E7EB;

/* Typography */
--font-family:   'Inter', system-ui, -apple-system, sans-serif;
--font-family-numeric: 'Inter', 'Roboto Mono', monospace; /* tabular figures for ledger amounts */
--font-size-sm:  0.875rem;
--font-size-md:  1rem;
--font-size-lg:  1.25rem;
--font-size-xl:  1.75rem;

/* Spacing scale (Tailwind default 4px base — no custom scale needed, YAGNI) */
--spacing-xs: 0.25rem;  --spacing-sm: 0.5rem;
--spacing-md: 1rem;     --spacing-lg: 1.5rem;
--spacing-xl: 2.5rem;
```

## 3. Component Inventory
| Component | Reuse Existing | Build New | Notes |
|---|---|---|---|
| Button | shadcn/ui Button | No | primary (post entry), secondary, destructive (reverse entry) variants |
| Table | shadcn/ui Table | No | Ledger list, audit log — needs sticky header + pagination |
| Card | shadcn/ui Card | No | Dashboard summary tiles |
| Toggle/Tabs | shadcn/ui Tabs | No | Revenue/Expense toggle on entry form |
| Toast | shadcn/ui Toast (web) / custom (mobile, Expo notifications pattern) | Mobile: yes | Entry save confirmation |
| Tenant Switcher | — | Yes | Dropdown + search, accountant-only, not in any UI kit |
| Amount Input | — | Yes | Currency-formatted (MAD), numeric keypad on mobile |
| Skeleton loaders | shadcn/ui Skeleton | No | Dashboard, ledger list, audit log loading states |
| Empty state | — | Yes (small) | Reusable icon + message + CTA pattern per UX doc |

## 4. Responsive Breakpoints
| Breakpoint | Width | Layout Notes |
|---|---|---|
| Mobile | < 768px | Mobile app is native (Expo), not responsive web — web dashboard mobile breakpoint is a fallback view only, not the primary owner/staff surface |
| Tablet | 768–1024px | Web dashboard: collapsible sidebar nav |
| Desktop | > 1024px | Web dashboard: persistent sidebar nav, primary target for accountant workflows |

## 5. Accessibility Baseline
- Color contrast: AA minimum (4.5:1 normal text, 3:1 large text) — verified against `--color-primary` on `--color-background` and `--color-error` on white
- Focus indicators: visible on all interactive elements (shadcn/ui defaults preserved, not overridden)
- Semantic HTML first; ARIA only where native semantics insufficient (e.g., custom Tenant Switcher combobox)
- Numeric ledger amounts use `tabular-nums` for scannability, not an accessibility requirement but a financial-UI correctness one
