#!/usr/bin/env node
// src/snipeService.ts
// 🚀 ИНТЕРАКТИВНЫЙ СНАЙПЕР СЕРВИС - загружается один раз, работает мгновенно

import chalk from 'chalk';
import readlineSync from 'readline-sync';
import { PublicKey } from '@solana/web3.js';

// Импортируем ВСЕ сразу при старте
import settings from './config/settings';
import { AnalysisService } from './services/analysis';
import { BrowserService } from './services/browser';
import { JupiterService } from './services/jupiter';
import { WalletService } from './utils/wallet';
import { TokenAnalysis, UserChoice, SniperError, ErrorCodes } from './interfaces/types';

class SniperService {
  private analysisService!: AnalysisService;  // ! говорит TypeScript что мы инициализируем позже
  private browserService!: BrowserService;
  private jupiterService!: JupiterService;
  private walletService!: WalletService;
  private isReady: boolean = false;

  constructor() {
    console.log(chalk.cyan('🎯 Solana Manual Sniper Service v1.0'));
    console.log(chalk.gray('Loading all modules...'));
  }

  // 🚀 ИНИЦИАЛИЗАЦИЯ ОДИН РАЗ ПРИ СТАРТЕ
  public async initialize(): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(chalk.yellow('🔄 Initializing services...'));
      
      // Инициализируем все сервисы параллельно
      const [analysis, browser, jupiter, wallet] = await Promise.all([
        Promise.resolve(new AnalysisService()),
        Promise.resolve(new BrowserService()),
        Promise.resolve(new JupiterService()),
        Promise.resolve(new WalletService())
      ]);

      this.analysisService = analysis;
      this.browserService = browser;
      this.jupiterService = jupiter;
      this.walletService = wallet;

      // Проверяем кошелек
      const balance = await this.walletService.getSolBalance();
      console.log(chalk.blue(`💰 Wallet Balance: ${balance.toFixed(4)} SOL`));

      this.isReady = true;
      const initTime = Date.now() - startTime;
      
      console.log(chalk.green(`✅ Service ready in ${initTime}ms`));
      console.log(chalk.gray('Type token address to snipe, or "help" for commands\n'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize service:'), error);
      process.exit(1);
    }
  }

  // 🚀 ГЛАВНЫЙ ИНТЕРАКТИВНЫЙ ЦИКЛ
  public async run(): Promise<void> {
    if (!this.isReady) {
      await this.initialize();
    }

    while (true) {
      try {
        const input = readlineSync.question(chalk.cyan('sniper> ')).trim();
        
        if (!input) continue;

        const command = input.toLowerCase();
        
        // Обработка команд
        if (command === 'exit' || command === 'quit' || command === 'q') {
          console.log(chalk.gray('👋 Goodbye!'));
          process.exit(0);
        } else if (command === 'help' || command === 'h') {
          this.showHelp();
        } else if (command === 'balance' || command === 'bal') {
          await this.showBalance();
        } else if (command === 'settings' || command === 'config') {
          this.showSettings();
        } else if (command === 'clear' || command === 'cls') {
          console.clear();
        } else if (this.isValidSolanaAddress(input)) {
          // ⚡ МГНОВЕННЫЙ СНАЙП - все уже загружено!
          await this.quickSnipe(input);
        } else {
          console.log(chalk.red('❌ Invalid command or token address'));
          console.log(chalk.gray('Type "help" for available commands'));
        }
        
      } catch (error) {
        console.error(chalk.red('❌ Error:'), error);
      }
    }
  }

  // ⚡ МГНОВЕННЫЙ СНАЙП (0.1-0.3 секунды до начала анализа)
  private async quickSnipe(tokenMint: string): Promise<void> {
    const startTime = Date.now();
    console.log(chalk.yellow(`\n🎯 Sniping: ${tokenMint}`));
    
    try {
      // Быстрая проверка баланса
      const balance = await this.walletService.getSolBalance();
      const requiredAmount = settings.getDefaultTradeAmount();
      
      if (balance < requiredAmount) {
        console.log(chalk.red(`❌ Insufficient balance: ${balance.toFixed(4)} SOL < ${requiredAmount} SOL\n`));
        return;
      }

      // Анализ токена
      console.log(chalk.gray('⚡ Starting analysis...'));
      const analysis = await this.analysisService.analyzeToken(tokenMint);
      
      const analysisTime = Date.now() - startTime;
      console.log(chalk.gray(`📊 Analysis completed in ${analysisTime}ms`));
      
      // Показываем результаты
      this.displayQuickAnalysis(analysis);

      // Автооткрытие графиков если включено
      if (settings.shouldAutoOpenCharts()) {
        this.browserService.openTokenCharts(tokenMint).catch(() => {
          console.log(chalk.yellow('⚠️  Charts failed to open'));
        });
      }

      // Быстрый выбор действия
      const action = this.promptQuickAction(analysis);
      
      if (action === 'buy') {
        await this.executeQuickBuy(tokenMint, analysis);
      } else if (action === 'charts') {
        await this.browserService.openTokenCharts(tokenMint);
      } else if (action === 'analyze') {
        await this.browserService.openDetailedAnalysis(tokenMint);
      }
      
      console.log(''); // пустая строка для разделения

    } catch (error) {
      console.error(chalk.red('❌ Snipe failed:'), error);
    }
  }

  private displayQuickAnalysis(analysis: TokenAnalysis): void {
    console.log('\n📊 Quick Analysis:');
    console.log(`   ${analysis.isHoneypot ? chalk.red('🍯 HONEYPOT') : chalk.green('✅ Clean')}`);
    console.log(`   💧 Liquidity: ${chalk.yellow('$' + this.formatNumber(analysis.liquidityUSD))}`);
    console.log(`   🏆 Score: ${this.getScoreColor(analysis.score)}${analysis.score}/100`);
    
    if (analysis.warnings.length > 0) {
      console.log(`   ⚠️  ${chalk.red(analysis.warnings.length + ' warnings')}`);
    }
  }

  private promptQuickAction(analysis: TokenAnalysis): 'buy' | 'skip' | 'charts' | 'analyze' {
    // Быстрые рекомендации
    let rec = '';
    if (analysis.isHoneypot) {
      rec = chalk.red('🚨 AVOID');
    } else if (analysis.score >= 80) {
      rec = chalk.green('🚀 BUY');
    } else if (analysis.score >= 60) {
      rec = chalk.yellow('⚠️  CAUTION');
    } else {
      rec = chalk.red('❌ RISKY');
    }

    console.log(`   ${rec}\n`);

    // Очень быстрый выбор (одна клавиша)
    const choice = readlineSync.keyIn(
      chalk.cyan('Action: [B]uy, [S]kip, [C]harts, [A]nalyze: '),
      { limit: 'bsca', caseSensitive: false }
    );

    switch (choice.toLowerCase()) {
      case 'b': return 'buy';
      case 'c': return 'charts';
      case 'a': return 'analyze';
      default: return 'skip';
    }
  }

  private async executeQuickBuy(tokenMint: string, analysis: TokenAnalysis): Promise<void> {
    if (analysis.isHoneypot) {
      console.log(chalk.red('🚨 Cannot buy honeypot token!'));
      return;
    }

    const amount = settings.getDefaultTradeAmount();
    const slippage = settings.getMaxSlippage();

    console.log(chalk.yellow(`\n🔄 Buying ${amount} SOL worth...`));
    
    try {
      const result = await this.jupiterService.executeSwap(
        'So11111111111111111111111111111111111111112', // SOL
        tokenMint,
        amount,
        slippage
      );

      if (result.success) {
        console.log(chalk.green('🎉 Purchase successful!'));
        console.log(`   💳 TX: ${chalk.cyan(result.signature)}`);
        console.log(`   ⏱️  Time: ${result.executionTime}ms`);
        console.log(`   💥 Impact: ${result.priceImpact?.toFixed(2)}%`);
        
        // Открываем транзакцию
        this.browserService.openTransaction(result.signature!);
      } else {
        console.log(chalk.red('❌ Purchase failed:'));
        console.log(chalk.red(`   ${result.error}`));
      }
    } catch (error) {
      console.log(chalk.red('💥 Buy error:'), error);
    }
  }

  // Вспомогательные команды
  private async showBalance(): Promise<void> {
    try {
      const balance = await this.walletService.getSolBalance();
      console.log(chalk.blue(`💰 Current balance: ${balance.toFixed(4)} SOL`));
    } catch (error) {
      console.log(chalk.red('❌ Failed to get balance'));
    }
  }

  private showSettings(): void {
    console.log('\n🔧 Current Settings:');
    console.log(`   Default amount: ${settings.getDefaultTradeAmount()} SOL`);
    console.log(`   Max slippage: ${settings.getMaxSlippage() / 100}%`);
    console.log(`   Min liquidity: $${settings.getMinLiquidity().toLocaleString()}`);
    console.log(`   Auto charts: ${settings.shouldAutoOpenCharts() ? '✅' : '❌'}`);
    console.log(`   Honeypot check: ${settings.shouldCheckHoneypot() ? '✅' : '❌'}`);
  }

  private showHelp(): void {
    console.log('\n📖 Available Commands:');
    console.log('   <token_address>  - Snipe token');
    console.log('   balance, bal     - Show SOL balance');
    console.log('   settings, config - Show current settings');
    console.log('   clear, cls       - Clear screen');
    console.log('   help, h          - Show this help');
    console.log('   exit, quit, q    - Exit service');
    console.log('\n💡 Pro tip: Just paste token address and hit Enter!');
  }

  private isValidSolanaAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return address.length >= 32 && address.length <= 44;
    } catch {
      return false;
    }
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toFixed(0);
  }

  private getScoreColor(score: number): string {
    if (score >= 80) return chalk.green('');
    if (score >= 60) return chalk.yellow('');
    return chalk.red('');
  }
}

// 🚀 ЗАПУСК СЕРВИСА
async function main() {
  const service = new SniperService();
  await service.run();
}

if (require.main === module) {
  main().catch(console.error);
}

export default SniperService;