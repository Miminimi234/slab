import { create } from "zustand";
import type { LaunchFormData } from "@shared/schema";

interface LaunchState {
  formData: LaunchFormData;
  currentStep: number;
  isDeploying: boolean;
  deploymentTx: string | null;
  
  updateFormData: <K extends keyof LaunchFormData>(
    section: K,
    data: Partial<LaunchFormData[K]>
  ) => void;
  setCurrentStep: (step: number) => void;
  resetForm: () => void;
  deployMarket: () => Promise<void>;
}

const initialFormData: LaunchFormData = {
  step: 1,
  basics: { name: "", symbol: "", imageUrl: "" },
  bondingCurve: {
    curveType: "linear",
    startPrice: 0.001,
    creatorTax: 2,
    protocolTax: 1,
    seedVaultTax: 2,
  },
  graduationTriggers: {
    minLiquidity: 1000000,
    minHolders: 1000,
    minAgeHours: 72,
  },
  perpsParams: {
    tickSize: 0.0001,
    lotSize: 1,
    maxLeverage: 20,
    initialMargin: 5,
    maintenanceMargin: 2.5,
    priceBandBps: 1000,
    fundingK: 0.0001,
    warmupHours: 24,
    warmupShortLevCap: 1,
  },
  fees: {
    takerBps: 10,
    makerBps: -2,
    creatorFeePct: 30,
    referrerFeePct: 10,
  },
};

export const useLaunchStore = create<LaunchState>((set, get) => ({
  formData: initialFormData,
  currentStep: 1,
  isDeploying: false,
  deploymentTx: null,

  updateFormData: (section, data) => {
    set((state) => ({
      formData: {
        ...state.formData,
        [section]: { ...state.formData[section], ...data },
      },
    }));
  },

  setCurrentStep: (step) => {
    set({ currentStep: step });
  },

  resetForm: () => {
    set({
      formData: initialFormData,
      currentStep: 1,
      isDeploying: false,
      deploymentTx: null,
    });
  },

  deployMarket: async () => {
    set({ isDeploying: true });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockTx = `0x${Math.random().toString(16).slice(2)}`;
    set({ isDeploying: false, deploymentTx: mockTx });
  },
}));
