// main.js - ИСПРАВЛЕННАЯ ВЕРСИЯ для работы с реальными деньгами
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Импортируем наши сервисы из dist/
const { AnalysisService } = require('./dist/services/analysis');
const { JupiterService } = require('./dist/services/jupiter');
const { WalletService } = require('./dist/utils/wallet');

class SniperApp {
  constructor() {
    this.window = null;
    this.analysisService = null;
    this.jupiterService = null;
    this.walletService = null;
    this.tokensFilePath = path.join(__dirname, 'owned-tokens.json');
    
    // Кэш для скорости
    this.cache = {
      solPrice: 0,
      solBalance: 0,
      lastBalanceCheck: 0
    };
  }

  async initialize() {
    // Инициализируем сервисы
    try {
      this.analysisService = new AnalysisService();
      this.jupiterService = new JupiterService();
      this.walletService = new WalletService();
      console.log('✅ Services initialized');
    } catch (error) {
      console.error('❌ Service initialization failed:', error);
    }
  }

  createWindow() {
    this.window = new BrowserWindow({
      width: 1000,
      height: 700,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      title: '🎯 Solana Sniper',
      resizable: true,
      minimizable: true,
      maximizable: true
    });

    this.window.loadFile('renderer.html');
    this.window.on('closed', () => {
      this.window = null;
    });
  }

  setupIPC() {
    // 🚀 МГНОВЕННАЯ ПОКУПКА
    ipcMain.handle('ultra-fast-buy', async (event, { tokenMint, amount, slippage }) => {
      const startTime = Date.now();
      const tradeId = `buy_${Date.now()}`;
      
      try {
        console.log(`🚀 [${tradeId}] ULTRA-FAST BUY: ${amount} SOL → ${tokenMint.slice(0,8)}...`);
        
        // Быстрая проверка баланса
        const balance = await this.walletService.getSolBalance();
        const requiredBalance = amount + 0.005;
        
        if (balance < requiredBalance) {
          throw new Error(`Insufficient balance: need ${requiredBalance.toFixed(4)}, have ${balance.toFixed(4)}`);
        }
        
        // Выполняем покупку
        const result = await this.jupiterService.executeSwap(
          'So11111111111111111111111111111111111111112', // SOL
          tokenMint,
          amount,
          slippage || 1000
        );
        
        if (result.success && result.signature) {
          const totalTime = Date.now() - startTime;
          console.log(`✅ [${tradeId}] BUY SUCCESS: ${totalTime}ms`);
          
          return { 
            success: true, 
            data: {
              signature: result.signature,
              tokenAmount: result.tokenAmount || 0,
              solSpent: result.solSpent || amount,
              priceImpact: result.priceImpact || 0,
              executionTime: totalTime
            }
          };
        } else {
          throw new Error(result.error || 'Unknown swap error');
        }
        
      } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error(`💥 [${tradeId}] BUY FAILED: ${totalTime}ms -`, error.message);
        
        return { 
          success: false, 
          error: error.message,
          tradeId,
          executionTime: totalTime 
        };
      }
    });

    // 🛡️ БЕЗОПАСНАЯ ПРОДАЖА
    ipcMain.handle('ultra-safe-sell', async (event, { tokenMint, amount, slippage }) => {
      const startTime = Date.now();
      const tradeId = `sell_${Date.now()}`;
      
      try {
        console.log(`🛡️ [${tradeId}] ULTRA-SAFE SELL: ${amount} tokens → SOL`);
        
        // Проверяем реальный баланс ПЕРЕД продажей
        const realBalance = await this.walletService.getTokenBalance(tokenMint);
        console.log(`📊 Real token balance: ${realBalance}`);
        
        if (realBalance === 0) {
          throw new Error('No tokens to sell');
        }
        
        if (amount > realBalance) {
          throw new Error(`Insufficient balance: trying to sell ${amount}, but only have ${realBalance}`);
        }
        
        // Выполняем продажу
        const result = await this.jupiterService.executeSwap(
          tokenMint,
          'So11111111111111111111111111111111111111112', // SOL
          amount,
          slippage || 1000
        );
        
        if (result.success && result.signature) {
          const totalTime = Date.now() - startTime;
          console.log(`✅ [${tradeId}] SELL SUCCESS: ${totalTime}ms`);
          
          return { 
            success: true, 
            data: {
              signature: result.signature,
              solReceived: result.tokenAmount || 0,
              priceImpact: result.priceImpact || 0,
              executionTime: totalTime
            }
          };
        } else {
          throw new Error(result.error || 'Unknown swap error');
        }
        
      } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error(`💥 [${tradeId}] SELL FAILED: ${totalTime}ms -`, error.message);
        
        return { 
          success: false, 
          error: error.message,
          tradeId,
          executionTime: totalTime 
        };
      }
    });

    // ⚡ МОЛНИЕНОСНЫЙ АНАЛИЗ
    ipcMain.handle('lightning-analysis', async (event, tokenMint) => {
      try {
        const startTime = Date.now();
        const analysis = await this.analysisService.analyzeToken(tokenMint);
        const elapsed = Date.now() - startTime;
        
        console.log(`⚡ Lightning analysis: ${elapsed}ms`);
        return { success: true, data: analysis };
        
      } catch (error) {
        console.error('Analysis error:', error);
        return { success: false, error: error.message };
      }
    });

    // Баланс кошелька
    ipcMain.handle('get-balance', async () => {
      try {
        const balance = await this.walletService.getSolBalance();
        return { success: true, data: balance };
      } catch (error) {
        console.error('Balance error:', error);
        return { success: false, error: error.message };
      }
    });

    // Баланс токена
    ipcMain.handle('get-token-balance', async (event, tokenMint) => {
      try {
        const balance = await this.walletService.getTokenBalance(tokenMint);
        console.log(`📊 Token ${tokenMint.slice(0, 8)} balance: ${balance}`);
        return { success: true, data: balance };
      } catch (error) {
        console.error('Token balance error:', error);
        return { success: false, error: error.message };
      }
    });

    // Сохранение токенов
    ipcMain.handle('save-tokens', async (event, tokens) => {
      try {
        const tokensData = {
          tokens: tokens,
          lastUpdated: Date.now(),
          walletAddress: this.walletService.getWalletAddress()
        };
        
        await fs.writeFile(this.tokensFilePath, JSON.stringify(tokensData, null, 2));
        console.log(`💾 Saved ${tokens.length} tokens to file`);
        return { success: true };
      } catch (error) {
        console.error('Save tokens error:', error);
        return { success: false, error: error.message };
      }
    });

    // Загрузка токенов
    ipcMain.handle('load-tokens', async () => {
      try {
        const data = await fs.readFile(this.tokensFilePath, 'utf8');
        const tokensData = JSON.parse(data);
        
        // Проверяем что файл для правильного кошелька
        const currentWallet = this.walletService.getWalletAddress();
        if (tokensData.walletAddress !== currentWallet) {
          console.log('⚠️  Tokens file is for different wallet, starting fresh');
          return { success: true, data: [] };
        }
        
        console.log(`📂 Loaded ${tokensData.tokens.length} tokens from file`);
        return { success: true, data: tokensData.tokens || [] };
      } catch (error) {
        console.log('📂 No saved tokens found, starting fresh');
        return { success: true, data: [] };
      }
    });

    // Синхронизация портфеля
    ipcMain.handle('sync-portfolio', async (event, tokens) => {
      try {
        const syncedTokens = [];
        
        for (const token of tokens) {
          const realBalance = await this.walletService.getTokenBalance(token.mint);
          
          if (realBalance > 0) {
            const updatedToken = {
              ...token,
              tokenAmount: realBalance,
              lastSynced: Date.now()
            };
            syncedTokens.push(updatedToken);
          }
        }
        
        console.log(`🔄 Portfolio sync: ${tokens.length} → ${syncedTokens.length} tokens`);
        return { success: true, data: syncedTokens };
      } catch (error) {
        console.error('Portfolio sync error:', error);
        return { success: false, error: error.message };
      }
    });

    // Открытие графиков
    ipcMain.handle('open-charts', async (event, tokenMint) => {
      const { shell } = require('electron');
      try {
        await shell.openExternal(`https://dexscreener.com/solana/${tokenMint}`);
        await shell.openExternal(`https://birdeye.so/token/${tokenMint}`);
        await shell.openExternal(`https://solscan.io/token/${tokenMint}`);
        return { success: true };
      } catch (error) {
        console.error('Open charts error:', error);
        return { success: false, error: error.message };
      }
    });

    // Открытие транзакции
    ipcMain.handle('open-transaction', async (event, signature) => {
      const { shell } = require('electron');
      try {
        await shell.openExternal(`https://solscan.io/tx/${signature}`);
        return { success: true };
      } catch (error) {
        console.error('Open transaction error:', error);
        return { success: false, error: error.message };
      }
    });
  }
}

const sniperApp = new SniperApp();

app.whenReady().then(async () => {
  await sniperApp.initialize();
  sniperApp.createWindow();
  sniperApp.setupIPC();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      sniperApp.createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  console.log('💾 Auto-saving data before quit...');
});