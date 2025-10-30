import { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { gmgnService } from "./gmgnService";
import { jupiterService } from "./jupiterService";
import { jupiterTopTrendingService } from "./jupiterTopTrendingService";
import launchpadRoutes from "./launchpadRoutes";
import { priceService } from "./priceService";
import { isAuthenticated, setupAuth } from "./replitAuth";
import { storage } from "./storage";
import { WalletService } from "./walletService";
import { getWalletBalance, signTransaction, transferSol } from "./walletSigning";

// Solana connection (devnet for now)
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication middleware
  await setupAuth(app);
  await jupiterService.start();
  await jupiterTopTrendingService.start();
  await priceService.start();
  gmgnService.start();

  // Wallet connection endpoint - creates user session with wallet info
  app.post("/api/auth/wallet-connect", async (req: any, res) => {
    try {
      const { publicKey, walletType } = req.body;
      const normalizedWalletType = typeof walletType === "string" ? walletType.toLowerCase() : "unknown";

      if (!publicKey || !walletType) {
        return res.status(400).json({ message: "Public key and wallet type are required" });
      }

      // Create a user ID based on the public key (in production, you might want more sophisticated logic)
      const walletSessionId = `wallet_session_${Math.random().toString(36).slice(2)}`;
      const userId = req.user?.id || walletSessionId;

      // Create/update user with wallet info
      const userData = {
        id: userId,
        email: req.user?.email || `${publicKey.slice(0, 8)}@wallet.local`,
        firstName: "Wallet",
        lastName: "User",
        profileImageUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${publicKey}`,
      };

      const user = await storage.upsertUser(userData);

      const sessionUser = {
        id: userId,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
        claims: { sub: userId, email: userData.email },
      };

      await new Promise<void>((resolve, reject) => {
        req.login(sessionUser as any, (err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      // Create or get user's wallet
      let wallet = await storage.getUserWallet(userId);
      if (!wallet) {
        // Create wallet with the connected public key
        wallet = await storage.createAdditionalWallet({
          userId,
          name: `Connected Wallet (${normalizedWalletType.toUpperCase()})`,
          publicKey,
          encryptedPrivateKey: "external-wallet",
          balance: "0",
          isPrimary: "true",
          isArchived: "false"
        });
      }

      // Create a simple session (in production, use proper session management)
      if (req.session) {
        req.session.user = {
          id: userId,
          publicKey,
          walletType,
          email: userData.email,
        };
      }

      res.json({
        success: true,
        user: {
          ...user,
          wallet: {
            publicKey: wallet.publicKey,
            balance: wallet.balance
          }
        }
      });
    } catch (error) {
      console.error("Wallet connection error:", error);
      res.status(500).json({ message: "Failed to connect wallet" });
    }
  });

  // Auth routes - Return null if not authenticated (don't use isAuthenticated middleware)
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      // If not authenticated via passport or session, return null (not 401)
      if (!req.isAuthenticated() && !req.session?.user) {
        return res.json(null);
      }

      // Handle both development and production user objects, and session-based wallet auth
      const userId = req.user?.claims?.sub || req.user?.id || req.session?.user?.id;

      if (!userId) {
        return res.json(null);
      }

      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get or create user's wallet
      let wallet = await storage.getUserWallet(userId);
      if (!wallet) {
        wallet = await storage.createWallet(userId);
      }

      // Return user with wallet info (but not private key)
      res.json({
        ...user,
        wallet: {
          publicKey: wallet.publicKey,
          balance: wallet.balance,
        },
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get wallet balance from blockchain
  app.get("/api/wallet/balance", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const wallet = await storage.getUserWallet(userId);

      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }

      // Fetch balance from Solana blockchain
      const publicKey = new PublicKey(wallet.publicKey);
      const balance = await connection.getBalance(publicKey);
      const balanceInSol = balance / LAMPORTS_PER_SOL;

      // Update stored balance
      await storage.updateWalletBalance(wallet.id, balanceInSol.toString());

      res.json({ balance: balanceInSol });
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      res.status(500).json({ message: "Failed to fetch balance" });
    }
  });

  // Export private key (IMPORTANT: User must be authenticated)
  app.get("/api/wallet/export-key", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const wallet = await storage.getUserWallet(userId);

      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }

      // Decrypt and return private key in base58 format
      const privateKey = WalletService.exportPrivateKey(wallet.encryptedPrivateKey);

      res.json({ privateKey });
    } catch (error) {
      console.error("Error exporting private key:", error);
      res.status(500).json({ message: "Failed to export private key" });
    }
  });

  // Create wallet (in case user wants to regenerate)
  app.post("/api/wallet/create", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;

      // Check if wallet already exists
      const existingWallet = await storage.getUserWallet(userId);
      if (existingWallet) {
        return res.status(400).json({ message: "Wallet already exists" });
      }

      // Create new wallet
      const wallet = await storage.createWallet(userId);

      res.json({
        publicKey: wallet.publicKey,
        balance: wallet.balance,
      });
    } catch (error) {
      console.error("Error creating wallet:", error);
      res.status(500).json({ message: "Failed to create wallet" });
    }
  });

  // Withdraw SOL from custodial wallet
  app.post("/api/wallet/withdraw", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const { recipientAddress, amount } = req.body;

      // Validate inputs
      if (!recipientAddress || !amount) {
        return res.status(400).json({ message: "Recipient address and amount are required" });
      }

      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      // Get user's wallet
      const wallet = await storage.getUserWallet(userId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }

      // Validate recipient address
      let recipientPubKey: PublicKey;
      try {
        recipientPubKey = new PublicKey(recipientAddress);
      } catch (error) {
        return res.status(400).json({ message: "Invalid recipient address" });
      }

      // Get keypair from encrypted private key
      const keypair = WalletService.getKeypair(wallet.encryptedPrivateKey);

      // Check balance
      const balance = await connection.getBalance(keypair.publicKey);
      const balanceInSol = balance / LAMPORTS_PER_SOL;

      // Estimate transaction fee (5000 lamports is typical for simple transfer)
      const estimatedFee = 5000 / LAMPORTS_PER_SOL;

      if (balanceInSol < amountNum + estimatedFee) {
        return res.status(400).json({
          message: "Insufficient balance",
          balance: balanceInSol,
          required: amountNum + estimatedFee
        });
      }

      // Create transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: recipientPubKey,
          lamports: Math.floor(amountNum * LAMPORTS_PER_SOL),
        })
      );

      // Send transaction
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [keypair],
        { commitment: "confirmed" }
      );

      // Update balance in database
      const newBalance = await connection.getBalance(keypair.publicKey);
      const newBalanceInSol = newBalance / LAMPORTS_PER_SOL;
      await storage.updateWalletBalance(wallet.id, newBalanceInSol.toString());

      res.json({
        success: true,
        signature,
        newBalance: newBalanceInSol,
        explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`
      });
    } catch (error) {
      console.error("Error withdrawing SOL:", error);
      res.status(500).json({
        message: "Failed to withdraw SOL",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ========== MULTI-WALLET MANAGEMENT ENDPOINTS ==========

  // List all wallets for authenticated user
  app.get("/api/wallets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const allWallets = await storage.getAllUserWallets(userId);

      // Don't expose encrypted private keys in list view
      const sanitizedWallets = allWallets.map((w: any) => ({
        id: w.id,
        name: w.name,
        publicKey: w.publicKey,
        balance: w.balance,
        isPrimary: w.isPrimary,
        isArchived: w.isArchived,
        createdAt: w.createdAt,
      }));

      res.json(sanitizedWallets);
    } catch (error) {
      console.error("Error fetching wallets:", error);
      res.status(500).json({ message: "Failed to fetch wallets" });
    }
  });

  // Create additional wallet for authenticated user
  app.post("/api/wallets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const { name } = req.body;

      if (!name || typeof name !== "string" || name.length === 0) {
        return res.status(400).json({ message: "Wallet name is required" });
      }

      // Create new wallet
      const { publicKey, encryptedPrivateKey } = WalletService.createWallet();

      const newWallet = await storage.createAdditionalWallet({
        userId,
        name,
        publicKey,
        encryptedPrivateKey,
        balance: "0",
        isPrimary: "false",
        isArchived: "false",
      });

      // Don't expose encrypted private key
      res.json({
        id: newWallet.id,
        name: newWallet.name,
        publicKey: newWallet.publicKey,
        balance: newWallet.balance,
        isPrimary: newWallet.isPrimary,
        isArchived: newWallet.isArchived,
      });
    } catch (error) {
      console.error("Error creating wallet:", error);
      res.status(500).json({ message: "Failed to create wallet" });
    }
  });

  // Update wallet (rename or archive)
  app.patch("/api/wallets/:walletId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const { walletId } = req.params;
      const { name, isArchived } = req.body;

      const wallet = await storage.getWalletById(walletId);

      if (!wallet || wallet.userId !== userId) {
        return res.status(404).json({ message: "Wallet not found" });
      }

      const updatedWallet = await storage.updateWallet(walletId, {
        name: name || wallet.name,
        isArchived: isArchived !== undefined ? isArchived : wallet.isArchived,
      });

      res.json({
        id: updatedWallet.id,
        name: updatedWallet.name,
        publicKey: updatedWallet.publicKey,
        balance: updatedWallet.balance,
        isPrimary: updatedWallet.isPrimary,
        isArchived: updatedWallet.isArchived,
      });
    } catch (error) {
      console.error("Error updating wallet:", error);
      res.status(500).json({ message: "Failed to update wallet" });
    }
  });

  // Refresh specific wallet balance from blockchain
  app.get("/api/wallets/:walletId/balance", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const { walletId } = req.params;

      const wallet = await storage.getWalletById(walletId);

      if (!wallet || wallet.userId !== userId) {
        return res.status(404).json({ message: "Wallet not found" });
      }

      // Fetch balance from Solana blockchain
      const publicKey = new PublicKey(wallet.publicKey);
      const balance = await connection.getBalance(publicKey);
      const balanceInSol = balance / LAMPORTS_PER_SOL;

      // Update cached balance in database
      await storage.updateWalletBalance(wallet.id, balanceInSol.toString());

      res.json({
        balance: balanceInSol,
        publicKey: wallet.publicKey
      });
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      res.status(500).json({ message: "Failed to fetch balance" });
    }
  });

  // Export private key for a specific wallet
  app.get("/api/wallets/:walletId/export-key", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub || req.user.id;
      const { walletId } = req.params;

      const wallet = await storage.getWalletById(walletId);

      if (!wallet || wallet.userId !== userId) {
        return res.status(404).json({ message: "Wallet not found" });
      }

      const privateKey = WalletService.exportPrivateKey(wallet.encryptedPrivateKey);

      res.json({ privateKey });
    } catch (error) {
      console.error("Error exporting private key:", error);
      res.status(500).json({ message: "Failed to export private key" });
    }
  });

  // Wallet signing routes
  app.post("/api/wallet/sign-transaction", isAuthenticated, async (req: any, res) => {
    try {
      const { transaction, publicKey } = req.body;

      if (!transaction || !publicKey) {
        return res.status(400).json({ error: "Missing transaction or publicKey" });
      }

      const signedTransaction = await signTransaction(publicKey, transaction);
      res.json({ signedTransaction });
    } catch (error) {
      console.error("Transaction signing error:", error);
      res.status(500).json({ error: "Failed to sign transaction" });
    }
  });

  app.get("/api/wallet/balance/:publicKey", isAuthenticated, async (req: any, res) => {
    try {
      const { publicKey } = req.params;
      const balance = await getWalletBalance(publicKey);
      res.json({ balance });
    } catch (error) {
      console.error("Balance fetch error:", error);
      res.status(500).json({ error: "Failed to get balance" });
    }
  });

  app.post("/api/wallet/transfer", isAuthenticated, async (req: any, res) => {
    try {
      const { fromPublicKey, toPublicKey, amount } = req.body;

      if (!fromPublicKey || !toPublicKey || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const signature = await transferSol(fromPublicKey, toPublicKey, amount);
      res.json({ signature });
    } catch (error) {
      console.error("Transfer error:", error);
      res.status(500).json({ error: "Failed to transfer SOL" });
    }
  });

  // Jupiter recent tokens (cached snapshot)
  app.get("/api/jupiter/recent", (_req, res) => {
    res.json(jupiterService.getSnapshot());
  });

  // Image proxy endpoint to handle CORS/content-type issues for GIFs and other remote images
  app.get("/api/proxy-image", async (req, res) => {
    try {
      const imageUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
      if (!imageUrl) {
        return res.status(400).json({ error: "URL parameter is required" });
      }

      // Basic URL validation
      try {
        new URL(imageUrl);
      } catch {
        return res.status(400).json({ error: "Invalid URL format" });
      }

      const response = await fetch(imageUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SLAB/1.0)" },
        redirect: "follow",
      });

      if (!response.ok) {
        return res.status(502).json({ error: "Failed to fetch image" });
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      let contentType = response.headers.get("content-type") || "image/jpeg";
      const urlLower = imageUrl.toLowerCase();
      if (!contentType || contentType === "application/octet-stream") {
        if (urlLower.endsWith(".gif")) contentType = "image/gif";
        else if (urlLower.endsWith(".png")) contentType = "image/png";
        else if (urlLower.endsWith(".webp")) contentType = "image/webp";
        else if (urlLower.endsWith(".svg")) contentType = "image/svg+xml";
      }

      res.set({
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      });

      res.send(buffer);
    } catch (err) {
      console.error("/api/proxy-image error:", err);
      res.status(500).json({ error: "Failed to proxy image" });
    }
  });

  // Jupiter recent tokens stream (Server-Sent Events)
  app.get("/api/jupiter/recent/stream", (req, res) => {
    jupiterService.handleStream(req, res);
  });

  // Jupiter token search
  app.get("/api/jupiter/search", async (req, res) => {
    try {
      const query = (req.query.query || req.query.q) as string | undefined;
      const tokens = await jupiterService.searchTokens(query);

      res.json({
        success: true,
        tokens: tokens,
        query: query || null,
        count: tokens.length
      });
    } catch (error) {
      console.error("Error searching Jupiter tokens:", error);
      res.status(500).json({
        success: false,
        message: "Failed to search tokens",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Jupiter Ultra proxy - forward order (GET) and execute (POST) through our server
  // This avoids cross-origin POST preflight issues and centralizes retries/rate-limit handling.
  const JUPITER_ULTRA_BASE = "https://lite-api.jup.ag/ultra/v1";
  const DEFAULT_ULTRA_TIMEOUT_MS = 15000;

  app.get("/api/jupiter/ultra/order", async (req, res) => {
    try {
      const query = req.url.split('?')[1] ?? '';
      const url = `${JUPITER_ULTRA_BASE}/order${query ? `?${query}` : ''}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_ULTRA_TIMEOUT_MS);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "slab-trade/1.0 (+https://slab.trade)",
          Accept: "application/json",
        },
      });
      clearTimeout(timeout);

      const text = await response.text();
      try {
        const json = JSON.parse(text);
        res.status(response.status).json(json);
      } catch {
        res.status(response.status).send(text);
      }
    } catch (err) {
      console.error("/api/jupiter/ultra/order proxy error:", err);
      if ((err as any)?.name === 'AbortError') {
        return res.status(504).json({ success: false, error: 'Jupiter Ultra request timed out' });
      }
      res.status(502).json({ success: false, error: (err instanceof Error) ? err.message : 'Proxy error' });
    }
  });

  app.post("/api/jupiter/ultra/execute", async (req, res) => {
    try {
      const url = `${JUPITER_ULTRA_BASE}/execute`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_ULTRA_TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          "User-Agent": "slab-trade/1.0 (+https://slab.trade)",
          Accept: 'application/json',
        },
        body: JSON.stringify(req.body),
      });
      clearTimeout(timeout);

      const text = await response.text();
      try {
        const json = JSON.parse(text);
        res.status(response.status).json(json);
      } catch {
        res.status(response.status).send(text);
      }
    } catch (err) {
      console.error("/api/jupiter/ultra/execute proxy error:", err);
      if ((err as any)?.name === 'AbortError') {
        return res.status(504).json({ success: false, error: 'Jupiter Ultra execute timed out' });
      }
      res.status(502).json({ success: false, error: (err instanceof Error) ? err.message : 'Proxy error' });
    }
  });

  // Jupiter top traded tokens (cached snapshot)
  app.get("/api/jupiter/top-trending", (_req, res) => {
    res.json(jupiterTopTrendingService.getSnapshot());
  });

  // Jupiter top trending tokens stream (Server-Sent Events)
  app.get("/api/jupiter/top-trending/stream", (req, res) => {
    jupiterTopTrendingService.handleStream(req, res);
  });

  // ========== GMGN TOKEN SERVICE ENDPOINTS ==========

  app.get("/api/gmgn/tokens", (_req, res) => {
    res.json(gmgnService.getSnapshot());
  });

  app.get("/api/gmgn/tokens/stream", (req, res) => {
    gmgnService.handleStream(req, res);
  });

  app.post("/api/gmgn/polling/start", (_req, res) => {
    gmgnService.start();
    const status = gmgnService.getStatus();
    res.json({ success: true, message: "GMGN polling started", ...status });
  });

  app.post("/api/gmgn/polling/stop", (_req, res) => {
    gmgnService.stop();
    const status = gmgnService.getStatus();
    res.json({ success: true, message: "GMGN polling stopped", ...status });
  });

  app.get("/api/gmgn/polling/status", (_req, res) => {
    res.json(gmgnService.getStatus());
  });

  app.post("/api/gmgn/cache/clear", (_req, res) => {
    gmgnService.clear();
    const status = gmgnService.getStatus();
    res.json({ success: true, message: "GMGN cache cleared", ...status });
  });

  app.get("/api/gmgn/search", async (req, res) => {
    try {
      const query = typeof req.query.q === "string" ? req.query.q : req.query.query;
      const chain = typeof req.query.chain === "string" ? req.query.chain : "bsc";

      if (!query || typeof query !== "string" || !query.trim()) {
        return res.status(400).json({ success: false, error: "Query parameter 'q' is required" });
      }

      const results = await gmgnService.search(query, chain);
      res.json({ success: true, data: results });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[GMGN] Search error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  app.get("/api/gmgn/test", async (_req, res) => {
    try {
      const json = await gmgnService.testFetch();
      res.json(json);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Fetch token trades for a given mint via GMGN
  app.get("/api/gmgn/trades/:mint", async (req, res) => {
    try {
      const { mint } = req.params as { mint: string };
      const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : undefined;
      const maker = typeof req.query.maker === "string" ? req.query.maker : undefined;

      if (!mint || typeof mint !== "string") {
        return res.status(400).json({ success: false, error: "Mint parameter is required" });
      }

      const json = await gmgnService.getTokenTrades(mint, { limit, maker });

      res.json({ success: true, data: json });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[GMGN] token trades error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  // Fetch token holders for a given mint via GMGN
  app.get("/api/gmgn/holders/:mint", async (req, res) => {
    try {
      const { mint } = req.params as { mint: string };
      const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : undefined;
      const orderby = typeof req.query.orderby === "string" ? req.query.orderby : undefined;
      const direction = typeof req.query.direction === "string" ? req.query.direction : undefined;
      const cost = typeof req.query.cost === "string" ? parseInt(req.query.cost, 10) : undefined;

      if (!mint || typeof mint !== "string") {
        return res.status(400).json({ success: false, error: "Mint parameter is required" });
      }

      const json = await gmgnService.getTokenHolders(mint, { limit, orderby, direction, cost });

      res.json({ success: true, data: json });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[GMGN] token holders error:", message);
      res.status(500).json({ success: false, error: message });
    }
  });

  // ========== PRICE SERVICE ENDPOINTS ==========

  // Get all crypto prices (BTC, ETH, SOL)
  app.get("/api/prices", (_req, res) => {
    try {
      const prices = priceService.getAllPrices();
      res.json({
        success: true,
        data: prices,
        isStale: priceService.isStale()
      });
    } catch (error) {
      console.error("Error fetching prices:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch prices"
      });
    }
  });

  // Get specific crypto price
  app.get("/api/prices/:symbol", (req, res) => {
    try {
      const { symbol } = req.params;
      const price = priceService.getPrice(symbol);

      if (!price) {
        return res.status(404).json({
          success: false,
          message: `Price data not found for ${symbol.toUpperCase()}`
        });
      }

      res.json({
        success: true,
        data: price,
        isStale: priceService.isStale(symbol)
      });
    } catch (error) {
      console.error("Error fetching price:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch price"
      });
    }
  });

  // Get multiple crypto prices
  app.post("/api/prices/batch", (req, res) => {
    try {
      const { symbols } = req.body;

      if (!Array.isArray(symbols)) {
        return res.status(400).json({
          success: false,
          message: "Symbols must be an array"
        });
      }

      const prices = priceService.getPrices(symbols);

      res.json({
        success: true,
        data: prices,
        requested: symbols,
        found: Object.keys(prices)
      });
    } catch (error) {
      console.error("Error fetching batch prices:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch batch prices"
      });
    }
  });

  // Force refresh prices (admin endpoint)
  app.post("/api/prices/refresh", async (_req, res) => {
    try {
      await priceService.refresh();
      const prices = priceService.getAllPrices();

      res.json({
        success: true,
        message: "Prices refreshed successfully",
        data: prices
      });
    } catch (error) {
      console.error("Error refreshing prices:", error);
      res.status(500).json({
        success: false,
        message: "Failed to refresh prices"
      });
    }
  });

  // Get price service status
  app.get("/api/prices/status", (_req, res) => {
    try {
      const status = priceService.getStatus();
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error("Error fetching price service status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch service status"
      });
    }
  });

  // Register launchpad routes
  app.use("/api/launchpad", launchpadRoutes);

  const httpServer = createServer(app);
  return httpServer;
}
