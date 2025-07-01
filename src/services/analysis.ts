// src/services/analysis.ts
// СВЕРХБЫСТРЫЙ анализ токенов для снайпинга (1-3 секунды)

import axios from 'axios';
import { PublicKey } from '@solana/web3.js';
import { TokenAnalysis, HoneypotResult, TokenMetrics, SniperError, ErrorCodes } from '../interfaces/types';
import settings from '../config/settings';

export class AnalysisService {
  private readonly FAST_TIMEOUT = 2000; // 2 секунды максимум на запрос
  
  constructor() {
    console.log('🔍 Fast Analysis service initialized');
  }

  // 🚀 ГЛАВНЫЙ МЕТОД - МАКСИМАЛЬНО БЫСТРЫЙ АНАЛИЗ
  public async analyzeToken(tokenMint: string): Promise<TokenAnalysis> {
    const startTime = Date.now();
    console.log(`⚡ Fast analysis: ${tokenMint}...`);
    
    const analysis: TokenAnalysis = {
      mint: tokenMint,
      isValid: false,
      isHoneypot: false,
      liquidityUSD: 0,
      holdersCount: 0,
      age: 0,
      warnings: [],
      score: 0
    };

    try {
      // Валидация адреса (мгновенно)
      if (!this.isValidAddress(tokenMint)) {
        analysis.warnings.push('Invalid token address');
        return analysis;
      }

      // ТОЛЬКО 2 БЫСТРЫЕ ПРОВЕРКИ ПАРАЛЛЕЛЬНО
      const [liquidityResult, honeypotResult] = await Promise.allSettled([
        this.getLiquidity(tokenMint),
        this.checkHoneypot(tokenMint)
      ]);

      // Обработка ликвидности
      if (liquidityResult.status === 'fulfilled' && liquidityResult.value) {
        analysis.liquidityUSD = liquidityResult.value.liquidityUSD;
        analysis.marketCap = liquidityResult.value.marketCap;
      }

      // Обработка honeypot
      if (honeypotResult.status === 'fulfilled') {
        analysis.isHoneypot = honeypotResult.value.isHoneypot;
        if (honeypotResult.value.warnings.length > 0) {
          analysis.warnings.push(...honeypotResult.value.warnings);
        }
      }

      // Быстрые проверки
      this.fastSecurityChecks(analysis);

      // Финальный рейтинг
      analysis.score = this.calculateScore(analysis);
      analysis.isValid = analysis.score > 30 && !analysis.isHoneypot;

      const elapsed = Date.now() - startTime;
      console.log(`✅ Analysis done in ${elapsed}ms. Score: ${analysis.score}/100`);
      
      return analysis;

    } catch (error: unknown) {
      const elapsed = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Analysis failed in ${elapsed}ms:`, errorMessage);
      analysis.warnings.push('Analysis error');
      return analysis;
    }
  }

  // 💧 ПОЛУЧЕНИЕ ЛИКВИДНОСТИ - ТОЛЬКО DEXSCREENER
  private async getLiquidity(tokenMint: string): Promise<TokenMetrics | null> {
    try {
      const response = await axios.get(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`,
        { 
          timeout: this.FAST_TIMEOUT,
          headers: { 'User-Agent': 'Sniper/1.0' }
        }
      );

      const pairs = response.data?.pairs;
      if (!pairs || pairs.length === 0) return null;

      // Лучшая пара по ликвидности
      const bestPair = pairs.reduce((best: any, current: any) => 
        (current.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? current : best
      );

      return {
        price: parseFloat(bestPair.priceUsd || '0'),
        priceChange24h: parseFloat(bestPair.priceChange?.h24 || '0'),
        volume24h: parseFloat(bestPair.volume?.h24 || '0'),
        liquidityUSD: parseFloat(bestPair.liquidity?.usd || '0'),
        marketCap: parseFloat(bestPair.marketCap || '0'),
        fdv: parseFloat(bestPair.fdv || '0')
      };
    } catch (error: unknown) {
      console.warn('⚠️  DexScreener timeout/error');
      return null;
    }
  }

  // 🍯 ПРОВЕРКА HONEYPOT - СВЕРХБЫСТРАЯ
  private async checkHoneypot(tokenMint: string): Promise<HoneypotResult> {
    if (!settings.shouldCheckHoneypot()) {
      return {
        isHoneypot: false,
        canSell: true,
        warnings: []
      };
    }

    try {
      const response = await axios.get(
        `https://api.honeypot.is/v2/IsHoneypot`,
        {
          params: { address: tokenMint, chainID: 'solana' },
          timeout: this.FAST_TIMEOUT,
          headers: { 'User-Agent': 'Sniper/1.0' }
        }
      );

      const data = response.data;
      
      return {
        isHoneypot: Boolean(data.IsHoneypot),
        buyTax: data.BuyTax || 0,
        sellTax: data.SellTax || 0,
        transferTax: data.TransferTax || 0,
        canSell: !data.IsHoneypot,
        warnings: data.IsHoneypot ? ['🍯 Honeypot detected'] : []
      };
    } catch (error: unknown) {
      // Если API медленный - пропускаем проверку
      return {
        isHoneypot: false,
        canSell: true,
        warnings: ['Honeypot check skipped (timeout)']
      };
    }
  }

  // ⚡ БЫСТРЫЕ ПРОВЕРКИ БЕЗОПАСНОСТИ
  private fastSecurityChecks(analysis: TokenAnalysis): void {
    const minLiquidity = settings.getMinLiquidity();
    
    // Критическая проверка ликвидности
    if (analysis.liquidityUSD < minLiquidity) {
      analysis.warnings.push(`Low liquidity: ${this.formatNumber(analysis.liquidityUSD)}`);
    }

    // Проверка микрокапитализации
    if (analysis.marketCap && analysis.marketCap < 5000) {
      analysis.warnings.push(`Micro cap: ${this.formatNumber(analysis.marketCap)}`);
    }

    // Проверка нулевой ликвидности
    if (analysis.liquidityUSD === 0) {
      analysis.warnings.push('No liquidity found');
    }
  }

  // 📊 РАСЧЕТ РЕЙТИНГА БЕЗОПАСНОСТИ
  private calculateScore(analysis: TokenAnalysis): number {
    let score = 50; // Базовый рейтинг

    // Honeypot - критично
    if (analysis.isHoneypot) {
      score -= 80;
    }

    // Ликвидность (главный фактор)
    const liquidity = analysis.liquidityUSD;
    if (liquidity >= 500000) {
      score += 30; // Отличная ликвидность
    } else if (liquidity >= 100000) {
      score += 20; // Хорошая ликвидность
    } else if (liquidity >= 50000) {
      score += 15; // Нормальная ликвидность
    } else if (liquidity >= 10000) {
      score += 10; // Низкая ликвидность
    } else if (liquidity >= 1000) {
      score += 5; // Очень низкая ликвидность
    } else {
      score -= 20; // Критически низкая
    }

    // Рыночная капитализация
    if (analysis.marketCap) {
      if (analysis.marketCap >= 10000000) {
        score += 15; // Большая капитализация
      } else if (analysis.marketCap >= 1000000) {
        score += 10; // Средняя капитализация
      } else if (analysis.marketCap >= 100000) {
        score += 5; // Малая капитализация
      }
    }

    // Штрафы за предупреждения
    score -= analysis.warnings.length * 8;

    // Ограничиваем рейтинг от 0 до 100
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // 🔧 БЫСТРАЯ ПРОВЕРКА ТОКЕНА (для предварительного фильтра)
  public async quickCheck(tokenMint: string): Promise<{
    isValid: boolean;
    hasLiquidity: boolean;
    warnings: string[];
  }> {
    const warnings: string[] = [];
    
    if (!this.isValidAddress(tokenMint)) {
      return { isValid: false, hasLiquidity: false, warnings: ['Invalid address'] };
    }

    try {
      const metrics = await this.getLiquidity(tokenMint);
      const hasLiquidity = (metrics?.liquidityUSD || 0) >= settings.getMinLiquidity();
      
      if (!hasLiquidity) {
        warnings.push('Insufficient liquidity');
      }

      return {
        isValid: true,
        hasLiquidity,
        warnings
      };
    } catch (error: unknown) {
      return {
        isValid: false,
        hasLiquidity: false,
        warnings: ['Check failed']
      };
    }
  }

  // 📈 ПОЛУЧЕНИЕ ТЕКУЩЕЙ ЦЕНЫ (мгновенно)
  public async getCurrentPrice(tokenMint: string): Promise<number | null> {
    try {
      const metrics = await this.getLiquidity(tokenMint);
      return metrics?.price || null;
    } catch (error: unknown) {
      return null;
    }
  }

  // 🛠️ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  private isValidAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return address.length >= 32 && address.length <= 44;
    } catch {
      return false;
    }
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    } else {
      return num.toFixed(0);
    }
  }

  // 📊 СТАТИСТИКА СЕРВИСА
  public getStats(): {
    service: string;
    timeout: number;
    features: string[];
  } {
    return {
      service: 'Fast Analysis v2.0',
      timeout: this.FAST_TIMEOUT,
      features: [
        'DexScreener integration',
        'Fast honeypot detection',
        'Liquidity analysis',
        'Risk scoring'
      ]
    };
  }
}