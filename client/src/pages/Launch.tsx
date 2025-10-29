import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { generateLaunchpadMetadata, getLaunchpadConfig } from "@/lib/api";
import { persistTokenRecord } from "@/lib/firebaseTokenRegistry";
import { compressImageFile } from "@/lib/imageCompression";
import { StoredMarketToken, storeMarketToken } from "@/lib/localMarkets";
import { LaunchpadCreateParams, raydiumClient } from "@/lib/raydiumClient";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Image as ImageIcon, Loader2, Rocket, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

// 🔧 Clean Phantom wallet into Raydium-compatible adapter
function makePureWalletAdapter(userWallet: any) {
  let publicKeyString: string;

  // Handle different wallet public key formats
  if (typeof userWallet.publicKey?.toBase58 === 'function') {
    publicKeyString = userWallet.publicKey.toBase58();
  } else if (userWallet.publicKey instanceof PublicKey) {
    publicKeyString = userWallet.publicKey.toBase58();
  } else if (typeof userWallet.publicKey === 'string') {
    publicKeyString = userWallet.publicKey;
  } else if (typeof userWallet.publicKey?.toString === 'function') {
    publicKeyString = userWallet.publicKey.toString();
  } else {
    throw new Error('Unable to extract public key from wallet');
  }

  const publicKey = new PublicKey(publicKeyString);

  return {
    publicKey,
    signTransaction: async (tx: any) => {
      const signed = await userWallet.signTransaction(tx);
      signed.serialize = tx.serialize.bind(signed);
      return signed;
    },
    signAllTransactions: async (txs: any[]) => {
      const signed = await userWallet.signAllTransactions(txs);
      signed.forEach((s, i) => (s.serialize = txs[i].serialize.bind(s)));
      return signed;
    },
  };
}

// Browser wallet types
declare global {
  interface Window {
    phantom?: {
      solana?: {
        publicKey: any;
        signTransaction: (transaction: any) => Promise<any>;
        connect: () => Promise<any>;
      };
    };
    solana?: {
      publicKey: any;
      signTransaction: (transaction: any) => Promise<any>;
      connect: () => Promise<any>;
    };
  }
}

const steps = [
  { number: 1, title: "Basics", subtitle: "Name, symbol, description" },
  { number: 2, title: "Social", subtitle: "Links and branding" },
  { number: 3, title: "Deploy", subtitle: "Launch your slab" },
];

type LaunchFormState = {
  step: number;
  basics: {
    name: string;
    symbol: string;
    description: string;
    imageFile: File | null;
  };
  social: {
    website: string;
    twitter: string;
    telegram: string;
  };
  deployment: {
    creatorSolAmount: number;
  };
};

type LaunchFormSection = keyof Omit<LaunchFormState, "step">;

export default function Launch() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageContentType, setImageContentType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<LaunchFormState>({
    step: 1,
    basics: {
      name: "",
      symbol: "",
      description: "",
      imageFile: null,
    },
    social: {
      website: "",
      twitter: "",
      telegram: ""
    },
    deployment: {
      creatorSolAmount: 1 // Default to 1 SOL - users can choose any amount
    }
  });
  const [minFundraisingRequirement, setMinFundraisingRequirement] = useState<{ lamports: number; sol: number } | null>(null);
  const hasPromptedAuthRef = useRef(false);

  const triggerLoginModal = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("slab-open-login-modal"));
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      hasPromptedAuthRef.current = false;
      return;
    }

    if (!isLoading && !hasPromptedAuthRef.current) {
      hasPromptedAuthRef.current = true;
      toast({
        title: "Authentication Required",
        description: "Connect your wallet to launch a market.",
        variant: "destructive",
      });
      triggerLoginModal();
    }
  }, [isAuthenticated, isLoading, toast]);

  useEffect(() => {
    let cancelled = false;

    const loadLaunchpadRequirements = async () => {
      try {
        const response = await getLaunchpadConfig();
        if (cancelled) return;

        const minFundraising = response.config?.minFundraising;
        if (response.success && minFundraising?.lamports) {
          const lamports = Number(minFundraising.lamports);
          if (Number.isFinite(lamports)) {
            const solValue =
              typeof minFundraising.sol === "number"
                ? minFundraising.sol
                : lamports / LAMPORTS_PER_SOL;

            setMinFundraisingRequirement({ lamports, sol: solValue });
            setFormData(prev => {
              const previousAmount = Number.isFinite(prev.deployment.creatorSolAmount)
                ? prev.deployment.creatorSolAmount
                : 0;
              if (previousAmount >= solValue) {
                return prev;
              }

              return {
                ...prev,
                deployment: {
                  ...prev.deployment,
                  creatorSolAmount: solValue,
                },
              };
            });
          }
        }
      } catch (error) {
        console.error("Failed to load launchpad config:", error);
      }
    };

    loadLaunchpadRequirements();

    return () => {
      cancelled = true;
    };
  }, []);

  // Show authentication required message
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full p-8 text-center">
          <Rocket className="w-16 h-16 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-mono mb-2 text-foreground">Authentication Required</h1>
          <p className="text-muted-foreground mb-6">
            You need to be logged in to launch new markets.
          </p>
          <Button
            onClick={triggerLoginModal}
            className="w-full"
            data-testid="button-login-launch"
          >
            Connect Wallet
          </Button>
        </Card>
      </div>
    );
  }

  const updateFormData = <K extends LaunchFormSection>(
    section: K,
    data: Partial<LaunchFormState[K]>
  ) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as LaunchFormState[K]),
        ...data,
      },
    }));
  };

  const canProceed = () => {
    if (currentStep === 1) return formData.basics.name && formData.basics.symbol && formData.basics.description;
    if (currentStep === 2) return true; // Social links are optional
    return true;
  };

  const isMetadataUriValid = (uri: string) => {
    const value = uri.trim();
    return value.length > 0 && /^https?:\/\//i.test(value);
  };

  const formatSolAmount = (value: number) =>
    value.toLocaleString(undefined, {
      minimumFractionDigits: value < 1 ? 2 : 0,
      maximumFractionDigits: 2,
    });

  // Image handling functions
  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please select an image file (PNG, JPG, GIF, etc.)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    try {
      const compressed = await compressImageFile(file, {
        maxBytes: 50 * 1024,
        maxWidth: 512,
        maxHeight: 512,
      });

      setImagePreview(compressed.dataUrl);
      setImageContentType(compressed.contentType || file.type || null);
      updateFormData("basics", {
        imageFile: file,
      });

      if (compressed.wasCompressed) {
        toast({
          title: "Image Optimized",
          description: `Compressed to ${(compressed.compressedSize / 1024).toFixed(1)} KB (${Math.round((compressed.compressedSize / file.size) * 100)}% of original).`,
        });
      }
    } catch (error) {
      console.error("Image compression failed", error);
      toast({
        title: "Image Processing Failed",
        description: error instanceof Error ? error.message : "Unable to process the selected image.",
        variant: "destructive",
      });
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void handleImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      void handleImageFile(e.target.files[0]);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageContentType(null);
    updateFormData("basics", {
      imageUrl: "",
      metadataUri: "",
      imageFile: null,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const generateMetadata = async (): Promise<string | null> => {
    const trimmedName = formData.basics.name.trim();
    const trimmedSymbol = formData.basics.symbol.trim();

    if (trimmedName.length < 2 || trimmedSymbol.length < 2) {
      toast({
        title: "Incomplete Basics",
        description: "Add a token name and symbol before generating metadata.",
        variant: "destructive",
      });
      return null;
    }

    const imageDataUrl =
      imagePreview && imagePreview.startsWith("data:image")
        ? imagePreview
        : undefined;

    const hostedImageUrl =
      !imageDataUrl && formData.basics.imageUrl ? formData.basics.imageUrl : undefined;

    if (!imageDataUrl && !hostedImageUrl) {
      toast({
        title: "Image Required",
        description: "Upload an image to include in your metadata.",
        variant: "destructive",
      });
      return null;
    }

    setIsGeneratingMetadata(true);

    try {
      const result = await generateLaunchpadMetadata({
        name: trimmedName,
        symbol: trimmedSymbol,
        description: formData.basics.description,
        imageDataUrl,
        imageUrl: hostedImageUrl,
        imageContentType: imageContentType || undefined,
        externalUrl: formData.social.website || undefined,
        attributes: [
          { trait_type: "Platform", value: "SLAB" },
          { trait_type: "Network", value: "devnet" },
        ],
      });

      if (!result.success || !result.metadataUri) {
        throw new Error(result.error || "Failed to host metadata");
      }

      const finalImageUrl = result.imageUrl ?? formData.basics.imageUrl;
      updateFormData("basics", {
        metadataUri: result.metadataUri,
        imageUrl: finalImageUrl ?? "",
      });

      if (result.imageContentType) {
        setImageContentType(result.imageContentType);
      }

      if (result.imageUrl && !result.imageUrl.startsWith("data:")) {
        setImagePreview(result.imageUrl);
      }

      toast({
        title: "Metadata Hosted",
        description: "Token metadata uploaded to Arweave.",
      });

      return result.metadataUri;
    } catch (error) {
      toast({
        title: "Metadata Error",
        description: error instanceof Error ? error.message : "Failed to host metadata.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsGeneratingMetadata(false);
    }
  };

  const ensureMetadataUri = async (): Promise<string | null> => {
    const existing = formData.basics.metadataUri.trim();
    if (existing && isMetadataUriValid(existing)) {
      return existing;
    }
    return await generateMetadata();
  };

  const deployMarket = async () => {
    if (!user?.wallet?.publicKey) {
      toast({
        title: "Wallet Not Found",
        description: "Please ensure you have a wallet connected",
        variant: "destructive",
      });
      return;
    }

    // Check for browser wallet for transaction signing
    const browserWallet = window.phantom?.solana || window.solana;
    if (!browserWallet || !browserWallet.publicKey) {
      toast({
        title: "Browser Wallet Required",
        description: "Please connect your browser wallet (Phantom, Solflare, etc.) to sign transactions",
        variant: "destructive",
      });
      return;
    }

    // Validate that we can create a PublicKey from the wallet
    let walletPublicKey: PublicKey;
    try {
      // Try different methods to get the base58 string from the wallet
      let publicKeyString: string;
      if (typeof browserWallet.publicKey?.toBase58 === 'function') {
        publicKeyString = browserWallet.publicKey.toBase58();
      } else if (browserWallet.publicKey instanceof PublicKey) {
        publicKeyString = browserWallet.publicKey.toBase58();
      } else if (typeof browserWallet.publicKey === 'string') {
        publicKeyString = browserWallet.publicKey;
      } else if (typeof browserWallet.publicKey?.toString === 'function') {
        publicKeyString = browserWallet.publicKey.toString();
      } else {
        throw new Error('Unable to extract public key from wallet');
      }

      walletPublicKey = new PublicKey(publicKeyString);
    } catch (error) {
      console.error('Wallet public key error:', error);
      toast({
        title: "Invalid Wallet Key",
        description: "Unable to read your wallet public key. Please reconnect and try again.",
        variant: "destructive",
      });
      return;
    }

    if (typeof browserWallet.signTransaction !== "function") {
      toast({
        title: "Unsupported Wallet",
        description: "Your wallet does not support signing transactions required for deployment.",
        variant: "destructive",
      });
      return;
    }

    const boundSignTransaction = browserWallet.signTransaction.bind(browserWallet);
    const boundSignAllTransactions =
      typeof browserWallet.signAllTransactions === "function"
        ? browserWallet.signAllTransactions.bind(browserWallet)
        : async (transactions: any[]) => Promise.all(transactions.map(boundSignTransaction));

    // Create a wallet adapter for Raydium SDK
    const walletAdapter = {
      publicKey: walletPublicKey,
      signTransaction: boundSignTransaction,
      signAllTransactions: boundSignAllTransactions,
    };

    const trimmedName = formData.basics.name.trim();
    const trimmedSymbol = formData.basics.symbol.trim();
    const creatorSolAmount = Number(formData.deployment.creatorSolAmount);

    // Basic validation
    if (!trimmedName || !trimmedSymbol) {
      toast({
        title: "Missing Information",
        description: "Please provide both token name and symbol.",
        variant: "destructive",
      });
      return;
    }

    if (!Number.isFinite(creatorSolAmount) || creatorSolAmount < 0) {
      toast({
        title: "Invalid SOL Amount",
        description: "Initial buy amount must be 0 or greater.",
        variant: "destructive",
      });
      return;
    }

    setIsDeploying(true);

    try {
      toast({
        title: "Generating Metadata...",
        description: "Creating token metadata automatically",
      });

      // Auto-generate metadata URI
      let metadataUri = '';
      let metadataImageUrl: string | null = null;
      try {
        const metadataResult = await generateLaunchpadMetadata({
          name: trimmedName,
          symbol: trimmedSymbol,
          description: formData.basics.description || `${trimmedName} - Launched on SLAB`,
          imageDataUrl: imagePreview && imagePreview.startsWith("data:image") ? imagePreview : null,
          imageUrl: formData.basics.imageUrl || null,
          imageContentType: imageContentType,
          externalUrl: formData.social.website || null,
          attributes: [
            { trait_type: "Platform", value: "SLAB" },
            { trait_type: "Network", value: "devnet" },
          ],
        });

        if (metadataResult.success && metadataResult.metadataUri) {
          metadataUri = metadataResult.metadataUri;
          metadataImageUrl = metadataResult.imageUrl || formData.basics.imageUrl || imagePreview || null;
        } else {
          throw new Error(metadataResult.error || 'Failed to generate metadata');
        }
      } catch (error) {
        console.error('Metadata generation failed:', error);
        toast({
          title: "Metadata Generation Failed",
          description: "Using default SLAB metadata. Launch will continue.",
          variant: "destructive",
        });
        // Use fallback metadata URI
        metadataUri = 'https://slab.trade/token-metadata.json';
        metadataImageUrl = formData.basics.imageUrl || imagePreview || null;
      }

      toast({
        title: "Preparing Launch Transactions...",
        description: "Setting up Raydium LaunchLab parameters",
      });

      // Convert user's SOL amount to lamports for optional initial buy
      const userBuyAmountLamports = Math.round(creatorSolAmount * LAMPORTS_PER_SOL);

      toast({
        title: "Initializing Raydium SDK...",
        description: "Setting up client-side SDK with your wallet",
      });

      // Clean Phantom wallet adapter to ensure proper PublicKey instances
      const cleanWallet = makePureWalletAdapter(walletAdapter);

      console.log('[CHECK] Clean wallet sanity:', {
        isPublicKey: cleanWallet.publicKey instanceof PublicKey,
        toBase58Works: typeof cleanWallet.publicKey.toBase58 === 'function',
      });

      // Initialize Raydium SDK with cleaned wallet (following official pattern)
      await raydiumClient.initialize(cleanWallet);

      toast({
        title: "Creating Launchpad...",
        description: "Please approve transactions in your wallet",
      });

      // Create launchpad using simplified client-side SDK (following official pattern)
      const launchpadParams: LaunchpadCreateParams = {
        metadata: {
          name: trimmedName,
          symbol: trimmedSymbol,
          description: formData.basics.description || `${trimmedName} - Launched on SLAB`,
          uri: metadataUri,
        },
        buyAmount: userBuyAmountLamports.toString(),
        createOnly: creatorSolAmount === 0,
        cluster: 'devnet' as 'devnet' | 'mainnet',
      };

      const sdkResult = await raydiumClient.createLaunchpad(launchpadParams, cleanWallet);

      if (!sdkResult.success) {
        throw new Error('Failed to create launchpad with SDK');
      }

      console.log('Launchpad created successfully with SDK:', sdkResult);

      toast({
        title: "🚀 Token Launched Successfully!",
        description: `Your ${trimmedSymbol} token is now live on SLAB with Raydium LaunchLab!`,
      });

      // Log successful deployment
      console.log("Token launched successfully:", {
        name: trimmedName,
        symbol: trimmedSymbol,
        poolId: sdkResult.poolId,
        mintAddress: sdkResult.mintAddress,
        signatures: sdkResult.txIds,
        metadataUri,
      });

      const poolId = sdkResult.poolId && sdkResult.poolId !== "unknown" ? sdkResult.poolId : undefined;
      const creatorAddress = cleanWallet.publicKey.toBase58();
      if (!sdkResult.mintAddress) {
        throw new Error("Mint address missing from Raydium SDK response");
      }
      const mintAddress = sdkResult.mintAddress;

      const marketSnapshot: StoredMarketToken = {
        id: mintAddress,
        mintAddress,
        poolId,
        name: trimmedName,
        symbol: trimmedSymbol.toUpperCase(),
        icon: metadataImageUrl ?? undefined,
        imageUrl: metadataImageUrl ?? undefined,
        metadataUri,
        creator: creatorAddress,
        launchedAt: Date.now(),
        cluster: 'devnet',
        decimals: 6,
        description: formData.basics.description || undefined,
        website: formData.social.website || undefined,
        twitter: formData.social.twitter || undefined,
        telegram: formData.social.telegram || undefined,
        launchpad: "SLAB",
        tags: ["SLAB"],
        usdPrice: 0,
        stats24h: { priceChange: 0, buyVolume: 0, sellVolume: 0 },
        liquidity: 0,
        holderCount: 0,
      };

      try {
        const persisted = await persistTokenRecord({
          mintAddress,
          name: trimmedName,
          symbol: trimmedSymbol.toUpperCase(),
          imageUrl: metadataImageUrl ?? undefined,
          description: formData.basics.description,
          deployer: creatorAddress,
          createdAt: new Date().toISOString(),
        });
        console.info(`[Firebase] Token registry write result: ${persisted ? "success" : "skipped"}`);
      } catch (firebaseError) {
        console.warn("Failed to sync token to Firebase registry", firebaseError);
      }

      storeMarketToken(marketSnapshot);
      navigate(`/market/${encodeURIComponent(trimmedSymbol)}`);

    } catch (error) {
      console.error("Slab deployment failed:", error);
      toast({
        title: "Deployment Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  // Metadata URI validation no longer needed - auto-generated

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold mb-2 text-foreground">
          Launch Slab
        </h1>
        <p className="text-muted-foreground">
          Create a token and launch it on Raydium LaunchLab with a dynamic bonding curve
        </p>
      </motion.div>

      {/* Stepper */}
      <Card className="p-6 border-card-border bg-card">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <motion.div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all ${currentStep === step.number
                    ? "bg-primary border-primary text-primary-foreground glow-mint"
                    : currentStep > step.number
                      ? "bg-success border-success text-black"
                      : "bg-muted border-border text-muted-foreground"
                    }`}
                  whileHover={{ scale: 1.05 }}
                  data-testid={`step-${step.number}`}
                >
                  {currentStep > step.number ? <Check className="w-5 h-5" /> : step.number}
                </motion.div>
                <div className="text-center mt-2 hidden sm:block">
                  <div className="text-xs font-semibold">{step.title}</div>
                  <div className="text-xs text-muted-foreground">{step.subtitle}</div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`h-0.5 flex-1 transition-all ${currentStep > step.number ? "bg-success" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form - 2 cols */}
        <div className="lg:col-span-2">
          <Card className="p-6 border-card-border bg-card min-h-[500px]">
            <AnimatePresence mode="wait">
              {/* Step 1: Basics */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-bold mb-2 text-foreground">Slab Basics</h2>
                    <p className="text-sm text-muted-foreground">Set up your slab identity</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Slab Name</Label>
                      <Input
                        id="name"
                        placeholder="e.g., Bonk Inu"
                        value={formData.basics.name}
                        onChange={(e) => updateFormData("basics", { name: e.target.value })}
                        className="mt-2"
                        data-testid="input-name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="symbol">Symbol</Label>
                      <Input
                        id="symbol"
                        placeholder="e.g., BONK"
                        value={formData.basics.symbol}
                        onChange={(e) => updateFormData("basics", { symbol: e.target.value.toUpperCase() })}
                        className="mt-2"
                        maxLength={10}
                        data-testid="input-symbol"
                      />
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <textarea
                        id="description"
                        placeholder="Describe your slab..."
                        value={formData.basics.description}
                        onChange={(e) => updateFormData("basics", { description: e.target.value })}
                        className="mt-2 w-full px-3 py-2 border border-input bg-background rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                        rows={3}
                        data-testid="input-description"
                      />
                    </div>

                    <div>
                      <Label>Slab Image (optional)</Label>
                      <div className="mt-2">
                        {imagePreview ? (
                          <div className="relative">
                            <div className="aspect-square w-full max-w-48 rounded-md border border-border overflow-hidden bg-muted/10">
                              <img
                                src={imagePreview}
                                alt="Slab preview"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex gap-2 mt-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={removeImage}
                                className="px-3"
                              >
                                <X className="w-4 h-4 mr-2" />
                                Remove
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              Image will be hosted automatically when generating metadata.
                            </p>
                          </div>
                        ) : (
                          <div
                            className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragActive
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                              }`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                          >
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleFileInput}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="space-y-2">
                              <ImageIcon className="w-8 h-8 mx-auto text-muted-foreground" />
                              <div className="text-sm">
                                <span className="text-primary font-medium">Click to upload</span> or drag and drop
                              </div>
                              <div className="text-xs text-muted-foreground">
                                PNG, JPG, GIF up to 5MB
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Social Media */}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-bold mb-2 text-foreground">Social Links</h2>
                    <p className="text-sm text-muted-foreground">Add your social media links (optional)</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        type="url"
                        placeholder="https://yourwebsite.com"
                        value={formData.social.website}
                        onChange={(e) => updateFormData("social", { website: e.target.value })}
                        className="mt-2"
                        data-testid="input-website"
                      />
                    </div>

                    <div>
                      <Label htmlFor="twitter">Twitter</Label>
                      <Input
                        id="twitter"
                        type="url"
                        placeholder="https://twitter.com/yourusername"
                        value={formData.social.twitter}
                        onChange={(e) => updateFormData("social", { twitter: e.target.value })}
                        className="mt-2"
                        data-testid="input-twitter"
                      />
                    </div>

                    <div>
                      <Label htmlFor="telegram">Telegram</Label>
                      <Input
                        id="telegram"
                        type="url"
                        placeholder="https://t.me/yourgroup"
                        value={formData.social.telegram}
                        onChange={(e) => updateFormData("social", { telegram: e.target.value })}
                        className="mt-2"
                        data-testid="input-telegram"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Deploy */}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-bold mb-2 text-foreground">Deploy Your Slab</h2>
                    <p className="text-sm text-muted-foreground">Configure deployment settings and launch your bonding curve market</p>
                  </div>

                  {/* Metadata generation is now automatic - no UI needed */}

                  <div>
                    <Label htmlFor="creator-sol">Initial Buy Amount (Optional)</Label>
                    <div className="mt-2">
                      <div className="relative">
                        <Input
                          id="creator-sol"
                          type="number"
                          step="0.01"
                          min={0}
                          value={formData.deployment.creatorSolAmount}
                          onChange={(e) => updateFormData("deployment", { creatorSolAmount: parseFloat(e.target.value) })}
                          className="pr-16"
                          data-testid="input-creator-sol"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          SOL
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Optional initial purchase amount. You can launch with 0 SOL and let others buy first. The bonding curve graduates at 85 SOL total community purchases.
                      </p>
                      {false && (
                        <p className="text-xs text-destructive mt-1">
                          Increase the amount to meet the minimum LaunchLab requirement.
                        </p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg text-foreground">Deployment Summary</h3>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Slab Name</span>
                        <span className="font-medium text-foreground">{formData.basics.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Symbol</span>
                        <span className="font-medium text-foreground">{formData.basics.symbol}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Metadata URI</span>
                        <span className="font-medium text-foreground truncate max-w-[60%] text-right">
                          {formData.basics.metadataUri || "Not provided"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Initial SOL</span>
                        <span className="font-medium text-foreground">{formData.deployment.creatorSolAmount} SOL</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Graduation Threshold</span>
                        <span className="font-medium text-success">80 SOL</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bonding Curve</span>
                        <span className="font-medium text-foreground">Dynamic Bonding Curve</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Deployment Cost</span>
                        <span className="font-medium text-success">~0.01 SOL</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-muted/10 border border-border rounded-md">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-foreground">Ready to Launch</h4>
                        <p className="text-sm text-muted-foreground">
                          Your token will be created and launched using Raydium LaunchLab's dynamic bonding curve.
                          Graduation happens automatically at 80 SOL total liquidity.
                        </p>
                        <div className="text-xs text-muted-foreground">
                          • Protocol fees may apply during bonding and after graduation. See platform docs for details.
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12"
                    size="lg"
                    onClick={deployMarket}
                    disabled={isDeploying || isGeneratingMetadata}
                    data-testid="button-deploy"
                  >
                    {isDeploying ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Creating Slab...
                      </>
                    ) : (
                      <>
                        <Rocket className="w-5 h-5 mr-2" />
                        Launch Slab
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                disabled={currentStep === 1}
                data-testid="button-prev-step"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
              <div className="text-sm text-muted-foreground">
                Step {currentStep} of {steps.length}
              </div>
              <Button
                onClick={() => setCurrentStep(prev => Math.min(3, prev + 1))}
                disabled={currentStep === 3 || !canProceed()}
                data-testid="button-next-step"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Live Summary - 1 col */}
        <div>
          <Card className="p-6 border-card-border bg-card sticky top-24">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Live Preview</h3>

            {formData.basics.symbol ? (
              <div className="space-y-4">
                <div className="aspect-square w-full rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Slab preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl font-bold text-primary">{formData.basics.symbol.slice(0, 2)}</span>
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-lg text-foreground">{formData.basics.symbol}</h4>
                  <p className="text-sm text-muted-foreground">{formData.basics.name || "Your slab name"}</p>
                  {formData.basics.description && (
                    <p className="text-xs text-muted-foreground mt-1">{formData.basics.description}</p>
                  )}
                </div>

                <Separator />

                <div className="space-y-3 text-sm">
                  <div>
                    <Badge variant="outline" className="mb-2">Bonding Curve</Badge>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="flex-1 h-1 bg-warning rounded" />
                      <span className="text-warning">Bonding Phase</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs mt-1">
                      <div className="flex-1 h-1 bg-success rounded" />
                      <span className="text-success">Graduation at 80 SOL</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Initial SOL</span>
                      <span className="font-mono font-medium text-foreground">{formData.deployment.creatorSolAmount} SOL</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Graduation</span>
                      <span className="font-mono font-medium text-success">80 SOL</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax Rate</span>
                      <span className="font-mono font-medium text-foreground">4% â†’ 1%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Deployment</span>
                      <span className="font-mono font-medium text-success">~0.01 SOL</span>
                    </div>
                  </div>

                  {(formData.social.website || formData.social.twitter || formData.social.telegram) && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Social Links</div>
                        {formData.social.website && (
                          <div className="text-xs text-primary truncate">ðŸŒ {formData.social.website}</div>
                        )}
                        {formData.social.twitter && (
                          <div className="text-xs text-primary truncate">ðŸ¦ {formData.social.twitter}</div>
                        )}
                        {formData.social.telegram && (
                          <div className="text-xs text-primary truncate">ðŸ“± {formData.social.telegram}</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  Fill in slab details to see preview
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div >
  );
}

