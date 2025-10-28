# SLAB Design Guidelines

## Color System (Warm Beige & White UI)

**Core Neutrals**
- Page Background: #FAF8F5 (Soft warm white)
- Surface: #FFFFFF (Pure white for cards)
- Elevated: #F5F2ED (Subtle beige for hover states)
- Borders/Hairlines: #E8E4DD (Soft beige borders)
- Divider Subtle: #EBE8E2

**Typography**
- Primary: #1A1816 (Almost black, warm tone)
- Secondary: #4A4542 (Dark gray)
- Muted: #6B6662 (Medium gray)
- Disabled: #9E9A95 (Light gray)

**Accent Colors (Warm palette)**
- Primary Actions: #D97706 (Warm amber/orange)
- Primary Hover: #B45309
- Primary Pressed: #92400E
- Secondary Interactive: #059669 (Teal green)
- Secondary Hover: #047857
- Tertiary Brand: #7C3AED (Purple accent)
- Tertiary Hover: #6D28D9

**Semantic Colors**
- Info: #2563EB (Blue)
- Success: #059669 (Green)
- Warning: #F59E0B (Amber)
- Error/Urgency: #DC2626 (Red)

**Effects**
- Soft Elevation: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)
- Medium Elevation: 0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.05)
- Focus Ring: 0 0 0 3px rgba(217, 119, 6, 0.25)
- Card Hover Outline: 0 0 0 1px #E8E4DD
- Backdrop: rgba(0, 0, 0, 0.5)
- Popover Surface: #FFFFFF with border #E8E4DD

## Layout System

**Grid Structure**
- Max Width: 1440px centered
- 12-column grid with comfortable gutters
- Top Bar: search, network pill, wallet connect, notifications
- Responsive breakpoints: mobile (bottom sheet), tablet (condensed), desktop (full grid)

## Component Specifications

**Button Styling**
- Primary: bg #D97706 (amber), text #FFFFFF
- Secondary: border #059669, text #059669, hover bg rgba(5, 150, 105, 0.1)
- Ghost: transparent bg, hover bg #F5F2ED
- Danger: bg #DC2626, text #FFFFFF (high-commit actions only)
- Tabs/Active Pill: bg #F5F2ED, border-b #D97706

**Navigation**
- Active item: subtle background with accent border
- Icons from lucide-react
- Clean, minimal design

**Cards & Surfaces**
- Market tiles: white cards with subtle shadows
- Status badges (Bonding/Warmup/Perps) with semantic colors
- Progress rings for graduation metrics
- Clean borders and comfortable padding
- Soft shadows for depth

## Page-Specific Layouts

**Dashboard**
- Featured Market card: clean white card with status badge, graduation progress, KPIs
- Create Market card: explainer with amber "Launch Market" CTA
- Markets Table: clean rows with symbol, status, %→graduation, 24h vol, OI, Trade/Buy buttons

**Launch Wizard**
- 5-step stepper: Basics → Bonding Curve → Graduation Triggers → Perps Params → Fees
- Side-by-side layout: form left, live summary preview right
- Amber "Deploy" CTA, secondary buttons
- Real-time preview of market tile with status timeline

**Market Detail**
- Left area: chart with candles/TWAP toggle, tabs for Trades/Funding/Positions
- Right area: Context-aware trading panel (Bonding/Warmup/Perps modes)
- Optional middle column (xl screens): Order Book + Recent Trades
- Bottom strip: Balances/Open Orders/TWAP/History tabs

**Discover**
- Filterable grid of market tiles
- Status color coding, progress rings, 24h vol, OI
- Filters: Status, Volume, Time

**Creator Dashboard**
- Earnings breakdown from fees
- Launched markets grid
- Referral code generator
- Payout history

## Micro-Interactions

**Timing & Motion**
- Standard transitions: 150-200ms ease
- Loading states: skeleton screens
- Hover: subtle background color change on interactive elements
- Focus: amber ring at 25% opacity

**Feedback**
- Toast notifications for transactions
- Clear validation states
- Error messages in red
- Success messages in green

## Typography Scale

Use modern sans-serif fonts (Inter, system fonts) with comfortable spacing. Establish hierarchy through weight and color contrast.

## Accessibility

- WCAG AA contrast requirements (black text on beige/white backgrounds)
- ARIA labels on all interactive elements
- Keyboard navigation throughout
- Screen reader friendly status announcements
- Mobile: responsive design, touch-friendly targets

## Images

No hero images required. Focus on data visualization, charts, and functional UI elements. Market tiles may include uploaded token/project images (user-provided).
