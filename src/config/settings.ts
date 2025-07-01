// src/config/settings.ts
// ⚡ НАСТРОЙКИ ДЛЯ МАКСИМАЛЬНОЙ СКОРОСТИ

import dotenv from 'dotenv';
import { SniperConfig, SniperError, ErrorCodes } from '../interfaces/types';

dotenv.config();

interface SpeedConfig extends SniperConfig {
  // 🚀 НОВЫЕ НАСТРОЙКИ СКОРОСТИ
  priorityFeeLamports: number;
  skipPreflight: boolean;
  aggressiveTimeouts: boolean;
  legacyOnly: boolean;
  ultraFastMode: boolean;
}

class Settings {
  private static instance: Settings;
  public config: SpeedConfig;

  private constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  public static getInstance(): Settings {
    if (!Settings.instance) {
      Settings.instance = new Settings();
    }
    return Settings.instance;
  }

  private loadConfig(): SpeedConfig {
    return {
      // Основные настройки
      rpcUrl: process.env.QUICKNODE_RPC_URL || process.env.PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',
      backupRpcUrl: process.env.PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',
      privateKey: process.env.PRIVATE_KEY || '',
      
      // Торговые настройки
      defaultSolAmount: parseFloat(process.env.DEFAULT_SOL_AMOUNT || '0.01'),
      maxSlippage: parseInt(process.env.MAX_SLIPPAGE || '1500'), // 🚀 15% по умолчанию
      minLiquidityUSD: parseFloat(process.env.MIN_LIQUIDITY_USD || '500'), // 🚀 Снижено
      
      // Анализ - ОТКЛЮЧЁН для скорости
      honeypotCheck: process.env.HONEYPOT_CHECK === 'true', // 🚀 false по умолчанию
      autoOpenCharts: process.env.AUTO_OPEN_CHARTS === 'true', // 🚀 false по умолчанию
      
      // Риск-менеджмент
      maxTradeSize: parseFloat(process.env.MAX_TRADE_SIZE || '1.0'),
      dailyLimit: parseFloat(process.env.DAILY_LIMIT || '10.0'),

      // 🚀 НОВЫЕ НАСТРОЙКИ СКОРОСТИ
      priorityFeeLamports: parseInt(process.env.PRIORITY_FEE_LAMPORTS || '50000'),
      skipPreflight: process.env.SKIP_PREFLIGHT !== 'false', // true по умолчанию
      aggressiveTimeouts: process.env.AGGRESSIVE_TIMEOUTS !== 'false', // true по умолчанию
      legacyOnly: process.env.LEGACY_ONLY !== 'false', // true по умолчанию
      ultraFastMode: process.env.ULTRA_FAST_MODE === 'true'
    };
  }

  private validateConfig(): void {
    const { config } = this;
    
    if (!config.privateKey || config.privateKey === 'YOUR_PRIVATE_KEY_HERE') {
      throw new SniperError(
        'Private key not configured. Please set PRIVATE_KEY in .env file',
        ErrorCodes.WALLET_ERROR
      );
    }

    if (!config.rpcUrl || config.rpcUrl.includes('YOUR_ENDPOINT')) {
      console.warn('⚠️  Using public RPC. Consider using QuickNode for better performance.');
    }

    if (config.defaultSolAmount <= 0 || config.defaultSolAmount > config.maxTradeSize) {
      throw new SniperError(
        'Invalid SOL amount configuration',
        ErrorCodes.INVALID_TOKEN
      );
    }

    if (config.maxSlippage < 100 || config.maxSlippage > 5000) {
      throw new SniperError(
        'Slippage must be between 1% (100) and 50% (5000) basis points',
        ErrorCodes.INVALID_TOKEN
      );
    }

    console.log('⚡ LIGHTNING configuration loaded');
    this.printConfig();
  }

  private printConfig(): void {
    const { config } = this;
    
    console.log('\n⚡ LIGHTNING Sniper Configuration:');
    console.log(`   RPC: ${config.rpcUrl.includes('quiknode') ? '🚀 QuickNode' : '🐌 Public RPC'}`);
    console.log(`   Default Trade: ${config.defaultSolAmount} SOL`);
    console.log(`   Max Slippage: ${config.maxSlippage / 100}% ${config.maxSlippage >= 1000 ? '⚡' : ''}`);
    console.log(`   Min Liquidity: $${config.minLiquidityUSD.toLocaleString()} ${config.minLiquidityUSD <= 1000 ? '⚡' : ''}`);
    console.log(`   Honeypot Check: ${config.honeypotCheck ? '🐌 ON' : '⚡ OFF'}`);
    console.log(`   Auto Charts: ${config.autoOpenCharts ? '🐌 ON' : '⚡ OFF'}`);
    console.log(`   Priority Fee: ${config.priorityFeeLamports} lamports ${config.priorityFeeLamports >= 10000 ? '⚡' : ''}`);
    console.log(`   Skip Preflight: ${config.skipPreflight ? '⚡ YES' : '🐌 NO'}`);
    console.log(`   Legacy Only: ${config.legacyOnly ? '⚡ YES' : '🐌 NO'}`);
    console.log(`   Ultra Fast Mode: ${config.ultraFastMode ? '🔥 ENABLED' : '⚡ DISABLED'}`);
    
    const speedLevel = this.getSpeedLevel();
    console.log(`   Speed Level: ${speedLevel}\n`);
  }

  private getSpeedLevel(): string {
    const { config } = this;
    let score = 0;
    
    if (!config.honeypotCheck) score += 2;
    if (!config.autoOpenCharts) score += 1;
    if (config.skipPreflight) score += 2;
    if (config.legacyOnly) score += 2;
    if (config.maxSlippage >= 1000) score += 1;
    if (config.priorityFeeLamports >= 10000) score += 1;
    if (config.ultraFastMode) score += 3;
    
    if (score >= 10) return '🔥 ULTRA FAST';
    if (score >= 7) return '⚡ LIGHTNING';
    if (score >= 4) return '🚀 FAST';
    return '🐌 NORMAL';
  }

  // Геттеры для основных настроек
  public getRpcUrl(): string {
    return this.config.rpcUrl;
  }

  public getBackupRpcUrl(): string {
    return this.config.backupRpcUrl || this.config.rpcUrl;
  }

  public getPrivateKey(): string {
    return this.config.privateKey;
  }

  public getDefaultTradeAmount(): number {
    return this.config.defaultSolAmount;
  }

  public getMaxSlippage(): number {
    return this.config.maxSlippage;
  }

  public shouldCheckHoneypot(): boolean {
    return this.config.honeypotCheck;
  }

  public shouldAutoOpenCharts(): boolean {
    return this.config.autoOpenCharts;
  }

  public getMinLiquidity(): number {
    return this.config.minLiquidityUSD;
  }

  // 🚀 НОВЫЕ ГЕТТЕРЫ ДЛЯ СКОРОСТИ
  public getPriorityFee(): number {
    return this.config.priorityFeeLamports;
  }

  public shouldSkipPreflight(): boolean {
    return this.config.skipPreflight;
  }

  public shouldUseAggressiveTimeouts(): boolean {
    return this.config.aggressiveTimeouts;
  }

  public shouldUseLegacyOnly(): boolean {
    return this.config.legacyOnly;
  }

  public isUltraFastMode(): boolean {
    return this.config.ultraFastMode;
  }

  // Быстрые переключатели для runtime
  public enableUltraFastMode(): void {
    this.config.ultraFastMode = true;
    this.config.honeypotCheck = false;
    this.config.autoOpenCharts = false;
    this.config.skipPreflight = true;
    this.config.legacyOnly = true;
    this.config.maxSlippage = Math.max(this.config.maxSlippage, 1500);
    console.log('🔥 ULTRA FAST MODE ACTIVATED');
  }

  public disableUltraFastMode(): void {
    this.config.ultraFastMode = false;
    console.log('⚡ Ultra fast mode disabled');
  }

  // Получение всех настроек скорости
  public getSpeedSettings(): {
    priorityFee: number;
    skipPreflight: boolean;
    aggressiveTimeouts: boolean;
    legacyOnly: boolean;
    ultraFastMode: boolean;
    speedLevel: string;
  } {
    return {
      priorityFee: this.config.priorityFeeLamports,
      skipPreflight: this.config.skipPreflight,
      aggressiveTimeouts: this.config.aggressiveTimeouts,
      legacyOnly: this.config.legacyOnly,
      ultraFastMode: this.config.ultraFastMode,
      speedLevel: this.getSpeedLevel()
    };
  }

  // Обновление слиппажа для экстремально быстрых операций
  public setAggressiveSlippage(): void {
    this.config.maxSlippage = 2000; // 20% для экстремальной скорости
    console.log('🔥 Aggressive slippage enabled: 20%');
  }

  public updateTradeAmount(amount: number): void {
    if (amount > 0 && amount <= this.config.maxTradeSize) {
      this.config.defaultSolAmount = amount;
      console.log(`💰 Trade amount updated to ${amount} SOL`);
    } else {
      throw new SniperError(
        `Trade amount must be between 0 and ${this.config.maxTradeSize} SOL`,
        ErrorCodes.INVALID_TOKEN
      );
    }
  }

  public updateSlippage(slippageBps: number): void {
    if (slippageBps >= 100 && slippageBps <= 5000) {
      this.config.maxSlippage = slippageBps;
      console.log(`📊 Slippage updated to ${slippageBps / 100}%`);
    } else {
      throw new SniperError(
        'Slippage must be between 1% and 50%',
        ErrorCodes.INVALID_TOKEN
      );
    }
  }
}

export const settings = Settings.getInstance();
export default settings;