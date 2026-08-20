# UX Foundation: RestoLedger
**PRD Reference**: docs/prd-restoledger.md
**Version**: 1.0 | **Date**: 2026-08-20 | **Author**: UX Designer

## 1. User Personas
| Persona | Role | Goal | Pain Point |
|---|---|---|---|
| Amine, restaurant owner | owner (mobile-first) | See today's cash position without calling his accountant | Currently finds out how the month went only when the accountant sends a PDF, weeks later |
| Fatima, accountant | accountant (web-first, manages many tenants) | Reconcile and report on 15+ restaurant clients without juggling separate spreadsheets | Context-switching between client files eats her day; no single audit trail per client |
| Youssef, kitchen staff | staff (mobile-only) | Log end-of-day sales in under a minute | Doesn't need or want to see reports — just wants entry to be fast |

## 2. Information Architecture / Site Map
```
[Web Dashboard — Accountant/Owner]
├── Tenant Switcher (accountant only — jumps between clients)
├── Dashboard (P&L summary, cash position)
├── Ledger (list, filter, post entry, reverse entry)
├── Audit Log
├── Integrations (connect/manage POS provider)
├── Reports/Export
└── Team (manage staff/roles — owner only)

[Mobile App — Owner/Staff]
├── Home (today's snapshot — owner only; staff sees entry shortcut)
├── Quick Entry (log sale/expense — staff + owner)
├── Ledger (view-only for owner; hidden for staff)
└── Settings
```

## 3. Core User Flows

### Flow 1: Staff logs a daily sale (mobile)
```
[Open app] → [Tap "Quick Entry"] → [Select Revenue/Expense] → [Enter amount + note]
   → [Submit] → [Confirmation] → [Return to entry screen, ready for next]
                        ↓ Network error
                  [Queue locally, retry, show "pending sync" badge]
```

### Flow 2: Owner checks cash position (mobile)
```
[Open app] → [Home screen loads today's P&L snapshot] → [Tap for weekly/monthly view]
   → [See revenue/expense breakdown] → [Optional: drill into ledger entries]
```

### Flow 3: Accountant reconciles and reverses a bad entry (web)
```
[Login] → [Select tenant from switcher] → [Open Ledger] → [Filter by date/type]
   → [Find incorrect entry] → [Tap "Reverse"] → [Confirm reason]
   → [System posts offsetting entry, links both, writes audit log]
   → [Ledger view updates, shows both entries linked]
```

## 4. Key Screen Wireframes (text-based)

### Screen: Mobile Quick Entry
```
┌─────────────────────────────┐
│ ← RestoLedger                │
├─────────────────────────────┤
│  [Revenue]   [Expense]       │  ← toggle
│                               │
│  Amount:  [______] MAD       │
│  Note:    [______________]   │
│                               │
│      [  Save Entry  ]        │
├─────────────────────────────┤
│ 🏠 Home  ➕ Entry  ⚙ Settings │
└─────────────────────────────┘
```

### Screen: Web Dashboard
```
┌───────────────────────────────────────────┐
│ RestoLedger    [Tenant: Café Amine ▾]  👤  │
├───────────────────────────────────────────┤
│  Today        This Week       This Month   │
│  Revenue: 4,200 MAD  Expenses: 1,100 MAD    │
│  Cash position: 3,100 MAD                   │
│                                              │
│  [ Recent Entries table ]                   │
│  [ Post Entry ]  [ Export ]                 │
├───────────────────────────────────────────┤
│ Dashboard | Ledger | Audit | Integrations   │
└───────────────────────────────────────────┘
```

## 5. Screen States
| Screen | Empty State | Loading | Error | Success |
|---|---|---|---|---|
| Mobile Quick Entry | n/a (always actionable) | Save button spinner | "Couldn't save — saved locally, will sync" | Toast: "Entry saved" + haptic |
| Web Dashboard | "No entries yet — post your first entry" + CTA | Skeleton cards | "Couldn't load dashboard — retry" | n/a |
| Ledger list | "No entries match this filter" | Skeleton rows | Inline error banner, retry button | n/a |
| Audit Log | "No activity yet" | Skeleton rows | Inline error banner | n/a |
