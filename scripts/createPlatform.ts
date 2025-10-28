import { DEVNET_PROGRAM_ID, Raydium, TxVersion } from '@raydium-io/raydium-sdk-v2';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import base58 from 'bs58';
import 'dotenv/config';

// Initialize Raydium SDK
async function initSdk() {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    // Load wallet from environment
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('WALLET_PRIVATE_KEY not found in environment variables. Please check your .env file.');
    }

    const owner = Keypair.fromSecretKey(base58.decode(privateKey));

    const raydium = await Raydium.load({
        connection,
        owner,
        cluster: 'devnet',
        disableFeatureCheck: true
    });

    return raydium;
}

export const createPlatform = async () => {
    const raydium = await initSdk();
    const owner = raydium.ownerPubKey;

    console.log(`🔑 Wallet: ${owner.toBase58()}`);
    console.log(`🌐 Network: devnet`);

    // Check wallet balance
    const balance = await raydium.connection.getBalance(owner);
    console.log(`💰 Balance: ${balance / 1e9} SOL`);

    if (balance < 0.1 * 1e9) {
        throw new Error('Insufficient SOL balance. Need at least 0.1 SOL for platform creation.');
    }

    console.log('📝 Creating SLAB platform configuration...');

    /** notice: every wallet only enables to create "1" platform config */
    const { transaction, extInfo, execute } = await raydium.launchpad.createPlatformConfig({
        programId: DEVNET_PROGRAM_ID.LAUNCHPAD_PROGRAM, // devnet program ID
        platformAdmin: owner,
        platformClaimFeeWallet: owner,
        platformLockNftWallet: owner,
        cpConfigId: new PublicKey('5MxLgy9oPdTC3YgkiePHqr3EoCRD9uLVYRQS2ANAs7wy'), // devnet CP config from official example

        transferFeeExtensionAuth: owner, // use owner instead of specific authority

        creatorFeeRate: new BN('0'), // set to 0 like the official example
        /**
         * when migration, launchpad pool will deposit mints in vaultA/vaultB to new cpmm pool
         * and return lp to migration wallet
         * migrateCpLockNftScale config is to set up usage of these lp
         * note: sum of these 3 should be 10**6, means percent (0%~100%)
         */
        migrateCpLockNftScale: {
            platformScale: new BN(400000), // 40% like official example
            creatorScale: new BN(500000),  // 50% like official example
            burnScale: new BN(100000),     // 10% like official example
        },
        feeRate: new BN(1000), // 0.1% like official example
        name: 'SLAB Platform',
        web: 'https://slab.trade',
        img: 'https://i.ibb.co/230s7Rw5/slablogo.png',
        txVersion: TxVersion.V0,
    });

    console.log(`🚀 Sending transaction...`);

    try {
        const sentInfo = await execute({ sendAndConfirm: true });
        console.log('\n✅ SLAB Platform Created Successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🆔 Platform Config ID: ${extInfo.platformId.toBase58()}`);
        console.log(`🔗 Transaction: https://solscan.io/tx/${sentInfo.txId}?cluster=devnet`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n📝 Next Steps:');
        console.log('1. Copy the Platform Config ID above');
        console.log('2. Update your .env file:');
        console.log(`   SLAB_PLATFORM_CONFIG_ID=${extInfo.platformId.toBase58()}`);
        console.log('3. Restart your development server');
        console.log('\n🎉 Your SLAB platform is now ready to launch tokens!');
    } catch (e: any) {
        console.error('❌ Error creating platform:', e);
        throw e;
    }
}

async function main() {
    await createPlatform();
}

main().catch((error) => {
    console.error('❌ Error creating platform:', error);
    process.exit(1);
});