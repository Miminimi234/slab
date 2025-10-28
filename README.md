# SLAB - Solana Launchpad & Bonding Markets

A comprehensive trading platform built on Solana that enables users to create, discover, and trade perpetual markets with dynamic bonding curves. SLAB provides a seamless transition from bonding curve phases to perpetual trading, powered by Meteora's Dynamic Bonding Curve technology.

## Features

### Core Trading Platform
- **Dynamic Bonding Curves**: Create and trade tokens with automated price discovery
- **Perpetual Markets**: Seamless transition from bonding to perpetual trading
- **Multi-Wallet Support**: Trade with multiple custodial wallets simultaneously
- **Real-time Data**: Live price updates, order books, and trade feeds
- **Social Integration**: Connect with project communities via website, Twitter, and Telegram

### Market Creation
- **Launch Slab**: Simple 3-step process to launch new tokens
- **Custom Parameters**: Configure bonding curves, graduation triggers, and trading parameters
- **Social Media Integration**: Add website, Twitter, and Telegram links
- **Image Upload**: Drag-and-drop token image upload with preview
- **Initial Liquidity**: Set initial SOL amount for market launch

### Trading Interface
- **Advanced Order Types**: Market, limit, and stop orders
- **Leverage Trading**: Up to 100x leverage on perpetual markets
- **Multi-Wallet Allocation**: Allocate specific SOL amounts across multiple wallets
- **Real-time Charts**: Interactive price charts with technical indicators
- **Order Management**: Track and manage open positions and orders

### User Experience
- **Responsive Design**: Optimized for desktop and mobile devices
- **Dark Theme**: Professional dark interface with smooth animations
- **Intuitive Navigation**: Clean, modern UI with clear information hierarchy
- **Real-time Updates**: Live price feeds and market data
- **Social Features**: Follow projects and join communities

## Technology Stack

### Frontend
- **React 18**: Modern React with hooks and functional components
- **TypeScript**: Type-safe development with full type coverage
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework for rapid styling
- **Framer Motion**: Smooth animations and transitions
- **Wouter**: Lightweight routing solution

### Backend
- **Node.js**: Server-side JavaScript runtime
- **Express.js**: Web application framework
- **PostgreSQL**: Relational database with Drizzle ORM
- **Passport.js**: Authentication middleware

### Blockchain Integration
- **Solana Web3.js**: Solana blockchain interaction
- **Anchor Framework**: Solana program development
- **Meteora Integration**: Dynamic Bonding Curve implementation
- **SPL Token Standard**: Token creation and management

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn package manager
- PostgreSQL database
- Solana CLI tools (for development)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/greaterdan/slab.trade.git
cd slab.trade
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env
```

Configure the following environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `WALLET_ENCRYPTION_KEY`: Encryption key for custodial wallets
- `SESSION_SECRET`: Session encryption secret
- `DOMAIN`: Application domain for OAuth callbacks

4. Set up the database:
```bash
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Project Structure

```
slab.trade/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Application pages
│   │   ├── lib/           # Utility libraries
│   │   ├── stores/        # State management
│   │   └── percolator/    # Solana transaction builders
│   └── public/            # Static assets
├── server/                # Backend Express application
│   ├── routes.ts         # API route handlers
│   ├── db.ts             # Database configuration
│   ├── auth.ts           # Authentication logic
│   └── walletService.ts  # Custodial wallet management
├── shared/               # Shared types and schemas
├── programs/            # Solana smart contracts
└── docs/               # Documentation
```

## API Endpoints

### Authentication
- `GET /api/auth/user` - Get current user
- `POST /api/logout` - User logout

### Markets
- `GET /api/markets` - Fetch all markets
- `GET /api/markets/:symbol` - Get market by symbol
- `POST /api/markets` - Create new market

### Trading
- `POST /api/trades` - Execute trade
- `GET /api/orderbook/:marketId` - Get order book
- `GET /api/trades/:marketId` - Get recent trades

### Wallets
- `GET /api/wallets` - Get user wallets
- `POST /api/wallets` - Create new wallet
- `POST /api/wallet/transfer` - Transfer SOL between wallets

## Smart Contracts

### Bonding Curve Contract
The platform integrates with Meteora's Dynamic Bonding Curve for automated price discovery and graduation mechanics.

**Key Features:**
- Linear and exponential bonding curves
- Automatic graduation at 80 SOL liquidity threshold
- Tax distribution to protocol and creator addresses
- Seamless transition to perpetual trading

**Graduation Conditions:**
- Liquidity: 80 SOL total volume
- Automatic graduation when threshold is met

## Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - TypeScript type checking
- `npm run db:push` - Push database schema changes

### Code Style
- ESLint configuration for code quality
- Prettier for code formatting
- TypeScript strict mode enabled
- Component-based architecture

## Deployment

### Vercel Deployment
The application is configured for Vercel deployment with:
- Static frontend build
- Serverless API functions
- Environment variable configuration
- Automatic deployments from main branch

### Environment Setup
1. Configure environment variables in Vercel dashboard
2. Set up PostgreSQL database (Neon recommended)
4. Deploy from GitHub repository

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Contact the development team
- Check the documentation in the `/docs` folder

## Roadmap

- Enhanced charting capabilities
- Advanced order types
- Mobile application
- Cross-chain integration
- Institutional trading features
- API for third-party integrations
