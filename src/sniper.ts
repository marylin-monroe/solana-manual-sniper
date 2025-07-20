#!/usr/bin/env node
// src/sniper.ts bb44BASE58
// Главный файл Solana Manual Sniper

import chalk from 'chalk';
import readlineSync from 'readline-sync';
import { PublicKey } from '@solana/web3.js';
import settings from './config/settings';
import { TokenAnalysis, QuickBuyOptions, UserChoice, SniperError, ErrorCodes } from './interfaces/types';
import { AnalysisService } from './services/analysis';
import { BrowserService } from './services/browser';
import { JupiterService } from './services/jupiter';
import { WalletService } from './utils/wallet';

class SolanaSniper {
  private analysisService: AnalysisService;
  private browserService: BrowserService;
  private jupiterService: JupiterService;
  private walletService: WalletService;

  constructor() {
    this.analysisService = new AnalysisService();
    this.browserService = new BrowserService();
    this.jupiterService = new JupiterService();
    this.walletService = new WalletService();
  }

  public async run(tokenMint: string): Promise<void> {
    try {
      console.log(chalk.cyan('🎯 Solana Manual Sniper v1.0\n'));
      
      // Валидируем токен mint
      if (!this.isValidSolanaAddress(tokenMint)) {
        throw new SniperError(
          'Invalid Solana token address',
          ErrorCodes.INVALID_TOKEN
        );
      }

      console.log(chalk.yellow(`🔍 Analyzing token: ${tokenMint}\n`));

      // Проверяем баланс кошелька
      await this.checkWalletBalance();

      // Анализируем токен
      const analysis = await this.analysisService.analyzeToken(tokenMint);
      
      // Показываем результаты анализа
      this.displayAnalysis(analysis);

      // Открываем графики в браузере (если включено)
      if (settings.shouldAutoOpenCharts()) {
        await this.browserService.openTokenCharts(tokenMint);
      }

      // Спрашиваем пользователя что делать
      const userChoice = this.promptUserAction(analysis);

      // Выполняем действие
      await this.executeAction(userChoice, tokenMint, analysis);

    } catch (error) {
      this.handleError(error);
    }
  }

  private async checkWalletBalance(): Promise<void> {
    try {
      const balance = await this.walletService.getSolBalance();
      const requiredAmount = settings.getDefaultTradeAmount();

      console.log(chalk.blue(`💰 Wallet Balance: ${balance.toFixed(4)} SOL`));

      if (balance < requiredAmount) {
        throw new SniperError(
          `Insufficient SOL balance. Required: ${requiredAmount}, Available: ${balance.toFixed(4)}`,
          ErrorCodes.INSUFFICIENT_FUNDS
        );
      }

      if (balance < requiredAmount * 2) {
        console.log(chalk.yellow(`⚠️  Low balance warning. Consider adding more SOL for multiple trades.\n`));
      }
    } catch (error) {
      throw new SniperError(
        'Failed to check wallet balance',
        ErrorCodes.WALLET_ERROR,
        error
      );
    }
  }

  private displayAnalysis(analysis: TokenAnalysis): void {
    console.log(chalk.white('📊 Token Analysis Results:\n'));

    // Основная информация
    console.log(`   Token: ${chalk.cyan(analysis.mint)}`);
    console.log(`   Valid: ${analysis.isValid ? chalk.green('✅ Yes') : chalk.red('❌ No')}`);
    console.log(`   Honeypot: ${analysis.isHoneypot ? chalk.red('🍯 DETECTED') : chalk.green('✅ Clean')}`);
    console.log(`   Liquidity: ${chalk.yellow('$' + analysis.liquidityUSD.toLocaleString())}`);
    console.log(`   Holders: ${chalk.blue(analysis.holdersCount.toLocaleString())}`);
    console.log(`   Age: ${chalk.gray(this.formatAge(analysis.age))}`);
    console.log(`   Safety Score: ${this.getScoreColor(analysis.score)}${analysis.score}/100`);

    // Предупреждения
    if (analysis.warnings.length > 0) {
      console.log(chalk.red('\n⚠️  Warnings:'));
      analysis.warnings.forEach(warning => {
        console.log(chalk.red(`   • ${warning}`));
      });
    }

    console.log(''); // пустая строка
  }

  private promptUserAction(analysis: TokenAnalysis): UserChoice {
    // Рекомендация на основе анализа
    let recommendation = '';
    if (analysis.isHoneypot) {
      recommendation = chalk.red('🚨 AVOID - Honeypot detected');
    } else if (analysis.score >= 80) {
      recommendation = chalk.green('🚀 RECOMMENDED - High score');
    } else if (analysis.score >= 60) {
      recommendation = chalk.yellow('⚠️  CAUTION - Medium risk');
    } else {
      recommendation = chalk.red('❌ RISKY - Low score');
    }

    console.log(`Recommendation: ${recommendation}\n`);

    // Варианты действий
    const choices = ['Buy', 'Skip', 'Open Charts', 'Analyze more', 'Quit'];
    const choice = readlineSync.keyInSelect(
      choices,
      chalk.cyan('What would you like to do?'),
      { cancel: 'Quit' }
    );

    switch (choice) {
      case 0: return 'buy';
      case 1: return 'skip';
      case 2: return 'charts' as UserChoice;
      case 3: return 'analyze';
      default: return 'quit';
    }
  }

  private async executeAction(action: UserChoice, tokenMint: string, analysis: TokenAnalysis): Promise<void> {
    switch (action) {
      case 'buy':
        await this.executeBuy(tokenMint, analysis);
        break;
      
      case 'skip':
        console.log(chalk.yellow('⏭️  Skipped. Token not purchased.'));
        break;
      
      case 'charts':
        console.log(chalk.blue('📊 Opening charts...'));
        await this.browserService.openTokenCharts(tokenMint);
        // Recursive call for new decision
        const newChoice = this.promptUserAction(analysis);
        await this.executeAction(newChoice, tokenMint, analysis);
        break;
      
      case 'analyze':
        console.log(chalk.blue('📊 Opening detailed analysis...'));
        await this.browserService.openDetailedAnalysis(tokenMint);
        // Recursive call for new decision
        const newChoice2 = this.promptUserAction(analysis);
        await this.executeAction(newChoice2, tokenMint, analysis);
        break;
      
      case 'quit':
        console.log(chalk.gray('👋 Goodbye!'));
        process.exit(0);
    }
  }

  private async executeBuy(tokenMint: string, analysis: TokenAnalysis): Promise<void> {
    try {
      // Последняя проверка безопасности
      if (analysis.isHoneypot) {
        console.log(chalk.red('🚨 Cannot buy honeypot token!'));
        return;
      }

      // Запрашиваем параметры покупки
      const buyOptions = this.getBuyOptions(tokenMint);

      console.log(chalk.yellow(`\n🔄 Executing buy order...`));
      console.log(`   Amount: ${buyOptions.solAmount} SOL`);
      console.log(`   Slippage: ${(buyOptions.slippage || settings.getMaxSlippage()) / 100}%`);

      // Выполняем покупку через Jupiter
      const result = await this.jupiterService.executeSwap(
        'So11111111111111111111111111111111111111112', // SOL
        tokenMint,
        buyOptions.solAmount || settings.getDefaultTradeAmount(),
        buyOptions.slippage || settings.getMaxSlippage()
      );

      if (result.success) {
        console.log(chalk.green('\n🎉 Purchase successful!'));
        console.log(`   Transaction: ${chalk.cyan(result.signature)}`);
        console.log(`   Tokens received: ${result.tokenAmount?.toFixed(2)}`);
        console.log(`   SOL spent: ${result.solSpent?.toFixed(4)}`);
        console.log(`   Price impact: ${result.priceImpact?.toFixed(2)}%`);
        console.log(`   Execution time: ${result.executionTime}ms`);
        
        // Открываем транзакцию в браузере
        await this.browserService.openTransaction(result.signature!);
      } else {
        console.log(chalk.red('\n❌ Purchase failed:'));
        console.log(chalk.red(`   Error: ${result.error}`));
      }

    } catch (error) {
      console.log(chalk.red('\n💥 Transaction error:'));
      console.log(chalk.red(`   ${error}`));
    }
  }

  private getBuyOptions(tokenMint: string): QuickBuyOptions {
    const defaultAmount = settings.getDefaultTradeAmount();
    
    // Спрашиваем параметры покупки
    console.log(chalk.cyan('\n💰 Purchase Configuration:'));
    
    const customAmount = readlineSync.questionFloat(
      `SOL amount (default ${defaultAmount}): `,
      { defaultInput: defaultAmount.toString() }
    );

    const customSlippage = readlineSync.questionInt(
      `Slippage % (default ${settings.getMaxSlippage() / 100}): `,
      { defaultInput: (settings.getMaxSlippage() / 100).toString() }
    ) * 100;

    return {
      tokenMint,
      solAmount: customAmount,
      slippage: customSlippage,
      skipAnalysis: false,
      autoConfirm: false
    };
  }

  // Вспомогательные методы
  private isValidSolanaAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  private formatAge(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  }

  private getScoreColor(score: number): string {
    if (score >= 80) return chalk.green('');
    if (score >= 60) return chalk.yellow('');
    return chalk.red('');
  }

  private handleError(error: any): void {
    console.log(chalk.red('\n💥 Sniper Error:'));
    
    if (error instanceof SniperError) {
      console.log(chalk.red(`   ${error.message}`));
      console.log(chalk.gray(`   Code: ${error.code}`));
    } else {
      console.log(chalk.red(`   ${error.message || error}`));
    }
    
    process.exit(1);
  }
}

// Главная функция - точка входа
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(chalk.red('❌ Usage: npm run snipe <TOKEN_MINT>'));
    console.log(chalk.gray('   Example: npm run snipe 7bLFu6VVmAetD6kS59YtSmDvjMKAjVm2CKJkKPQe7rGo'));
    process.exit(1);
  }

  const tokenMint = args[0];
  const sniper = new SolanaSniper();
  
  await sniper.run(tokenMint);
}

// Запуск только если файл выполняется напрямую
if (require.main === module) {
  main().catch(console.error);
}

export default SolanaSniper;
