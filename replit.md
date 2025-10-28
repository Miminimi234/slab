# SLAB - Solana Launchpad & Bonding Markets

## Overview

SLAB is a decentralized exchange (DEX) platform on Solana for launching and trading perpetual markets utilizing bonding curves. It enables creators to initiate new markets that progress through distinct phases: Bonding (initial price discovery), Warmup (transition), and Perps (full perpetual futures trading). The platform offers a sophisticated trading interface with real-time market data, order books, and comprehensive market management tools, inspired by professional trading platforms.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:** React 18 (TypeScript), Vite, Wouter (routing), TanStack Query (server state), Zustand (client state), Framer Motion, Tailwind CSS (warm beige & white theme).

**UI Component System:** `shadcn/ui` (Radix UI primitives) with warm beige & white design system featuring black text, light backgrounds (#FAF8F5, #FFFFFF), and warm accent colors (amber #D97706, teal #059669, purple #7C3AED).

**State Management:** Three primary Zustand stores (`useMarketsStore`, `useLaunchStore`, `useTradeStore`) for domain-specific client-side state, complemented by React Query for server-side data fetching and caching.

**Page Structure:** Includes Dashboard, Launch (multi-step market creation wizard), Market Detail (trading interface), Discover, Portfolio (multi-wallet management), and Creator (analytics).

### Backend Architecture

**Server Framework:** Express.js with TypeScript, integrated with Vite for development, and a PostgreSQL database utilizing Drizzle ORM.

**Authentication & Authorization:** Leverages Replit Auth for multi-provider OAuth, with Express sessions backed by PostgreSQL. Features protected routes for market creation and creator analytics.

**Custodial Wallet System:** Supports multiple named Solana wallets per user, with automatic primary wallet generation on first login. Private keys are AES-256-CBC encrypted and stored in PostgreSQL. Users can securely export private keys.

**Storage Architecture:** PostgreSQL via `@neondatabase/serverless` and Drizzle ORM. Key tables include `users`, `sessions`, and `wallets` (encrypted Solana keypairs).

**API Endpoints:** RESTful API (`/api/*`) for user authentication, multi-wallet management (list, create, update, balance, export key), and market interactions.

### Data Layer Design

**Schema Architecture:** Centralized TypeScript schema definitions in `shared/schema.ts` defining market lifecycle (`bonding` → `warmup` → `perps`), bonding curve parameters, graduation triggers, perpetuals configuration, and fee structures.

**Database Schema:** `users` table for authentication, `sessions` for Express sessions, and `wallets` for custodial Solana wallets (including encrypted private keys, balances, and archive status).

### Trading Interface Components

**Market Phases:** UI dynamically adapts for Bonding, Warmup, and Perps phases, offering specific trading panels (e.g., bonding curve, perpetual futures ticket with leverage).

**Order Book & Trades:** Real-time order book visualization with bid/ask depth and live trades feed.

**Chart Integration:** Placeholder `MiniCandleCanvas` prepared for integration with advanced charting libraries.

### Styling and Theming

**Color System:** Light beige/white theme with warm backgrounds (#FAF8F5, #FFFFFF), black text (#1A1816), and warm accent colors (amber, teal, purple) for actions and status indicators.

**Tailwind Configuration:** Custom properties for theme colors, border radii, and elevation utilities.

**Typography:** Inter font for UI, JetBrains Mono for numerical data.

## External Dependencies

### UI Framework & Components
- **Radix UI** and **shadcn/ui**
- **Tailwind CSS**
- **Framer Motion**

### State Management & Data Fetching
- **TanStack Query v5**
- **Zustand**
- **React Hook Form**
- **Zod**

### Routing & Navigation
- **Wouter**

### Development Tools
- **Vite**, **TypeScript**, **esbuild**, **tsx**

### Backend & Database
- **Drizzle ORM**
- **@neondatabase/serverless**
- **connect-pg-simple**

### Blockchain & Wallet
- **@solana/web3.js**
- **bs58**
- **Node crypto** (for AES-256-CBC encryption)

### Utility Libraries
- **date-fns**
- **nanoid**
- **clsx & tailwind-merge**

### Platform Integration
- **Replit Vite Plugins**

## Recent Changes

### October 21, 2025 - Color Scheme Redesign
- Complete visual redesign from dark terminal theme to warm beige/white aesthetic
- Updated color palette:
  - Backgrounds: Soft warm white (#FAF8F5), pure white cards (#FFFFFF)
  - Text: Almost black (#1A1816) with excellent contrast for accessibility
  - Accent colors: Warm amber (#D97706), teal green (#059669), purple (#7C3AED)
- Updated design_guidelines.md with new color system specifications
- Replaced all CSS variables in index.css with light theme values
- Verified WCAG AA contrast standards (11:1 for primary text)
- All pages tested and confirmed working with new color scheme