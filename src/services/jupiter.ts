// src/services/jupiter.ts
// ПОЛНАЯ ВЕРСИЯ с исправлением всех TypeScript ошибок

import axios from 'axios';
import { 
  Connection, 
  Transaction, 
  VersionedTransaction, 
  LAMPORTS_PER_SOL,
  AddressLookupTableAccount,
  PublicKey
} from '@solana/web3.js';
import { WalletService } from '../utils/wallet';
import { 
  JupiterQuote, 
  SwapTransaction, 
  SnipeResult, 
  SniperError, 
  ErrorCodes 
} from '../interfaces/types';
import settings from '../config/settings';

export class JupiterService {
  private walletService: WalletService;
  private connection: Connection;
  private readonly BASE_URL_V6 = 'https://quote-api.jup.ag/v6';

  constructor() {
    this.walletService = new WalletService();
    this.connection = this.walletService.getConnection();
    console.log('🪐 Jupiter service initialized');
  }

  // Главный метод для выполнения свапа
  public async executeSwap(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 500
  ): Promise<SnipeResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Starting swap: ${amount} → ${outputMint.slice(0, 8)}...`);

      // 1. Получаем quote
      const quote = await this.getQuoteV6(inputMint, outputMint, amount, slippageBps);
      
      // 2. Проверяем quote на разумность
      this.validateQuote(quote, amount, slippageBps);

      // 3. Получаем swap transaction с улучшенным fallback
      const swapTransaction = await this.getSwapTransactionWithImprovedFallback(quote);

      // 4. Подписываем и отправляем с полной поддержкой всех типов транзакций
      const signature = await this.signAndSendTransactionImproved(swapTransaction);

      // 5. Ждём подтверждения
      await this.waitForConfirmation(signature);

      const executionTime = Date.now() - startTime;
      
      console.log(`✅ Swap completed in ${executionTime}ms`);

      return {
        success: true,
        signature,
        tokenAmount: parseFloat(quote.outAmount),
        solSpent: amount,
        priceImpact: parseFloat(quote.priceImpactPct),
        executionTime
      };

    } catch (error: unknown) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Swap failed after ${executionTime}ms:`, errorMessage);

      return {
        success: false,
        error: errorMessage,
        executionTime
      };
    }
  }

  // Получение котировки от Jupiter v6
  private async getQuoteV6(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number
  ): Promise<JupiterQuote> {
    try {
      // Конвертируем amount в lamports для SOL или базовые единицы для токенов
      const inputAmount = inputMint === 'So11111111111111111111111111111111111111112' 
        ? Math.floor(amount * LAMPORTS_PER_SOL)
        : Math.floor(amount);

      const params = {
        inputMint,
        outputMint,
        amount: inputAmount.toString(),
        slippageBps: slippageBps.toString(),
        swapMode: 'ExactIn'
      };

      console.log(`📊 Getting quote from Jupiter v6...`);
      
      const response = await axios.get(`${this.BASE_URL_V6}/quote`, {
        params,
        timeout: 10000
      });

      if (!response.data) {
        throw new SniperError(
          'No quote received from Jupiter',
          ErrorCodes.RPC_ERROR
        );
      }

      const quote: JupiterQuote = response.data;
      
      console.log(`   Input: ${inputAmount} (${inputMint.slice(0, 8)}...)`);
      console.log(`   Output: ${quote.outAmount} (${outputMint.slice(0, 8)}...)`);
      console.log(`   Price Impact: ${quote.priceImpactPct}%`);
      console.log(`   Route: ${quote.routePlan.length} hop(s)`);

      return quote;

    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new SniperError(
          `Jupiter quote failed: ${error.response?.data?.error || error.message}`,
          ErrorCodes.RPC_ERROR
        );
      }
      throw error;
    }
  }

  // 🔥 УЛУЧШЕННЫЙ fallback для получения транзакции 
  private async getSwapTransactionWithImprovedFallback(quote: JupiterQuote): Promise<string> {
    console.log(`📝 Getting swap transaction with improved fallback...`);
    
    // Стратегия 1: Сначала пробуем LEGACY (самый стабильный)
    try {
      console.log(`🔄 Attempt 1: Legacy transaction (recommended)`);
      return await this.getSwapTransaction(quote, {
        wrapAndUnwrapSol: true,
        useSharedAccounts: false,
        feeAccount: undefined,
        trackingAccount: undefined,
        computeUnitPriceMicroLamports: 'auto',
        asLegacyTransaction: true, // 🔥 НАЧИНАЕМ С LEGACY
        skipUserAccountsRpcCalls: true
      });
    } catch (error: unknown) {
      console.warn('⚠️  Legacy transaction failed, trying versioned without lookup tables...');
    }

    // Стратегия 2: Versioned без Address Lookup Tables
    try {
      console.log(`🔄 Attempt 2: Versioned without lookup tables`);
      return await this.getSwapTransaction(quote, {
        wrapAndUnwrapSol: true,
        useSharedAccounts: false,
        feeAccount: undefined,
        trackingAccount: undefined,
        computeUnitPriceMicroLamports: 'auto',
        skipUserAccountsRpcCalls: true
      });
    } catch (error: unknown) {
      console.warn('⚠️  Versioned without lookup tables failed, trying with lookup tables...');
    }

    // Стратегия 3: Versioned с Address Lookup Tables (может вызвать проблемы)
    try {
      console.log(`🔄 Attempt 3: Versioned with lookup tables (risky)`);
      return await this.getSwapTransaction(quote, {
        wrapAndUnwrapSol: true,
        useSharedAccounts: true,
        feeAccount: undefined,
        trackingAccount: undefined,
        computeUnitPriceMicroLamports: 'auto'
      });
    } catch (error: unknown) {
      console.warn('⚠️  All transaction types failed, trying minimal settings...');
    }

    // Стратегия 4: Минимальные настройки как последний шанс
    try {
      console.log(`🔄 Attempt 4: Minimal settings (last resort)`);
      return await this.getSwapTransaction(quote, {
        wrapAndUnwrapSol: true,
        asLegacyTransaction: true
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new SniperError(
        `All transaction strategies failed: ${errorMessage}`,
        ErrorCodes.TRANSACTION_FAILED,
        error
      );
    }
  }

  // Получение транзакции для подписи
  private async getSwapTransaction(quote: JupiterQuote, options: any): Promise<string> {
    try {
      const response = await axios.post(`${this.BASE_URL_V6}/swap`, {
        quoteResponse: quote,
        userPublicKey: this.walletService.getPublicKey().toString(),
        ...options
      }, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.data?.swapTransaction) {
        throw new SniperError(
          'No swap transaction received',
          ErrorCodes.TRANSACTION_FAILED
        );
      }

      const txType = options.asLegacyTransaction ? 'Legacy' : 'Versioned';
      console.log(`✅ ${txType} swap transaction received`);
      return response.data.swapTransaction;

    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new SniperError(
          `Jupiter swap transaction failed: ${error.response?.data?.error || error.message}`,
          ErrorCodes.TRANSACTION_FAILED
        );
      }
      throw error;
    }
  }

  // 🔥 УЛУЧШЕННАЯ подпись и отправка транзакции с поддержкой всех типов
  private async signAndSendTransactionImproved(swapTransactionBase64: string): Promise<string> {
    try {
      console.log(`✍️  Signing and sending transaction...`);

      // Декодируем транзакцию
      const transactionBuf = Buffer.from(swapTransactionBase64, 'base64');
      
      let signature: string;
      
      // Сначала пробуем как Legacy Transaction (самый надёжный)
      try {
        console.log(`🔄 Trying as Legacy Transaction`);
        const legacyTx = Transaction.from(transactionBuf);
        legacyTx.sign(this.walletService.getKeypair());
        
        signature = await this.connection.sendRawTransaction(legacyTx.serialize(), {
          maxRetries: 3,
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        });
        
        console.log(`✅ Legacy transaction sent successfully`);
        
      } catch (legacyError: any) {
        console.warn('⚠️  Legacy transaction failed, trying VersionedTransaction...');
        
        try {
          // Пробуем как VersionedTransaction
          console.log(`🔄 Trying as VersionedTransaction`);
          const versionedTx = VersionedTransaction.deserialize(transactionBuf);
          
          // Если есть Address Lookup Tables, загружаем их
          if (versionedTx.message.addressTableLookups && versionedTx.message.addressTableLookups.length > 0) {
            console.log(`📋 Loading ${versionedTx.message.addressTableLookups.length} Address Lookup Tables...`);
            
            try {
              const lookupTableAccounts = await this.getAddressLookupTableAccounts(
                versionedTx.message.addressTableLookups.map(lookup => lookup.accountKey.toString())
              );
              
              console.log(`✅ Loaded ${lookupTableAccounts.length} lookup table accounts`);
              
              // Подписываем с lookup tables
              versionedTx.sign([this.walletService.getKeypair()]);
              
              // Отправляем VersionedTransaction
              signature = await this.connection.sendTransaction(versionedTx, {
                maxRetries: 5, // 🔥 БОЛЬШЕ ПОПЫТОК
                skipPreflight: true, // 🔥 ПРОПУСКАЕМ SIMULATION
                preflightCommitment: 'confirmed',
                minContextSlot: undefined
              });
              
              console.log(`✅ VersionedTransaction with lookup tables sent successfully`);
              
            } catch (lookupError: unknown) {
              console.warn('⚠️  Address Lookup Tables failed, trying without them...');
              
              // Fallback: подписываем без lookup tables
              versionedTx.sign([this.walletService.getKeypair()]);
              signature = await this.connection.sendTransaction(versionedTx, {
                maxRetries: 5, // 🔥 БОЛЬШЕ ПОПЫТОК
                skipPreflight: true, // 🔥 ПРОПУСКАЕМ SIMULATION
                preflightCommitment: 'confirmed'
              });
              
              console.log(`✅ VersionedTransaction without lookup tables sent successfully`);
            }
          } else {
            // VersionedTransaction без lookup tables
            versionedTx.sign([this.walletService.getKeypair()]);
            signature = await this.connection.sendTransaction(versionedTx, {
              maxRetries: 5, // 🔥 БОЛЬШЕ ПОПЫТОК
              skipPreflight: true, // 🔥 ПРОПУСКАЕМ SIMULATION
              preflightCommitment: 'confirmed'
            });
            
            console.log(`✅ VersionedTransaction sent successfully`);
          }
          
        } catch (versionedError: any) {
          throw new SniperError(
            `Both transaction types failed: Legacy(${legacyError.message}) Versioned(${versionedError.message})`,
            ErrorCodes.TRANSACTION_FAILED,
            { legacyError, versionedError }
          );
        }
      }

      console.log(`📡 Transaction sent: ${signature}`);
      return signature;

    } catch (error: any) {
      // Улучшенная обработка специфичных ошибок Solana
      let errorMessage = error.message || 'Unknown transaction error';
      
      if (error.message?.includes('address table account')) {
        errorMessage = 'Address lookup table error - using legacy transaction fallback';
      } else if (error.message?.includes('Simulation failed')) {
        errorMessage = 'Transaction simulation failed - insufficient balance or token issues';
      } else if (error.message?.includes('Blockhash not found')) {
        errorMessage = 'Transaction expired - try again';
      } else if (error.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient SOL balance for transaction fees';
      } else if (error.message?.includes('0x1')) {
        errorMessage = 'Insufficient balance for swap amount';
      } else if (error.message?.includes('slippage')) {
        errorMessage = 'Slippage tolerance exceeded - price moved too much';
      }

      throw new SniperError(
        `Transaction failed: ${errorMessage}`,
        ErrorCodes.TRANSACTION_FAILED,
        error
      );
    }
  }

  // Загрузка Address Lookup Table Accounts с улучшенной обработкой ошибок
  private async getAddressLookupTableAccounts(keys: string[]): Promise<AddressLookupTableAccount[]> {
    try {
      console.log(`📋 Loading ${keys.length} Address Lookup Tables...`);
      
      const addressLookupTableAccountInfos = await this.connection.getMultipleAccountsInfo(
        keys.map((key) => new PublicKey(key))
      );

      const accounts = addressLookupTableAccountInfos.reduce((acc, accountInfo, index) => {
        const addressLookupTableAddress = keys[index];
        if (accountInfo) {
          try {
            const addressLookupTableAccount = new AddressLookupTableAccount({
              key: new PublicKey(addressLookupTableAddress),
              state: AddressLookupTableAccount.deserialize(accountInfo.data),
            });
            acc.push(addressLookupTableAccount);
          } catch (deserializeError: unknown) {
            console.warn(`⚠️  Failed to deserialize lookup table ${addressLookupTableAddress}`);
          }
        } else {
          console.warn(`⚠️  Lookup table account ${addressLookupTableAddress} not found`);
        }
        return acc;
      }, new Array<AddressLookupTableAccount>());
      
      console.log(`✅ Successfully loaded ${accounts.length}/${keys.length} lookup table accounts`);
      return accounts;
      
    } catch (error: unknown) {
      console.warn('⚠️  Failed to load Address Lookup Tables:', error);
      return [];
    }
  }

  // Ожидание подтверждения транзакции с retry логикой
  private async waitForConfirmation(signature: string): Promise<void> {
    try {
      console.log(`⏳ Waiting for confirmation...`);
      
      const confirmation = await this.connection.confirmTransaction(
        signature,
        'confirmed'
      );

      if (confirmation.value.err) {
        throw new SniperError(
          `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
          ErrorCodes.TRANSACTION_FAILED
        );
      }

      console.log(`✅ Transaction confirmed`);

    } catch (error: unknown) {
      // Retry механизм для confirmation
      console.warn('⚠️  First confirmation attempt failed, retrying...');
      
      try {
        // Ждём немного и пробуем ещё раз
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const retryConfirmation = await this.connection.confirmTransaction(
          signature,
          'confirmed'
        );

        if (retryConfirmation.value.err) {
          throw new SniperError(
            `Transaction failed on retry: ${JSON.stringify(retryConfirmation.value.err)}`,
            ErrorCodes.TRANSACTION_FAILED
          );
        }

        console.log(`✅ Transaction confirmed on retry`);
        
      } catch (retryError: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new SniperError(
          `Transaction confirmation failed: ${errorMessage}`,
          ErrorCodes.TRANSACTION_FAILED,
          error
        );
      }
    }
  }

  // Валидация котировки
  private validateQuote(quote: JupiterQuote, expectedAmount: number, maxSlippage: number): void {
    const priceImpact = parseFloat(quote.priceImpactPct);
    const maxPriceImpact = maxSlippage / 100;

    if (priceImpact > maxPriceImpact) {
      throw new SniperError(
        `Price impact too high: ${priceImpact.toFixed(2)}% > ${maxPriceImpact.toFixed(2)}%`,
        ErrorCodes.SLIPPAGE_EXCEEDED
      );
    }

    if (!quote.outAmount || parseFloat(quote.outAmount) <= 0) {
      throw new SniperError(
        'Invalid output amount in quote',
        ErrorCodes.INVALID_TOKEN
      );
    }

    if (!quote.routePlan || quote.routePlan.length === 0) {
      throw new SniperError(
        'No routing plan found',
        ErrorCodes.INVALID_TOKEN
      );
    }

    console.log(`✅ Quote validation passed`);
  }

  // Получение только котировки
  public async getQuoteOnly(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 500
  ): Promise<JupiterQuote> {
    return this.getQuoteV6(inputMint, outputMint, amount, slippageBps);
  }

  // Проверка доступности токена для торговли
  public async checkTokenTradeable(tokenMint: string): Promise<boolean> {
    try {
      const solMint = 'So11111111111111111111111111111111111111112';
      const testAmount = 0.001;
      
      await this.getQuoteV6(solMint, tokenMint, testAmount, 1000);
      return true;
    } catch (error: unknown) {
      console.warn(`Token ${tokenMint} may not be tradeable:`, error);
      return false;
    }
  }
}