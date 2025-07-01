// src/utils/rpc.ts
// Управление RPC соединениями с автоматическим фолбэком

import { Connection, Commitment } from '@solana/web3.js';
import settings from '../config/settings';

interface RpcEndpoint {
  url: string;
  name: string;
  priority: number;
  isWorking: boolean;
  lastCheckTime: number;
  responseTime: number;
}

export class RpcManager {
  private endpoints: RpcEndpoint[] = [];
  private currentEndpoint: RpcEndpoint | null = null;
  private connection: Connection | null = null;
  private readonly CHECK_INTERVAL = 30000; // 30 секунд
  private readonly TIMEOUT = 5000; // 5 секунд таймаут для проверки

  constructor() {
    this.initializeEndpoints();
    this.startHealthChecks();
    console.log('🌐 RPC Manager initialized with failover support');
  }

  private initializeEndpoints(): void {
    const endpoints: Omit<RpcEndpoint, 'isWorking' | 'lastCheckTime' | 'responseTime'>[] = [
      {
        url: settings.getRpcUrl(),
        name: settings.getRpcUrl().includes('quiknode') ? 'QuickNode' : 'Primary RPC',
        priority: 1
      },
      {
        url: settings.getBackupRpcUrl(),
        name: 'Backup RPC',
        priority: 2
      },
      {
        url: 'https://api.mainnet-beta.solana.com',
        name: 'Public RPC',
        priority: 3
      }
    ];

    // Удаляем дубликаты
    const uniqueUrls = new Set<string>();
    this.endpoints = endpoints
      .filter(endpoint => {
        if (uniqueUrls.has(endpoint.url)) {
          return false;
        }
        uniqueUrls.add(endpoint.url);
        return true;
      })
      .map(endpoint => ({
        ...endpoint,
        isWorking: true,
        lastCheckTime: 0,
        responseTime: 0
      }));

    console.log(`📡 Loaded ${this.endpoints.length} RPC endpoints`);
    this.endpoints.forEach(endpoint => {
      console.log(`   ${endpoint.priority}. ${endpoint.name}: ${endpoint.url}`);
    });
  }

  // Получить текущее соединение с автоматическим фолбэком
  public async getConnection(commitment: Commitment = 'confirmed'): Promise<Connection> {
    if (!this.connection || !this.currentEndpoint?.isWorking) {
      await this.selectBestEndpoint();
    }

    if (!this.connection) {
      throw new Error('No working RPC endpoints available');
    }

    return this.connection;
  }

  // Выбор лучшего доступного эндпоинта
  private async selectBestEndpoint(): Promise<void> {
    console.log('🔍 Selecting best RPC endpoint...');

    // Сортируем по приоритету и проверяем работоспособность
    const sortedEndpoints = [...this.endpoints].sort((a, b) => a.priority - b.priority);

    for (const endpoint of sortedEndpoints) {
      if (await this.testEndpoint(endpoint)) {
        this.currentEndpoint = endpoint;
        this.connection = new Connection(endpoint.url, 'confirmed');
        
        console.log(`✅ Selected: ${endpoint.name} (${endpoint.responseTime}ms)`);
        return;
      }
    }

    throw new Error('All RPC endpoints are down');
  }

  // Тестирование конкретного эндпоинта
  private async testEndpoint(endpoint: RpcEndpoint): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const testConnection = new Connection(endpoint.url, 'confirmed');
      
      // Простая проверка - получаем текущий слот
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('RPC timeout')), this.TIMEOUT)
      );
      
      await Promise.race([
        testConnection.getSlot(),
        timeoutPromise
      ]);

      const responseTime = Date.now() - startTime;
      
      endpoint.isWorking = true;
      endpoint.lastCheckTime = Date.now();
      endpoint.responseTime = responseTime;
      
      return true;

    } catch (error) {
      endpoint.isWorking = false;
      endpoint.lastCheckTime = Date.now();
      endpoint.responseTime = 0;
      
      console.warn(`❌ ${endpoint.name} failed: ${error}`);
      return false;
    }
  }

  // Периодическая проверка здоровья эндпоинтов
  private startHealthChecks(): void {
    setInterval(async () => {
      console.log('🏥 Running RPC health checks...');
      
      const checkPromises = this.endpoints.map(endpoint => this.testEndpoint(endpoint));
      await Promise.allSettled(checkPromises);
      
      const workingCount = this.endpoints.filter(e => e.isWorking).length;
      console.log(`📊 Health check complete: ${workingCount}/${this.endpoints.length} endpoints working`);
      
      // Если текущий эндпоинт упал, переключаемся
      if (this.currentEndpoint && !this.currentEndpoint.isWorking) {
        console.log('🔄 Current endpoint failed, switching...');
        await this.selectBestEndpoint().catch(() => {
          console.error('💀 All endpoints failed during health check');
        });
      }
    }, this.CHECK_INTERVAL);
  }

  // Принудительное переключение на следующий эндпоинт
  public async switchToNextEndpoint(): Promise<void> {
    if (!this.currentEndpoint) {
      await this.selectBestEndpoint();
      return;
    }

    console.log('🔄 Manually switching to next endpoint...');
    
    // Помечаем текущий как неработающий временно
    this.currentEndpoint.isWorking = false;
    
    await this.selectBestEndpoint();
  }

  // Получение статистики RPC эндпоинтов
  public getStats(): {
    current: string | null;
    endpoints: Array<{
      name: string;
      url: string;
      isWorking: boolean;
      responseTime: number;
      priority: number;
    }>;
  } {
    return {
      current: this.currentEndpoint?.name || null,
      endpoints: this.endpoints.map(endpoint => ({
        name: endpoint.name,
        url: endpoint.url,
        isWorking: endpoint.isWorking,
        responseTime: endpoint.responseTime,
        priority: endpoint.priority
      }))
    };
  }

  // Добавление нового эндпоинта во время выполнения
  public addEndpoint(url: string, name: string, priority: number = 999): void {
    const newEndpoint: RpcEndpoint = {
      url,
      name,
      priority,
      isWorking: true,
      lastCheckTime: 0,
      responseTime: 0
    };

    this.endpoints.push(newEndpoint);
    this.endpoints.sort((a, b) => a.priority - b.priority);
    
    console.log(`➕ Added new RPC endpoint: ${name}`);
    
    // Тестируем новый эндпоинт
    this.testEndpoint(newEndpoint);
  }

  // Удаление эндпоинта
  public removeEndpoint(url: string): void {
    const index = this.endpoints.findIndex(e => e.url === url);
    if (index !== -1) {
      const removed = this.endpoints.splice(index, 1)[0];
      console.log(`➖ Removed RPC endpoint: ${removed.name}`);
      
      // Если удалили текущий эндпоинт, переключаемся
      if (this.currentEndpoint?.url === url) {
        this.selectBestEndpoint().catch(() => {
          console.error('Failed to switch after endpoint removal');
        });
      }
    }
  }

  // Получение быстрого соединения для критических операций
  public async getFastConnection(): Promise<Connection> {
    // Возвращаем соединение с самым быстрым эндпоинтом
    const workingEndpoints = this.endpoints
      .filter(e => e.isWorking)
      .sort((a, b) => a.responseTime - b.responseTime);

    if (workingEndpoints.length === 0) {
      throw new Error('No working RPC endpoints for fast connection');
    }

    const fastestEndpoint = workingEndpoints[0];
    return new Connection(fastestEndpoint.url, 'confirmed');
  }

  // Тестирование скорости всех эндпоинтов
  public async benchmarkEndpoints(): Promise<void> {
    console.log('🏃 Benchmarking all RPC endpoints...');
    
    const results: Array<{ name: string; responseTime: number; success: boolean }> = [];
    
    for (const endpoint of this.endpoints) {
      const success = await this.testEndpoint(endpoint);
      results.push({
        name: endpoint.name,
        responseTime: endpoint.responseTime,
        success
      });
    }
    
    // Сортируем по скорости
    results.sort((a, b) => a.responseTime - b.responseTime);
    
    console.log('📊 Benchmark Results:');
    results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const time = result.success ? `${result.responseTime}ms` : 'Failed';
      console.log(`   ${index + 1}. ${status} ${result.name}: ${time}`);
    });
  }

  // Очистка ресурсов
  public cleanup(): void {
    if (this.connection) {
      // Connection в Solana не имеет метода close, но мы можем обнулить ссылку
      this.connection = null;
    }
    this.currentEndpoint = null;
    console.log('🧹 RPC Manager cleaned up');
  }
}

// Singleton instance для использования во всём приложении
export const rpcManager = new RpcManager();
export default rpcManager;