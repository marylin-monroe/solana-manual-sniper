// src/utils/helpers.ts
// Вспомогательные функции для снайпера

import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Форматирование чисел
export class NumberFormatter {
  // Форматирование USD с правильными разделителями
  public static formatUSD(amount: number): string {
    if (amount >= 1_000_000) {
      return `$${(amount / 1_000_000).toFixed(2)}M`;
    } else if (amount >= 1_000) {
      return `$${(amount / 1_000).toFixed(2)}K`;
    } else {
      return `$${amount.toFixed(2)}`;
    }
  }

  // Форматирование токенов с правильным количеством знаков
  public static formatTokenAmount(amount: number, decimals: number = 6): string {
    if (amount >= 1_000_000_000) {
      return `${(amount / 1_000_000_000).toFixed(2)}B`;
    } else if (amount >= 1_000_000) {
      return `${(amount / 1_000_000).toFixed(2)}M`;
    } else if (amount >= 1_000) {
      return `${(amount / 1_000).toFixed(2)}K`;
    } else if (amount >= 1) {
      return amount.toFixed(2);
    } else {
      // Для очень маленьких чисел показываем больше знаков
      return amount.toFixed(Math.min(8, decimals));
    }
  }

  // Форматирование SOL
  public static formatSOL(lamports: number): string {
    const sol = lamports / LAMPORTS_PER_SOL;
    return `${sol.toFixed(4)} SOL`;
  }

  // Форматирование процентов
  public static formatPercent(percent: number): string {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  }

  // Форматирование времени выполнения
  public static formatExecutionTime(ms: number): string {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(2)}s`;
    } else {
      return `${ms}ms`;
    }
  }
}

// Валидация данных
export class Validator {
  // Проверка Solana адреса
  public static isValidSolanaAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return address.length >= 32 && address.length <= 44;
    } catch {
      return false;
    }
  }

  // Проверка что число в разумных пределах
  public static isValidAmount(amount: number, min: number = 0, max: number = Infinity): boolean {
    return typeof amount === 'number' && 
           !isNaN(amount) && 
           isFinite(amount) && 
           amount >= min && 
           amount <= max;
  }

  // Проверка slippage в basis points
  public static isValidSlippage(slippageBps: number): boolean {
    return this.isValidAmount(slippageBps, 1, 10000); // 0.01% - 100%
  }

  // Проверка URL
  public static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// Работа со временем
export class TimeHelper {
  // Форматирование возраста в человеко-читаемый вид
  public static formatAge(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ago`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ago`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s ago`;
    } else {
      return `${seconds}s ago`;
    }
  }

  // Форматирование timestamp в локальное время
  public static formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  }

  // Получение текущего timestamp
  public static getCurrentTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  // Задержка (для rate limiting)
  public static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Работа со строками
export class StringHelper {
  // Сокращение адреса для отображения
  public static shortenAddress(address: string, startChars: number = 6, endChars: number = 4): string {
    if (address.length <= startChars + endChars) {
      return address;
    }
    return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
  }

  // Очистка символа токена от мусора
  public static cleanTokenSymbol(symbol: string): string {
    return symbol
      .replace(/[^\w\s]/g, '') // Удаляем спецсимволы
      .trim()
      .substring(0, 20); // Максимум 20 символов
  }

  // Генерация случайной строки
  public static generateRandomString(length: number = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Очистка строки от emoji и спецсимволов
  public static cleanString(str: string): string {
    return str
      .replace(/[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu, '')
      .trim();
  }
}

// Математические функции
export class MathHelper {
  // Преобразование basis points в проценты
  public static bpsToPercent(bps: number): number {
    return bps / 100;
  }

  // Преобразование процентов в basis points
  public static percentToBps(percent: number): number {
    return Math.round(percent * 100);
  }

  // Вычисление price impact
  public static calculatePriceImpact(
    inputAmount: number,
    outputAmount: number,
    marketPrice: number
  ): number {
    const effectivePrice = inputAmount / outputAmount;
    return ((effectivePrice - marketPrice) / marketPrice) * 100;
  }

  // Безопасное деление (избегает деления на ноль)
  public static safeDivide(a: number, b: number, defaultValue: number = 0): number {
    return b !== 0 ? a / b : defaultValue;
  }

  // Ограничение числа в пределах
  public static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  // Округление до определённого количества знаков
  public static roundTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}

// Работа с массивами и объектами
export class ArrayHelper {
  // Удаление дубликатов из массива
  public static removeDuplicates<T>(array: T[]): T[] {
    return [...new Set(array)];
  }

  // Разбивка массива на чанки
  public static chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Перемешивание массива
  public static shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Группировка объектов по ключу
  public static groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const groupKey = String(item[key]);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }
}

// Логирование и отладка
export class Logger {
  private static logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';

  public static setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    this.logLevel = level;
  }

  public static debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(`🔍 [DEBUG] ${message}`, ...args);
    }
  }

  public static info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(`ℹ️  [INFO] ${message}`, ...args);
    }
  }

  public static warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`⚠️  [WARN] ${message}`, ...args);
    }
  }

  public static error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(`❌ [ERROR] ${message}`, ...args);
    }
  }

  private static shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }
}

// Экспорт всех утилит для удобства
export {
  NumberFormatter as Format,
  Validator as Validate,
  TimeHelper as Time,
  StringHelper as String,
  MathHelper as Math,
  ArrayHelper as Array,
  Logger as Log
};