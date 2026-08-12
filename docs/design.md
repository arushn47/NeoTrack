# Design — NeoPAT Placement Tracker

## 1. Design Philosophy

The design should feel **professional, data-dense, and alive** — like a premium fintech or analytics dashboard. It's a personal tool, so it should prioritize **information density** and **quick scanning** over marketing aesthetics.

Key principles:

- **Clarity over decoration** — Every pixel earns its place.
- **Status at a glance** — Color-coded badges, timeline markers, and summary cards make the user's placement situation instantly understandable.
- **Dark-first** — A rich dark theme as default, with optional light mode.
- **Micro-interactions** — Subtle animations that make the app feel responsive and alive.
- **Data-forward** — The dashboard is the hero; data drives the layout.

---

## 2. Color System

### Dark Theme (Default)

| Token                    | Value          | Usage                              |
|--------------------------|----------------|-------------------------------------|
| `--background`           | `#0a0a0f`      | Page background                    |
| `--surface`              | `#12121a`      | Card/panel background              |
| `--surface-hover`        | `#1a1a26`      | Card hover state                   |
| `--surface-elevated`     | `#1e1e2e`      | Modals, dropdowns, popovers       |
| `--border`               | `#2a2a3a`      | Card borders, dividers             |
| `--border-subtle`        | `#1e1e2e`      | Subtle separators                  |
| `--text-primary`         | `#f0f0f5`      | Primary text                       |
| `--text-secondary`       | `#8a8a9a`      | Secondary/muted text               |
| `--text-tertiary`        | `#5a5a6a`      | Placeholder, disabled text         |

### Accent Colors

| Token                    | Value          | Usage                              |
|--------------------------|----------------|-------------------------------------|
| `--accent-primary`       | `#6366f1`      | Primary actions (Indigo)           |
| `--accent-primary-hover` | `#818cf8`      | Primary hover                      |
| `--accent-primary-muted` | `#6366f120`    | Primary background tint            |

### Status Colors (Critical for this app)

| Status          | Color          | Hex          | Badge Style               |
|-----------------|----------------|--------------|---------------------------|
| Applied         | Blue           | `#3b82f6`    | Solid background           |
| Shortlisted     | Cyan           | `#06b6d4`    | Solid background           |
| PPT Scheduled   | Slate Blue     | `#8b5cf6`    | Solid background           |
| Test Scheduled  | Amber          | `#f59e0b`    | Solid background           |
| Interview       | Emerald        | `#10b981`    | Solid background           |
| Selected        | Green          | `#22c55e`    | Solid + subtle glow        |
| Offer Received  | Gold           | `#eab308`    | Solid + subtle glow        |
| Rejected        | Red            | `#ef4444`    | Muted background           |
| Withdrawn       | Gray           | `#6b7280`    | Muted/outlined             |
| Declined        | Orange-Red     | `#f97316`    | Muted background           |
| Not Applied     | Slate          | `#94a3b8`    | Outlined / ghost           |
| Unknown         | Neutral        | `#a1a1aa`    | Dashed outline             |

### Event Type Colors (Calendar)

| Event Type          | Color          | Hex          |
|---------------------|----------------|--------------|
| Registration        | Blue           | `#3b82f6`    |
| PPT                 | Purple         | `#8b5cf6`    |
| Online Test         | Amber          | `#f59e0b`    |
| Interview           | Emerald        | `#10b981`    |
| Result              | Cyan           | `#06b6d4`    |
| Deadline            | Red            | `#ef4444`    |

### Semantic Colors

| Token                    | Value          | Usage                              |
|--------------------------|----------------|-------------------------------------|
| `--success`              | `#22c55e`      | Success states                     |
| `--warning`              | `#f59e0b`      | Warning states                     |
| `--error`                | `#ef4444`      | Error states                       |
| `--info`                 | `#3b82f6`      | Info states                        |

---

## 3. Typography

### Font Family

- **Primary**: `Inter` (Google Fonts) — Clean, modern, highly readable at small sizes.
- **Monospace**: `JetBrains Mono` — For Neo IDs, technical data, and code-like content.

### Font Weights

| Weight | Name       | Usage                                    |
|--------|------------|------------------------------------------|
| 400    | Regular    | Body text, descriptions                  |
| 500    | Medium     | Table headers, labels, secondary headings|
| 600    | Semibold   | Card titles, section headings            |
| 700    | Bold       | Page titles, emphasis                    |

### Type Scale

| Token        | Size   | Line Height | Usage                           |
|--------------|--------|-------------|---------------------------------|
| `text-xs`    | 11px   | 16px        | Badges, timestamps, metadata    |
| `text-sm`    | 13px   | 20px        | Table cells, secondary text     |
| `text-base`  | 14px   | 22px        | Body text, descriptions         |
| `text-lg`    | 16px   | 24px        | Card titles, subtitles          |
| `text-xl`    | 20px   | 28px        | Section headings                |
| `text-2xl`   | 24px   | 32px        | Page titles                     |
| `text-3xl`   | 30px   | 36px        | Dashboard hero stats            |
| `text-4xl`   | 36px   | 40px        | Large stat numbers              |

---

## 4. Spacing System

Use Tailwind's default spacing scale (4px base):

| Token  | Value  | Usage                              |
|--------|--------|------------------------------------|
| `1`    | 4px    | Tight gaps (badge padding)         |
| `2`    | 8px    | Icon gaps, inline spacing          |
| `3`    | 12px   | Small gaps                         |
| `4`    | 16px   | Card padding (compact)             |
| `5`    | 20px   | Standard card padding              |
| `6`    | 24px   | Section spacing                    |
| `8`    | 32px   | Large section gaps                 |
| `10`   | 40px   | Page-level spacing                 |
| `12`   | 48px   | Major section separators           |

---

## 5. Border Radius

| Token           | Value   | Usage                              |
|-----------------|---------|-------------------------------------|
| `rounded-sm`    | 4px     | Small elements (badges)            |
| `rounded-md`    | 6px     | Buttons, inputs                    |
| `rounded-lg`    | 8px     | Cards, panels                      |
| `rounded-xl`    | 12px    | Large cards, modals                |
| `rounded-2xl`   | 16px    | Hero sections                      |
| `rounded-full`  | 9999px  | Avatars, circular indicators       |

---

## 6. Shadows & Elevation

Dark mode shadows should be subtle and use colored undertones:

| Level    | CSS                                                           | Usage            |
|----------|---------------------------------------------------------------|------------------|
| None     | `none`                                                        | Flat elements    |
| SM       | `0 1px 2px rgba(0,0,0,0.3)`                                  | Buttons          |
| MD       | `0 4px 12px rgba(0,0,0,0.4)`                                 | Cards            |
| LG       | `0 8px 24px rgba(0,0,0,0.5)`                                 | Modals           |
| Glow     | `0 0 20px rgba(99,102,241,0.15)`                              | Selected/active  |

---

## 7. Layout Structure

### Dashboard Shell

```
┌──────────────────────────────────────────────────────┐
│ TOPBAR                                               │
│ ┌─────────┐                    ┌──────┐ ┌──────────┐│
│ │  Logo   │  NeoPAT Tracker    │Sync ⟳│ │  Avatar  ││
│ └─────────┘                    └──────┘ └──────────┘│
├────────────┬─────────────────────────────────────────┤
│            │                                         │
│  SIDEBAR   │           MAIN CONTENT                  │
│            │                                         │
│  Dashboard │  ┌─────────────────────────────────┐    │
│  Companies │  │        STATS CARDS              │    │
│  Calendar  │  │  Active │ Listed │ Tests │ ...  │    │
│  Search    │  └─────────────────────────────────┘    │
│  Settings  │                                         │
│            │  ┌─────────────────────────────────┐    │
│            │  │       UPCOMING EVENTS           │    │
│            │  │  MUFG Test - 13 Aug 2:30 PM     │    │
│            │  │  MUFG Interview - 14 Aug 10 AM  │    │
│            │  └─────────────────────────────────┘    │
│            │                                         │
│            │  ┌─────────────────────────────────┐    │
│            │  │       COMPANY TABLE             │    │
│            │  │  Company | Status | CTC | ...   │    │
│            │  │  ─────────────────────────────  │    │
│            │  │  MUFG   | Interview| ...  | ... │    │
│            │  └─────────────────────────────────┘    │
│            │                                         │
├────────────┴─────────────────────────────────────────┤
│  (Mobile: bottom tab navigation replaces sidebar)    │
└──────────────────────────────────────────────────────┘
```

### Sidebar

- **Width**: 240px (desktop), collapsible to 64px (icon-only)
- **Background**: `--surface`
- **Active item**: Left border accent + subtle background tint
- **Icons**: Lucide Icons, 20px size

### Topbar

- **Height**: 56px
- **Background**: `--surface` with subtle border-bottom
- **Content**: Logo, app name, sync button, notification bell, user avatar

---

## 8. Component Design

### Stats Cards

```
┌─────────────────┐
│  📊              │
│  Active Apps     │
│  10              │
│  ↑ 2 this week  │
└─────────────────┘
```

- 4-6 cards in a responsive grid
- Subtle gradient or accent tint on the icon
- Number uses `text-3xl font-bold`
- Change indicator with green (↑) or red (↓) text

### Status Badge

```
[ ● Shortlisted ]    (filled, colored background with lighter text)
[ ○ Not Applied ]    (outlined, ghost style)
[ ⚠ Unknown ]        (dashed border)
```

- Rounded pill shape (`rounded-full`)
- 10px dot indicator matching status color
- Font size: `text-xs font-medium`
- Padding: `px-2.5 py-0.5`

### Company Table Row

```
┌──────────┬──────────────┬──────────────┬────────┬──────────┬──────────┐
│ MUFG     │ SDE Intern   │ ● Interview  │ 12 LPA │ Mumbai   │ 14 Aug   │
│          │              │   Scheduled  │        │          │          │
└──────────┴──────────────┴──────────────┴────────┴──────────┴──────────┘
```

- Alternating row backgrounds (subtle)
- Hover: `--surface-hover` with smooth transition
- Clickable → navigates to company detail
- Status badge inline
- Neo ID match indicator: ✓ (green) or – (gray)

### Timeline (Company Detail)

```
    ●─── 7 Aug ─── Registration
    │                VIT Email: "MUFG Drive Registration"
    │
    ●─── 10 Aug ── Candidate Shortlist
    │                MUFG_Initial_Shortlist.xlsx
    │                Neo ID: A6S2A7G9 ✓ FOUND
    │
    ●─── 11 Aug ── PPT — 11:30 AM
    │                Campus Venue
    │
    ◐─── 13 Aug ── Test — 2:30 PM   ← UPCOMING
    │
    ○─── 14 Aug ── Interview — 10:00 AM
```

- Vertical line with node indicators
- Filled (●) = completed, Half (◐) = current/upcoming, Empty (○) = future
- Each node expandable to show source evidence
- Accent color on the connecting line for upcoming events

### Calendar Event Marker

```
┌─────────┐
│   13    │
│ ● ● ●  │  (colored dots for each event type)
└─────────┘
```

- Small colored dots below the date number
- Hover/click reveals event details in a popover
- Today highlighted with accent ring
- Past dates slightly muted

---

## 9. Animations & Transitions

### Global Transitions

| Property    | Duration | Easing                         |
|-------------|----------|--------------------------------|
| Color       | 150ms    | `ease-in-out`                  |
| Background  | 150ms    | `ease-in-out`                  |
| Transform   | 200ms    | `cubic-bezier(0.4, 0, 0.2, 1)`|
| Opacity     | 200ms    | `ease-in-out`                  |

### Micro-Animations

- **Page transitions**: Fade-in with subtle upward slide (200ms)
- **Card hover**: Subtle lift (`translateY(-1px)`) + shadow increase
- **Status badge**: Gentle pulse on status change
- **Sync button**: Rotating icon while syncing
- **Stats card numbers**: Count-up animation on load
- **Timeline**: Staggered fade-in from top to bottom
- **Toast notifications**: Slide in from top-right, auto-dismiss after 5s
- **Sidebar collapse**: Smooth width transition (200ms)
- **Table row hover**: Background color fade (150ms)

### Loading States

- **Skeleton loaders**: Pulsing gradient animation on placeholder shapes
- **Sync progress**: Animated progress bar with indigo gradient
- **Initial load**: Logo with subtle pulse → content fade-in

---

## 10. Responsive Breakpoints

| Breakpoint | Width    | Layout Changes                          |
|------------|----------|-----------------------------------------|
| `sm`       | 640px    | Single column, bottom nav               |
| `md`       | 768px    | Two-column stats, compact table         |
| `lg`       | 1024px   | Full sidebar appears                    |
| `xl`       | 1280px   | Full layout, wider table                |
| `2xl`      | 1536px   | Max-width container                     |

### Mobile (< 768px)

- Bottom tab navigation (5 tabs: Dashboard, Companies, Calendar, Search, Settings)
- Stats cards: 2-column grid
- Company table → Company cards (stacked)
- Timeline: Full-width vertical
- Sidebar: Hidden (accessible via hamburger menu)

### Tablet (768px - 1024px)

- Collapsible sidebar (icon-only by default)
- Stats cards: 3-column grid
- Compact table with horizontal scroll

### Desktop (> 1024px)

- Full sidebar with labels
- Stats cards: 6-column grid (single row)
- Full table with all columns

---

## 11. Iconography

Use **Lucide Icons** throughout:

| Icon             | Usage                          |
|------------------|--------------------------------|
| `LayoutDashboard`| Dashboard nav                  |
| `Building2`      | Companies nav                  |
| `Calendar`       | Calendar nav                   |
| `Search`         | Search nav                     |
| `Settings`       | Settings nav                   |
| `RefreshCw`      | Sync button                    |
| `Bell`           | Notifications                  |
| `Mail`           | Email source                   |
| `FileSpreadsheet`| XLSX attachment                |
| `FileText`       | PDF/DOCX attachment            |
| `CheckCircle2`   | Neo ID match found             |
| `XCircle`        | Neo ID not found               |
| `Clock`          | Upcoming event                 |
| `ChevronRight`   | Navigation, expandable         |
| `ExternalLink`   | Open source email              |
| `Edit3`          | Manual edit                    |
| `Filter`         | Filter panel                   |
| `Download`       | Download document              |

---

## 12. Dark/Light Mode

### Implementation

- Use CSS custom properties (variables) for all color tokens.
- Toggle via a theme switcher in the topbar.
- Persist preference in `localStorage`.
- Default: **Dark mode**.
- Use Tailwind's `dark:` variant where needed.
- shadcn/ui handles most dark/light switching automatically.

### Light Theme Overrides

| Token                    | Dark Value     | Light Value    |
|--------------------------|----------------|----------------|
| `--background`           | `#0a0a0f`      | `#fafafa`      |
| `--surface`              | `#12121a`      | `#ffffff`      |
| `--surface-hover`        | `#1a1a26`      | `#f5f5f5`      |
| `--border`               | `#2a2a3a`      | `#e5e5e5`      |
| `--text-primary`         | `#f0f0f5`      | `#171717`      |
| `--text-secondary`       | `#8a8a9a`      | `#525252`      |

Status colors remain the same in both themes (with slight opacity adjustments for badges).

---

## 13. Special UI Elements

### Neo ID Display

```
┌──────────────────────┐
│  A6S2A7G9            │  ← JetBrains Mono, tracking-wider
│  Neo ID              │
└──────────────────────┘
```

- Monospace font
- Letter-spacing: `tracking-wider`
- Copy-to-clipboard on click
- Subtle background highlight

### Source Evidence Card

```
┌──────────────────────────────────────────┐
│ 📧  Source: VIT Gmail                    │
│     "MUFG Pre-placement talk and..."     │
│     4 Aug 2026, 3:45 PM                  │
│     [Open Email ↗]                       │
└──────────────────────────────────────────┘
```

- Subtle left border in accent color
- Truncated subject with expand on hover
- External link to open original email in Gmail

### Sync Status Indicator

```
◉ Last synced: 2 minutes ago    (green dot = recent)
◉ Last synced: 3 hours ago      (yellow dot = stale)
◉ Never synced                  (red dot = needs sync)
```

- Located in the topbar near the sync button
- Color-coded dot based on freshness
