// src/utils/wallet.ts
// Работа с Solana кошельком

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import bs58 from 'bs58';
import settings from '../config/settings';
import { SniperError, ErrorCodes } from '../interfaces/types';

export class WalletService {
  private connection: Connection;
  private keypair: Keypair;
  private publicKey: PublicKey;

  constructor() {
    this.connection = new Connection(settings.getRpcUrl(), 'confirmed');
    this.keypair = this.loadKeypair();
    this.publicKey = this.keypair.publicKey;
    
    console.log(`🔑 Wallet loaded: ${this.publicKey.toString()}`);
  }

  private loadKeypair(): Keypair {
    try {
      const privateKeyString = settings.getPrivateKey();
      
      if (!privateKeyString || privateKeyString === 'YOUR_PRIVATE_KEY_HERE') {
        throw new SniperError(
          'Private key not configured in .env file',
          ErrorCodes.WALLET_ERROR
        );
      }

      console.log(`🔍 Debug: Private key length: ${privateKeyString.length}`);
      console.log(`🔍 Debug: First 50 chars: ${privateKeyString.substring(0, 50)}...`);

      // Универсальный парсер
      let secretKey: Uint8Array;

      // Убираем все пробелы и переносы строк
      const cleanKey = privateKeyString.replace(/\s+/g, '');
      console.log(`🔍 Debug: Clean key length: ${cleanKey.length}`);

      if (cleanKey.startsWith('[') && cleanKey.endsWith(']')) {
        // JSON array format: [1,2,3,...]
        console.log(`🔍 Debug: Parsing as JSON array`);
        const keyArray = JSON.parse(cleanKey);
        console.log(`🔍 Debug: Array length: ${keyArray.length}`);
        secretKey = new Uint8Array(keyArray);
      } else {
        // Предполагаем массив чисел через запятую
        console.log(`🔍 Debug: Parsing as comma-separated numbers`);
        const numbers = cleanKey.split(',').map(n => parseInt(n.trim()));
        console.log(`🔍 Debug: Numbers array length: ${numbers.length}`);
        secretKey = new Uint8Array(numbers);
      }

      console.log(`🔍 Debug: Final secret key size: ${secretKey.length} bytes`);
      
      // Поддерживаем как 32-байтовый seed, так и 64-байтовый secret key
      if (secretKey.length === 32) {
        console.log('🔑 Using 32-byte seed');
        return Keypair.fromSeed(secretKey);
      } else if (secretKey.length === 64) {
        console.log('🔑 Using 64-byte secret key');
        return Keypair.fromSecretKey(secretKey);
      } else {
        throw new Error(`Key must be 32 bytes (seed) or 64 bytes (secret key), got ${secretKey.length} bytes`);
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new SniperError(
        'Failed to load wallet keypair. Check PRIVATE_KEY format in .env',
        ErrorCodes.WALLET_ERROR,
        error
      );
    }
  }

  // Получить баланс SOL
  public async getSolBalance(): Promise<number> {
    try {
      const balance = await this.connection.getBalance(this.publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error: unknown) {
      throw new SniperError(
        'Failed to fetch SOL balance',
        ErrorCodes.RPC_ERROR,
        error
      );
    }
  }

  // Получить баланс токена
  public async getTokenBalance(tokenMint: string): Promise<number> {
    try {
      const tokenMintPubkey = new PublicKey(tokenMint);
      const tokenAccountAddress = await getAssociatedTokenAddress(
        tokenMintPubkey,
        this.publicKey
      );

      const tokenAccount = await getAccount(this.connection, tokenAccountAddress);
      return Number(tokenAccount.amount);
    } catch (error: unknown) {
      // Если аккаунт не существует, баланс = 0
      return 0;
    }
  }

  // Проверить, есть ли достаточно SOL для транзакции
  public async checkSufficientBalance(requiredSol: number): Promise<boolean> {
    const balance = await this.getSolBalance();
    const fee = 0.001; // примерная комиссия
    return balance >= (requiredSol + fee);
  }

  // Геттеры для других сервисов
  public getConnection(): Connection {
    return this.connection;
  }

  public getKeypair(): Keypair {
    return this.keypair;
  }

  public getPublicKey(): PublicKey {
    return this.publicKey;
  }

  public getWalletAddress(): string {
    return this.publicKey.toString();
  }

  // Переключение на backup RPC
  public switchToBackupRpc(): void {
    const backupUrl = settings.getBackupRpcUrl();
    this.connection = new Connection(backupUrl, 'confirmed');
    console.log(`🔄 Switched to backup RPC: ${backupUrl}`);
  }

  // Проверка соединения с RPC
  public async testConnection(): Promise<boolean> {
    try {
      await this.connection.getSlot();
      return true;
    } catch (error: unknown) {
      console.warn('⚠️  RPC connection failed, trying backup...');
      this.switchToBackupRpc();
      
      try {
        await this.connection.getSlot();
        return true;
      } catch (backupError: unknown) {
        throw new SniperError(
          'Both primary and backup RPC failed',
          ErrorCodes.RPC_ERROR,
          { primary: error, backup: backupError }
        );
      }
    }
  }

  // Получить информацию о кошельке
  public async getWalletInfo(): Promise<{
    address: string;
    solBalance: number;
    isActive: boolean;
  }> {
    const solBalance = await this.getSolBalance();
    const isActive = await this.testConnection();

    return {
      address: this.getWalletAddress(),
      solBalance,
      isActive
    };
  }
}