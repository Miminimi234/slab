import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { AnchorProvider, Program, web3 } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { Buffer } from './bufferPolyfill';

// Meteora Dynamic Bonding Curve Program ID
export const METEORA_DBC_PROGRAM_ID = new PublicKey("dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN");

// Tax destination address for SLAB
export const SLAB_TAX_DESTINATION = new PublicKey("84ngZsUwXqApU79awKcT2CVLufApUf1NiaTPbAKhngy1");

export interface MeteoraBondingConfig {
  name: string;
  symbol: string;
  description: string;
  image: string;
  tokenSupply: number;
  quoteMint: PublicKey; // SOL, USDC, etc.
  sqrtStartPrice: number;
  curve: Array<{ sqrtPrice: number; liquidity: number }>;
  poolFees: {
    baseFee: number;
    dynamicFee?: number;
  };
  collectFeeMode: 0 | 1; // 0 = quote token only, 1 = both tokens
  migrationOption: 0 | 1; // 0 = DammV1, 1 = DammV2
  activationType: 0 | 1; // 0 = slot, 1 = timestamp
  tokenType: 0 | 1; // 0 = SPL Token, 1 = Token2022
  tokenDecimal: number; // 6-9 decimals
  partnerLpPercentage: number;
  partnerLockedLpPercentage: number;
  creatorLpPercentage: number;
  creatorLockedLpPercentage: number;
  migrationQuoteThreshold: number;
  feeClaimer: PublicKey;
  owner: PublicKey;
  migrationFeeOption: number; // 0-6 (0.25%, 0.3%, 1%, 2%, 4%, 6%, Customizable)
  migratedPoolFee?: number; // Only for customizable option
  creatorTradingFeePercentage: number;
  tokenUpdateAuthority: 0 | 1 | 2 | 3 | 4;
  migrationFee: number;
  lockedVesting?: number;
}

export class MeteoraBondingClient {
  private program: Program;
  private provider: AnchorProvider;

  constructor(connection: Connection, wallet: any) {
    this.provider = new AnchorProvider(connection, wallet, {});
    this.program = new Program(METEORA_DBC_PROGRAM_ID, this.provider);
  }

  /**
   * Create a bonding curve configuration
   */
  async createConfiguration(
    config: MeteoraBondingConfig
  ): Promise<string> {
    const [configPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), config.owner.toBuffer()],
      METEORA_DBC_PROGRAM_ID
    );

    const tx = await this.program.methods
      .createConfiguration(
        config.name,
        config.symbol,
        config.description,
        config.image,
        new web3.BN(config.tokenSupply),
        config.quoteMint,
        new web3.BN(config.sqrtStartPrice),
        config.curve.map(c => ({
          sqrtPrice: new web3.BN(c.sqrtPrice),
          liquidity: new web3.BN(c.liquidity)
        })),
        {
          baseFee: new web3.BN(config.poolFees.baseFee),
          dynamicFee: config.poolFees.dynamicFee ? new web3.BN(config.poolFees.dynamicFee) : null
        },
        config.collectFeeMode,
        config.migrationOption,
        config.activationType,
        config.tokenType,
        config.tokenDecimal,
        new web3.BN(config.partnerLpPercentage),
        new web3.BN(config.partnerLockedLpPercentage),
        new web3.BN(config.creatorLpPercentage),
        new web3.BN(config.creatorLockedLpPercentage),
        new web3.BN(config.migrationQuoteThreshold),
        config.feeClaimer,
        config.owner,
        config.migrationFeeOption,
        config.migratedPoolFee ? new web3.BN(config.migratedPoolFee) : null,
        new web3.BN(config.creatorTradingFeePercentage),
        config.tokenUpdateAuthority,
        new web3.BN(config.migrationFee),
        config.lockedVesting ? new web3.BN(config.lockedVesting) : null
      )
      .accounts({
        config: configPDA,
        authority: this.provider.wallet.publicKey,
        quoteMint: config.quoteMint,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  /**
   * Create a virtual pool (bonding curve)
   */
  async createVirtualPool(
    configAddress: PublicKey,
    tokenMint: PublicKey,
    initialLiquidity: number
  ): Promise<string> {
    const [poolPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), configAddress.toBuffer(), tokenMint.toBuffer()],
      METEORA_DBC_PROGRAM_ID
    );

    const [tokenVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_vault"), poolPDA.toBuffer()],
      METEORA_DBC_PROGRAM_ID
    );

    const [quoteVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("quote_vault"), poolPDA.toBuffer()],
      METEORA_DBC_PROGRAM_ID
    );

    const tx = await this.program.methods
      .createVirtualPool(
        new web3.BN(initialLiquidity)
      )
      .accounts({
        pool: poolPDA,
        config: configAddress,
        tokenMint: tokenMint,
        tokenVault: tokenVaultPDA,
        quoteVault: quoteVaultPDA,
        authority: this.provider.wallet.publicKey,
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
    poolAddress: PublicKey,
    quoteAmount: number,
    minTokenAmount: number
  ): Promise<string> {
    const pool = await this.program.account.pool.fetch(poolAddress);
    
    const userQuoteAccount = await getAssociatedTokenAddress(
      pool.quoteMint,
      this.provider.wallet.publicKey
    );

    const userTokenAccount = await getAssociatedTokenAddress(
      pool.tokenMint,
      this.provider.wallet.publicKey
    );

    const tx = await this.program.methods
      .buyTokens(
        new web3.BN(quoteAmount),
        new web3.BN(minTokenAmount)
      )
      .accounts({
        pool: poolAddress,
        userAuthority: this.provider.wallet.publicKey,
        userQuoteAccount: userQuoteAccount,
        userTokenAccount: userTokenAccount,
        quoteVault: pool.quoteVault,
        tokenVault: pool.tokenVault,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  }

  /**
   * Sell tokens on the bonding curve
   */
  async sellTokens(
    poolAddress: PublicKey,
    tokenAmount: number,
    minQuoteAmount: number
  ): Promise<string> {
    const pool = await this.program.account.pool.fetch(poolAddress);
    
    const userTokenAccount = await getAssociatedTokenAddress(
      pool.tokenMint,
      this.provider.wallet.publicKey
    );

    const userQuoteAccount = await getAssociatedTokenAddress(
      pool.quoteMint,
      this.provider.wallet.publicKey
    );

    const tx = await this.program.methods
      .sellTokens(
        new web3.BN(tokenAmount),
        new web3.BN(minQuoteAmount)
      )
      .accounts({
        pool: poolAddress,
        userAuthority: this.provider.wallet.publicKey,
        userTokenAccount: userTokenAccount,
        userQuoteAccount: userQuoteAccount,
        tokenVault: pool.tokenVault,
        quoteVault: pool.quoteVault,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  }

  /**
   * Migrate pool to AMM (graduation)
   */
  async migratePool(
    poolAddress: PublicKey
  ): Promise<string> {
    const tx = await this.program.methods
      .migratePool()
      .accounts({
        pool: poolAddress,
        authority: this.provider.wallet.publicKey,
      })
      .rpc();

    return tx;
  }

  /**
   * Get pool information
   */
  async getPoolInfo(poolAddress: PublicKey) {
    const pool = await this.program.account.pool.fetch(poolAddress);
    
    return {
      tokenMint: pool.tokenMint,
      quoteMint: pool.quoteMint,
      tokenVault: pool.tokenVault,
      quoteVault: pool.quoteVault,
      virtualBaseReserve: pool.virtualBaseReserve.toNumber(),
      virtualQuoteReserve: pool.virtualQuoteReserve.toNumber(),
      realBaseReserve: pool.realBaseReserve.toNumber(),
      realQuoteReserve: pool.realQuoteReserve.toNumber(),
      status: pool.status,
      createdAt: pool.createdAt,
      migratedAt: pool.migratedAt,
      totalVolume: pool.totalVolume.toNumber(),
      totalFees: pool.totalFees.toNumber(),
    };
  }

  /**
   * Calculate price for a given amount
   */
  async calculatePrice(
    poolAddress: PublicKey, 
    amount: number, 
    isBuy: boolean
  ) {
    const pool = await this.program.account.pool.fetch(poolAddress);
    
    if (isBuy) {
      // Calculate tokens received for quote amount
      const quoteReserve = pool.virtualQuoteReserve.toNumber();
      const baseReserve = pool.virtualBaseReserve.toNumber();
      
      // Constant product formula: x * y = k
      const newQuoteReserve = quoteReserve + amount;
      const newBaseReserve = (quoteReserve * baseReserve) / newQuoteReserve;
      const tokensReceived = baseReserve - newBaseReserve;
      
      // Calculate fees
      const config = await this.program.account.config.fetch(pool.config);
      const feeRate = config.poolFees.baseFee.toNumber() / 10000; // Convert bps to decimal
      const fee = amount * feeRate;
      
      return {
        tokensReceived,
        fee,
        netAmount: amount - fee
      };
    } else {
      // Calculate quote received for token amount
      const quoteReserve = pool.virtualQuoteReserve.toNumber();
      const baseReserve = pool.virtualBaseReserve.toNumber();
      
      const newBaseReserve = baseReserve + amount;
      const newQuoteReserve = (quoteReserve * baseReserve) / newBaseReserve;
      const quoteReceived = quoteReserve - newQuoteReserve;
      
      // Calculate fees
      const config = await this.program.account.config.fetch(pool.config);
      const feeRate = config.poolFees.baseFee.toNumber() / 10000;
      const fee = quoteReceived * feeRate;
      
      return {
        quoteReceived: quoteReceived - fee,
        fee,
        netAmount: quoteReceived - fee
      };
    }
  }
}

/**
 * Create a SLAB bonding curve configuration using Meteora DBC
 */
export async function createSlabBondingConfig(
  connection: Connection,
  wallet: any,
  tokenMint: PublicKey,
  quoteMint: PublicKey = new PublicKey("So11111111111111111111111111111111111111112") // SOL
): Promise<string> {
  const client = new MeteoraBondingClient(connection, wallet);
  
  const config: MeteoraBondingConfig = {
    name: "SLAB Token",
    symbol: "SLAB",
    description: "SLAB Bonding Curve Token",
    image: "https://slab.trade/logo.png",
    tokenSupply: 1_000_000,
    quoteMint: quoteMint,
    sqrtStartPrice: 1, // Starting price
    curve: [
      { sqrtPrice: 2, liquidity: 100 },
      { sqrtPrice: 4, liquidity: 500 },
      { sqrtPrice: 8, liquidity: 1000 }
    ],
    poolFees: {
      baseFee: 400, // 4% fee during bonding phase
    },
    collectFeeMode: 0, // Collect fees in quote token only
    migrationOption: 1, // Use DammV2
    activationType: 1, // Use timestamp
    tokenType: 0, // SPL Token
    tokenDecimal: 9,
    partnerLpPercentage: 0, // SLAB gets no LP
    partnerLockedLpPercentage: 0,
    creatorLpPercentage: 0, // Creator gets no LP
    creatorLockedLpPercentage: 0,
    migrationQuoteThreshold: 80, // 80 SOL threshold
    feeClaimer: SLAB_TAX_DESTINATION, // All fees go to SLAB
    owner: wallet.publicKey,
    migrationFeeOption: 1, // 0.3% fee after graduation
    creatorTradingFeePercentage: 0, // Creator gets no trading fees
    tokenUpdateAuthority: 1, // Immutable
    migrationFee: 0, // No migration fee
  };

  return await client.createConfiguration(config);
}

/**
 * Create a bonding curve pool
 */
export async function createBondingCurvePool(
  connection: Connection,
  wallet: any,
  configAddress: PublicKey,
  tokenMint: PublicKey,
  initialLiquidity: number = 1000
): Promise<string> {
  const client = new MeteoraBondingClient(connection, wallet);
  return await client.createVirtualPool(configAddress, tokenMint, initialLiquidity);
}

/**
 * Buy tokens on bonding curve
 */
export async function buyBondingCurveTokens(
  connection: Connection,
  wallet: any,
  poolAddress: PublicKey,
  quoteAmount: number,
  minTokenAmount: number = 0
): Promise<string> {
  const client = new MeteoraBondingClient(connection, wallet);
  return await client.buyTokens(poolAddress, quoteAmount, minTokenAmount);
}

/**
 * Sell tokens on bonding curve
 */
export async function sellBondingCurveTokens(
  connection: Connection,
  wallet: any,
  poolAddress: PublicKey,
  tokenAmount: number,
  minQuoteAmount: number = 0
): Promise<string> {
  const client = new MeteoraBondingClient(connection, wallet);
  return await client.sellTokens(poolAddress, tokenAmount, minQuoteAmount);
}
