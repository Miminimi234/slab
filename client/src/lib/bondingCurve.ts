import { Program, AnchorProvider, web3 } from '@coral-xyz/anchor';
import { PublicKey, Connection, Keypair } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress } from '@solana/spl-token';
import { Buffer } from './bufferPolyfill';

// Meteora Dynamic Bonding Curve Program ID
export const BONDING_PROGRAM_ID = new PublicKey("dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN");

// Tax destination address
export const TAX_DESTINATION = new PublicKey("84ngZsUwXqApU79awKcT2CVLufApUf1NiaTPbAKhngy1");

export interface BondingCurveConfig {
  name: string;
  symbol: string;
  initialSupply: number;
  startPrice: number;
  creatorTaxBps: number; // 200 = 2%
  protocolTaxBps: number; // 100 = 1%
  seedVaultTaxBps: number; // 200 = 2%
  graduationLiquidity: number; // 1M SOL
  graduationHolders: number; // 1000 holders
  graduationAgeHours: number; // 72 hours
}

export class BondingCurveClient {
  private program: Program;
  private provider: AnchorProvider;

  constructor(connection: Connection, wallet: any) {
    this.provider = new AnchorProvider(connection, wallet, {});
    this.program = new Program(BONDING_PROGRAM_ID, this.provider);
  }

  /**
   * Initialize a new bonding curve market
   */
  async initializeMarket(
    config: BondingCurveConfig,
    tokenMint: PublicKey
  ): Promise<string> {
    const [marketPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), Buffer.from(config.name), Buffer.from(config.symbol)],
      BONDING_PROGRAM_ID
    );

    const [tokenVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_vault"), marketPDA.toBuffer()],
      BONDING_PROGRAM_ID
    );

    const [solVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("sol_vault"), marketPDA.toBuffer()],
      BONDING_PROGRAM_ID
    );

    const tx = await this.program.methods
      .initializeMarket(
        config.name,
        config.symbol,
        new web3.BN(config.initialSupply),
        new web3.BN(config.startPrice),
        config.creatorTaxBps,
        config.protocolTaxBps,
        config.seedVaultTaxBps
      )
      .accounts({
        market: marketPDA,
        authority: this.provider.wallet.publicKey,
        tokenMint: tokenMint,
        tokenVault: tokenVaultPDA,
        solVault: solVaultPDA,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  }

  /**
   * Buy tokens on the bonding curve
   */
  async buyTokens(
    marketAddress: PublicKey,
    solAmount: number
  ): Promise<string> {
    const market = await this.program.account.market.fetch(marketAddress);
    
    const userSolAccount = await getAssociatedTokenAddress(
      new PublicKey("So11111111111111111111111111111111111111112"), // SOL mint
      this.provider.wallet.publicKey
    );

    const userTokenAccount = await getAssociatedTokenAddress(
      market.tokenMint,
      this.provider.wallet.publicKey
    );

    const tx = await this.program.methods
      .buyTokens(new web3.BN(solAmount))
      .accounts({
        market: marketAddress,
        userAuthority: this.provider.wallet.publicKey,
        userSolAccount: userSolAccount,
        userTokenAccount: userTokenAccount,
        solVault: market.solVault,
        tokenVault: market.tokenVault,
        marketAuthority: marketAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  }

  /**
   * Sell tokens on the bonding curve
   */
  async sellTokens(
    marketAddress: PublicKey,
    tokenAmount: number
  ): Promise<string> {
    const market = await this.program.account.market.fetch(marketAddress);
    
    const userTokenAccount = await getAssociatedTokenAddress(
      market.tokenMint,
      this.provider.wallet.publicKey
    );

    const userSolAccount = await getAssociatedTokenAddress(
      new PublicKey("So11111111111111111111111111111111111111112"), // SOL mint
      this.provider.wallet.publicKey
    );

    const tx = await this.program.methods
      .sellTokens(new web3.BN(tokenAmount))
      .accounts({
        market: marketAddress,
        userAuthority: this.provider.wallet.publicKey,
        userTokenAccount: userTokenAccount,
        userSolAccount: userSolAccount,
        tokenVault: market.tokenVault,
        solVault: market.solVault,
        marketAuthority: marketAddress,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  }

  /**
   * Graduate market to perpetual trading
   */
  async graduateMarket(marketAddress: PublicKey): Promise<string> {
    const tx = await this.program.methods
      .graduateMarket()
      .accounts({
        market: marketAddress,
        authority: this.provider.wallet.publicKey,
      })
      .rpc();

    return tx;
  }

  /**
   * Get market information
   */
  async getMarketInfo(marketAddress: PublicKey) {
    const market = await this.program.account.market.fetch(marketAddress);
    
    return {
      name: market.name,
      symbol: market.symbol,
      currentPrice: market.currentPrice.toNumber(),
      currentSupply: market.currentSupply.toNumber(),
      totalSupply: market.totalSupply.toNumber(),
      status: market.status,
      totalVolume: market.totalVolume.toNumber(),
      totalTaxCollected: market.totalTaxCollected.toNumber(),
      holderCount: market.holderCount,
      createdAt: market.createdAt,
      graduatedAt: market.graduatedAt,
      taxRates: {
        creator: market.creatorTaxBps,
        protocol: market.protocolTaxBps,
        seedVault: market.seedVaultTaxBps,
      },
      graduationConditions: {
        liquidity: market.graduationLiquidity.toNumber(),
        holders: market.graduationHolders,
        ageHours: market.graduationAgeHours,
      }
    };
  }

  /**
   * Calculate price for a given amount
   */
  async calculatePrice(marketAddress: PublicKey, amount: number, isBuy: boolean) {
    const market = await this.program.account.market.fetch(marketAddress);
    
    if (isBuy) {
      // Simplified price calculation for buying
      const priceIncrease = (amount * market.currentPrice.toNumber()) / 1_000_000;
      const newPrice = market.currentPrice.toNumber() + priceIncrease;
      const tokensReceived = (amount * 1_000_000) / newPrice;
      
      // Calculate taxes (4% total during bonding phase)
      const totalTaxBps = market.creatorTaxBps + market.protocolTaxBps + market.seedVaultTaxBps;
      const taxAmount = (amount * totalTaxBps) / 10000;
      
      return {
        tokensReceived,
        newPrice,
        taxAmount,
        netAmount: amount - taxAmount
      };
    } else {
      // Simplified price calculation for selling
      const solBeforeTax = (amount * market.currentPrice.toNumber()) / 1_000_000;
      const totalTaxBps = market.creatorTaxBps + market.protocolTaxBps + market.seedVaultTaxBps;
      const taxAmount = (solBeforeTax * totalTaxBps) / 10000;
      
      return {
        solReceived: solBeforeTax - taxAmount,
        newPrice: market.currentPrice.toNumber(),
        taxAmount,
        netAmount: solBeforeTax - taxAmount
      };
    }
  }
}

/**
 * Helper function to create a bonding curve market
 */
export async function createBondingCurveMarket(
  connection: Connection,
  wallet: any,
  config: BondingCurveConfig,
  tokenMint: PublicKey
): Promise<string> {
  const client = new BondingCurveClient(connection, wallet);
  return await client.initializeMarket(config, tokenMint);
}

/**
 * Helper function to buy tokens
 */
export async function buyBondingCurveTokens(
  connection: Connection,
  wallet: any,
  marketAddress: PublicKey,
  solAmount: number
): Promise<string> {
  const client = new BondingCurveClient(connection, wallet);
  return await client.buyTokens(marketAddress, solAmount);
}

/**
 * Helper function to sell tokens
 */
export async function sellBondingCurveTokens(
  connection: Connection,
  wallet: any,
  marketAddress: PublicKey,
  tokenAmount: number
): Promise<string> {
  const client = new BondingCurveClient(connection, wallet);
  return await client.sellTokens(marketAddress, tokenAmount);
}
