// src/services/browser.ts
// Автоматическое открытие графиков и анализа в браузере

import open from 'open';
import settings from '../config/settings';

export class BrowserService {
  private readonly delay = 300; // задержка между открытием вкладок (мс)

  constructor() {
    console.log('🌐 Browser service initialized');
  }

  // Открыть основные графики токена
  public async openTokenCharts(tokenMint: string): Promise<void> {
    if (!settings.shouldAutoOpenCharts()) {
      console.log('📊 Auto-charts disabled in settings');
      return;
    }

    console.log('🌐 Opening token charts...');
    
    try {
      // DexScreener - главный график
      await this.openWithDelay(`https://dexscreener.com/solana/${tokenMint}`, 'DexScreener');
      
      // BirdEye - дополнительная аналитика  
      await this.openWithDelay(`https://birdeye.so/token/${tokenMint}`, 'BirdEye');
      
      // Solscan - информация о токене
      await this.openWithDelay(`https://solscan.io/token/${tokenMint}`, 'Solscan');

      console.log('✅ Charts opened successfully\n');
    } catch (error) {
      console.warn('⚠️  Failed to open some charts:', error);
    }
  }

  // Подробный анализ токена
  public async openDetailedAnalysis(tokenMint: string): Promise<void> {
    console.log('🔍 Opening detailed analysis...');
    
    try {
      // Honeypot checker
      await this.openWithDelay(
        `https://honeypot.is/solana?address=${tokenMint}`, 
        'Honeypot Checker'
      );
      
      // RugCheck
      await this.openWithDelay(
        `https://rugcheck.xyz/tokens/${tokenMint}`, 
        'RugCheck'
      );
      
      // DexTools (если есть поддержка Solana)
      await this.openWithDelay(
        `https://www.dextools.io/app/en/solana/pair-explorer/${tokenMint}`, 
        'DexTools'
      );

      // Jupiter swap interface для тестирования
      await this.openWithDelay(
        `https://jup.ag/swap/SOL-${tokenMint}`, 
        'Jupiter Swap'
      );

      console.log('✅ Detailed analysis opened\n');
    } catch (error) {
      console.warn('⚠️  Failed to open detailed analysis:', error);
    }
  }

  // Открыть транзакцию после выполнения
  public async openTransaction(signature: string): Promise<void> {
    console.log('🔗 Opening transaction...');
    
    try {
      // Solscan transaction viewer
      await this.openWithDelay(
        `https://solscan.io/tx/${signature}`, 
        'Transaction'
      );
      
      // Solana Explorer как backup
      await this.openWithDelay(
        `https://explorer.solana.com/tx/${signature}`, 
        'Solana Explorer'
      );

      console.log('✅ Transaction opened in browser\n');
    } catch (error) {
      console.warn('⚠️  Failed to open transaction:', error);
    }
  }

  // Открыть кошелек в explorer
  public async openWallet(walletAddress: string): Promise<void> {
    console.log('👛 Opening wallet...');
    
    try {
      await this.openWithDelay(
        `https://solscan.io/account/${walletAddress}`, 
        'Wallet'
      );
      
      console.log('✅ Wallet opened in browser\n');
    } catch (error) {
      console.warn('⚠️  Failed to open wallet:', error);
    }
  }

  // Открыть пул ликвидности
  public async openLiquidityPool(poolAddress: string): Promise<void> {
    console.log('🏊 Opening liquidity pool...');
    
    try {
      await this.openWithDelay(
        `https://solscan.io/account/${poolAddress}`, 
        'Liquidity Pool'
      );
      
      console.log('✅ Pool opened in browser\n');
    } catch (error) {
      console.warn('⚠️  Failed to open pool:', error);
    }
  }

  // Открыть Jupiter с предзаполненной парой
  public async openJupiterSwap(inputMint: string, outputMint: string): Promise<void> {
    console.log('🪐 Opening Jupiter swap...');
    
    try {
      await this.openWithDelay(
        `https://jup.ag/swap/${inputMint}-${outputMint}`, 
        'Jupiter Swap'
      );
      
      console.log('✅ Jupiter opened\n');
    } catch (error) {
      console.warn('⚠️  Failed to open Jupiter:', error);
    }
  }

  // Открыть multiple URLs с информацией о рынке
  public async openMarketOverview(): Promise<void> {
    console.log('📈 Opening market overview...');
    
    try {
      // CoinGecko Solana tokens
      await this.openWithDelay(
        'https://www.coingecko.com/en/categories/solana-ecosystem', 
        'Market Overview'
      );
      
      // DEX volume stats
      await this.openWithDelay(
        'https://dexscreener.com/solana', 
        'DEX Volume'
      );
      
      console.log('✅ Market overview opened\n');
    } catch (error) {
      console.warn('⚠️  Failed to open market overview:', error);
    }
  }

  // Служебный метод для открытия с задержкой
  private async openWithDelay(url: string, name: string): Promise<void> {
    try {
      await open(url);
      console.log(`   📱 ${name}: ${url}`);
      
      // Небольшая задержка чтобы не спамить браузер
      if (this.delay > 0) {
        await this.sleep(this.delay);
      }
    } catch (error) {
      console.warn(`   ❌ Failed to open ${name}: ${error}`);
    }
  }

  // Открыть URL без задержки
  public async openUrl(url: string, description?: string): Promise<void> {
    try {
      await open(url);
      console.log(`🌐 Opened: ${description || url}`);
    } catch (error) {
      console.warn(`❌ Failed to open URL: ${error}`);
    }
  }

  // Копировать URL в буфер обмена (для случаев когда браузер не открывается)
  public getTokenUrls(tokenMint: string): {
    dexscreener: string;
    birdeye: string;
    solscan: string;
    jupiter: string;
    honeypot: string;
    rugcheck: string;
  } {
    return {
      dexscreener: `https://dexscreener.com/solana/${tokenMint}`,
      birdeye: `https://birdeye.so/token/${tokenMint}`,
      solscan: `https://solscan.io/token/${tokenMint}`,
      jupiter: `https://jup.ag/swap/SOL-${tokenMint}`,
      honeypot: `https://honeypot.is/solana?address=${tokenMint}`,
      rugcheck: `https://rugcheck.xyz/tokens/${tokenMint}`
    };
  }

  // Показать все URL в консоли (если автооткрытие отключено)
  public printTokenUrls(tokenMint: string): void {
    const urls = this.getTokenUrls(tokenMint);
    
    console.log('🔗 Token Analysis URLs:');
    console.log(`   DexScreener: ${urls.dexscreener}`);
    console.log(`   BirdEye: ${urls.birdeye}`);
    console.log(`   Solscan: ${urls.solscan}`);
    console.log(`   Jupiter: ${urls.jupiter}`);
    console.log(`   Honeypot: ${urls.honeypot}`);
    console.log(`   RugCheck: ${urls.rugcheck}\n`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}