// src/interfaces/types.ts
// Типы данных для Solana Manual Sniper

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  totalSupply?: number;
}

export interface TokenAnalysis {
  mint: string;
  isValid: boolean;
  isHoneypot: boolean;
  liquidityUSD: number;
  holdersCount: number;
  marketCap?: number;
  age: number; // seconds since creation
  warnings: string[];
  score: number; // 0-100, где 100 = отличный токен
}

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: any;
  priceImpactPct: string;
  routePlan: RouteInfo[];
}

export interface RouteInfo {
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
}

export interface SwapTransaction {
  swapTransaction: string; // base64 encoded transaction
}

export interface TradeConfig {
  solAmount: number;
  slippageBps: number;
  priorityFee?: number;
  maxRetries: number;
}

export interface SniperConfig {
  // RPC settings
  rpcUrl: string;
  backupRpcUrl?: string;
  
  // Wallet
  privateKey: string;
  
  // Trading defaults  
  defaultSolAmount: number;
  maxSlippage: number;
  minLiquidityUSD: number;
  
  // Analysis settings
  honeypotCheck: boolean;
  autoOpenCharts: boolean;
  
  // Risk management
  maxTradeSize: number;
  dailyLimit: number;
}

export interface SnipeResult {
  success: boolean;
  signature?: string;
  error?: string;
  tokenAmount?: number;
  solSpent?: number;
  priceImpact?: number;
  executionTime?: number;
}

export interface TokenMetrics {
  price: number;
  priceChange24h?: number;
  volume24h?: number;
  marketCap?: number;
  fdv?: number; // fully diluted valuation
  liquidityUSD: number;
}

export interface HoneypotResult {
  isHoneypot: boolean;
  buyTax?: number;
  sellTax?: number;
  transferTax?: number;
  canSell: boolean;
  warnings: string[];
}

export interface QuickBuyOptions {
  tokenMint: string;
  solAmount?: number;
  slippage?: number;
  skipAnalysis?: boolean;
  autoConfirm?: boolean;
}

// CLI Response types
export type UserChoice = 'buy' | 'skip' | 'charts' | 'analyze' | 'quit';

export interface CliPrompt {
  message: string;
  choices: UserChoice[];
  default?: UserChoice;
}

// Error types
export class SniperError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SniperError';
  }
}

export enum ErrorCodes {
  INVALID_TOKEN = 'INVALID_TOKEN',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS', 
  SLIPPAGE_EXCEEDED = 'SLIPPAGE_EXCEEDED',
  HONEYPOT_DETECTED = 'HONEYPOT_DETECTED',
  LOW_LIQUIDITY = 'LOW_LIQUIDITY',
  RPC_ERROR = 'RPC_ERROR',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  WALLET_ERROR = 'WALLET_ERROR'
}