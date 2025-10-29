const JUPITER_ULTRA_BASE_URL = "https://lite-api.jup.ag/ultra/v1";

export type JupiterUltraSwapMode = "ExactIn" | "ExactOut";

export interface JupiterUltraOrderParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  /**
   * @default "ExactIn"
   */
  swapMode?: JupiterUltraSwapMode;
  /**
   * Alias for swapMode – the API expects both values in some cases.
   * When omitted we mirror swapMode.
   */
  mode?: JupiterUltraSwapMode;
  slippageBps?: number;
  taker?: string;
  quoteId?: string;
  onlyDirectRoutes?: boolean;
  asLegacyTransaction?: boolean;
  platformFeeBps?: number;
  feeAccount?: string;
}

export interface JupiterUltraOrderResponse {
  mode: JupiterUltraSwapMode;
  swapMode: JupiterUltraSwapMode;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  slippageBps: number;
  inUsdValue?: number;
  outUsdValue?: number;
  priceImpact?: number;
  swapUsdValue?: number;
  priceImpactPct?: string;
  routePlan?: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
    bps: number;
  }>;
  feeMint?: string;
  feeBps?: number;
  signatureFeeLamports?: number;
  prioritizationFeeLamports?: number;
  rentFeeLamports?: number;
  swapType?: string;
  router?: string;
  transaction: string;
  gasless?: boolean;
  requestId: string;
  totalTime?: number;
  taker?: string;
  quoteId?: string;
  maker?: string;
  expireAt?: string;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
  errorCode?: number;
  errorMessage?: string;
}

export interface JupiterUltraExecuteRequest {
  signedTransaction: string;
  requestId: string;
}

export interface JupiterUltraExecuteResponse {
  status: string;
  signature?: string;
  slot?: string;
  error?: string;
  code?: number;
  totalInputAmount?: string;
  totalOutputAmount?: string;
  inputAmountResult?: string;
  outputAmountResult?: string;
  swapEvents?: Array<{
    inputMint: string;
    inputAmount: string;
    outputMint: string;
    outputAmount: string;
  }>;
}

const fetchJson = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers as HeadersInit | undefined);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `${response.status} ${response.statusText}`;
    try {
      const errorJson = await response.json();
      errorMessage = typeof errorJson === "string" ? errorJson : JSON.stringify(errorJson);
    } catch {
      try {
        const errorText = await response.text();
        if (errorText) {
          errorMessage = errorText;
        }
      } catch {
        // ignore secondary parse errors
      }
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
};

export async function getJupiterUltraOrder(
  params: JupiterUltraOrderParams,
  signal?: AbortSignal
): Promise<JupiterUltraOrderResponse> {
  const swapMode = params.swapMode ?? "ExactIn";
  const query: Record<string, string> = {
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
    swapMode,
    mode: params.mode ?? swapMode,
  };

  const optionalParams: Array<[keyof JupiterUltraOrderParams, unknown]> = [
    ["slippageBps", params.slippageBps],
    ["taker", params.taker],
    ["quoteId", params.quoteId],
    ["onlyDirectRoutes", params.onlyDirectRoutes],
    ["asLegacyTransaction", params.asLegacyTransaction],
    ["platformFeeBps", params.platformFeeBps],
    ["feeAccount", params.feeAccount],
  ];

  optionalParams.forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    query[key] = typeof value === "boolean" ? String(value) : String(value);
  });

  const searchParams = new URLSearchParams(query);

  return fetchJson<JupiterUltraOrderResponse>(`${JUPITER_ULTRA_BASE_URL}/order?${searchParams.toString()}`, {
    signal,
    // Jupiter handles CORS with GET requests; we omit credentials.
    method: "GET",
  });
}

export async function executeJupiterUltraSwap(
  body: JupiterUltraExecuteRequest,
  signal?: AbortSignal
): Promise<JupiterUltraExecuteResponse> {
  return fetchJson<JupiterUltraExecuteResponse>(`${JUPITER_ULTRA_BASE_URL}/execute`, {
    method: "POST",
    body: JSON.stringify(body),
    signal,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
