import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

export default function Docs() {
    const [, setLocation] = useLocation();

    return (
        <div className="max-w-7xl mx-auto py-8">
            <div className="grid grid-cols-12 gap-6">
                {/* Sidebar */}
                <aside className="col-span-12 md:col-span-3">
                    <Card className="p-4 sticky top-20 space-y-4">
                        <h3 className="text-sm font-semibold">Documentation</h3>
                        <nav className="flex flex-col text-sm text-muted-foreground space-y-2">
                            <a href="#welcome" className="hover:text-foreground">Welcome to Slab</a>
                            <a href="#architecture" className="hover:text-foreground">Architecture Overview</a>
                            <a href="#creating" className="hover:text-foreground">Creating Your First Slab</a>
                            <a href="#trading" className="hover:text-foreground">Trading on a Slab</a>
                            <a href="#trenches" className="hover:text-foreground">Trenches Browser</a>
                            <a href="#launchpad" className="hover:text-foreground">Launchpad Integration</a>
                            <a href="#discover" className="hover:text-foreground">Discover Page</a>
                        </nav>
                        <div className="pt-2 border-t border-border" />
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setLocation('/')}>Home</Button>
                            <Button onClick={() => setLocation('/discover')}>Discover</Button>
                        </div>
                    </Card>
                </aside>

                {/* Content */}
                <main className="col-span-12 md:col-span-9 space-y-8">
                    <article id="welcome" className="prose max-w-none">
                        <div className="whitespace-pre-wrap">{`🧱 Welcome to Slab’s Documentation!
Build with Slab

Learn how to launch leverage markets, deploy token pools, and trade with amplified power on Solana’s most dynamic leverage and liquidity protocol.

Slab transforms any token — even those born from bonding curves — into a live, tradeable leverage market.
Creators, contributors, and traders come together through automated liquidity mechanics to unlock a new kind of decentralized margin system built directly into the Solana network.

⚡ What is Slab?

Slab is a decentralized leverage trading protocol that lets users trade memecoins and emerging Solana tokens with leverage, powered by on-chain lending pools called Slabs.

Creators open a Slab pool for any token by providing the first liquidity.

Contributors deposit into existing Slabs to earn yield from protocol fees and trader liquidations.

Traders borrow from the Slab pool to multiply their trading position — gaining leverage without centralized risk.

Every trade, liquidation, and payout is handled automatically by the protocol, ensuring instant settlement and full transparency.

🧭 Core Features
🏗️ Slab Markets

Each token on Solana can host a Slab Market, an autonomous liquidity pool that powers leveraged trading.

If a Slab Market exists → users can start leveraged trades instantly.

If not → you can start the first Slab, bootstrap liquidity, and earn from it.

All pool economics — lending, fees, and liquidation — are automated by Slab smart contracts.

🌊 Trenches Browser

The Trenches Browser is your real-time explorer for the Solana ecosystem:

Track new token launches across major platforms like Pump.fun, Bonk Launchpad, and others.

See tokens as they’re created, about to migrate, or have completed migration.

Slab integrates seamlessly with these tokens, allowing users to open markets the moment a token goes live.

🚀 Launchpad Integration

Slab doubles as a launchpad, enabling users to:

Deploy new tokens directly to the Raydium Program ID.

Automatically generate liquidity and activate Slab compatibility.

Transition from launch → liquidity → leverage in one flow.

🔍 Discover Page

A real-time analytics layer that showcases:

The top trading tokens across Solana, ranked by volume, volatility, and leverage activity.

Live trader and pool metrics, with sortable and filterable insights.

Direct entry points to start trading or open a Slab instantly.

🧱 Slab Ecosystem Roles
Role	Description	Rewards
Creator	Starts a Slab Market by opening and funding a pool.	Earns share of trading and liquidation fees.
Contributor	Provides additional liquidity to an existing Slab.	Earns passive yield from protocol fees.
Trader	Borrows from the Slab pool to gain leveraged exposure.	Gains amplified returns (or liquidations).
💡 Why Slab?

Composability – Integrates directly with bonding curve tokens and live Solana launches.

Automation – All lending, borrowing, liquidation, and fee distribution are handled by smart contracts.

Scalability – Designed for memecoins and high-frequency market creation.

Accessibility – Anyone can launch a market on any token.

📘 Next Steps

Ready to dive in?

← Architecture Overview
		|		Creating Your First Slab → lets make the first page of the docs with this  
`}</div>
                    </article>

                    <section id="architecture" className="prose max-w-none">
                        <h2>⚙️ Architecture Overview</h2>
                        <p><strong>How Slab Works</strong></p>
                        <p>
                            Slab is powered by Meteora DLMM, extending its dynamic liquidity engine into a decentralized leverage
                            protocol. It introduces fully automated lending, liquidation, and payout logic — all orchestrated on-chain
                            without intermediaries.
                        </p>

                        <h3>🧩 System Components</h3>
                        <h4>1. Slab Pool (DLMM-Powered)</h4>
                        <p>
                            Each Slab Market runs on a Meteora DLMM pool, managing concentrated liquidity for a given token pair.
                        </p>

                        <h4>2. Slab Protocol Layer</h4>
                        <p>
                            The protocol layer automates everything between trade entry and payout: opens/closes positions, tracks
                            collateral, executes liquidations and distributes fees.
                        </p>

                        <h4>3. Insurance Vault (Protocol Safety Layer)</h4>
                        <p>
                            A separate Insurance Vault acts as a liquidity backstop when liquidation events result in deficits.
                        </p>

                        <h4>4. Smart Contract Roles</h4>
                        <p>Creator, Contributor, Trader, Protocol, Insurance Vault — each with distinct responsibilities and fee shares.</p>

                        <h4>5. Automation & Settlement Flow</h4>
                        <ol>
                            <li>Market Initialization</li>
                            <li>Liquidity Locking</li>
                            <li>Trade Execution</li>
                            <li>Monitoring & Liquidation</li>
                            <li>Settlement</li>
                        </ol>

                        <h4>6. Technical Stack</h4>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-muted-foreground"><th>Layer</th><th>Technology</th><th>Description</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>Smart Contracts</td><td>Rust + Anchor (Solana)</td><td>Manages Slab pools, positions, vault logic, and fee distribution.</td></tr>
                                <tr><td>Liquidity Engine</td><td>Meteora DLMM</td><td>Core AMM providing efficient price ticks and liquidity ranges.</td></tr>
                                <tr><td>Frontend</td><td>React + TypeScript</td><td>Market UI, analytics dashboard, trading terminals.</td></tr>
                            </tbody>
                        </table>

                        <h3>🪄 Lifecycle Example</h3>
                        <p>Example flow of creating a BONK/SOL Slab, trading, liquidation and vault coverage.</p>

                        <div className="flex items-center gap-4">
                            <a className="text-primary hover:underline" href="#welcome">← Welcome to Slab</a>
                            <a className="text-primary hover:underline ml-auto" href="#creating">Creating Your First Slab →</a>
                        </div>
                    </section>

                    <section id="creating" className="prose max-w-none">
                        <h2>🚀 Creating Your First Slab</h2>
                        <p>Launch a Leverage Market in Minutes</p>

                        <h3>🧭 Step-by-Step: Launching a Slab</h3>
                        <ol>
                            <li>Enter the Token Mint Address</li>
                            <li>Select Pool Type (Meteora DLMM)</li>
                            <li>Configure Pool Parameters (Capital, Lend Ratio, Duration)</li>
                            <li>Review and Agree</li>
                            <li>Launch the Slab</li>
                        </ol>

                        <h4>⚙️ Managing Your Slab</h4>
                        <p>View analytics, extend duration, withdraw or close when lifecycle ends.</p>

                        <h4>🧠 Tip</h4>
                        <p>Use moderate lend ratios (40–70%) for new or low-volume tokens.</p>

                        <div className="flex items-center gap-4">
                            <a className="text-primary hover:underline" href="#architecture">← Architecture Overview</a>
                            <a className="text-primary hover:underline ml-auto" href="#trading">Trading on a Slab →</a>
                        </div>
                    </section>

                    <section id="trading" className="prose max-w-none">
                        <h2>💹 Trading on a Slab</h2>
                        <p>Leverage Any Token. Instantly.</p>

                        <h3>🧭 Step-by-Step: Opening a Trade</h3>
                        <ol>
                            <li>Select a Slab</li>
                            <li>Choose Order Type (Market / Limit)</li>
                            <li>Set Side & Size</li>
                            <li>Adjust Leverage</li>
                            <li>Review Trade Summary</li>
                            <li>Place Order</li>
                        </ol>

                        <h4>⚙️ Position Lifecycle</h4>
                        <ol>
                            <li>Entry</li>
                            <li>Monitoring</li>
                            <li>Liquidation</li>
                            <li>Settlement</li>
                        </ol>

                        <h4>⚖️ Risk Note</h4>
                        <p>Leverage amplifies both gains and losses. Trade responsibly.</p>

                        <div className="flex items-center gap-4">
                            <a className="text-primary hover:underline" href="#creating">← Creating Your First Slab</a>
                            <a className="text-primary hover:underline ml-auto" href="#trenches">The Trenches Browser →</a>
                        </div>
                    </section>

                    <section id="trenches" className="prose max-w-none">
                        <h2>🌋 Trenches Browser</h2>
                        <p>Explore Every Token As It’s Born — a real-time scanner that tracks tokens across launch platforms.</p>
                        <h4>🧠 What the Trenches Browser Does</h4>
                        <p>Classifies tokens into New Pairs, Final Stretch, and Migrated stages and surfaces metrics and links to create Slabs.</p>

                        <div className="flex items-center gap-4">
                            <a className="text-primary hover:underline" href="#trading">← Trading on a Slab</a>
                            <a className="text-primary hover:underline ml-auto" href="#launchpad">Launching Tokens with Slab Launchpad →</a>
                        </div>
                    </section>

                    <section id="launchpad" className="prose max-w-none">
                        <h2>🚀 Launching Tokens with Slab Launchpad</h2>
                        <p>Deploy. Seed. Leverage. All in One Place.</p>
                        <h4>🧭 Step-by-Step: Launching Your Token</h4>
                        <ol>
                            <li>Configure Token Details</li>
                            <li>Select Pool Type (Meteora DLMM)</li>
                            <li>Add Initial Capital</li>
                            <li>Set Slab Lifecycle</li>
                            <li>Confirm and Deploy</li>
                        </ol>

                        <div className="flex items-center gap-4">
                            <a className="text-primary hover:underline" href="#trenches">← Trenches Browser</a>
                            <a className="text-primary hover:underline ml-auto" href="#discover">Discover Page →</a>
                        </div>
                    </section>

                    <section id="discover" className="prose max-w-none">
                        <h2>📈 Discover Page</h2>
                        <p>
                            Monitor the pulse of Slab’s leverage markets — top tokens, active Slabs, and real-time performance data.
                        </p>

                        <h4>⚡ Overview</h4>
                        <p>Top trading tokens by volume, volatility and open interest. Direct actions to trade or create a Slab.</p>

                        <div className="pt-6 border-t border-border" />
                        <div className="flex justify-between items-center">
                            <div className="text-sm text-muted-foreground">End of docs (preview)</div>
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                                    <ArrowLeft className="mr-2" /> Back to top
                                </Button>
                                <Button onClick={() => setLocation('/')}>Close <ArrowRight className="ml-2" /></Button>
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}
