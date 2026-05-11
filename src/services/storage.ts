export const KEYS = {
  ORDERS: 'syndrax_orders',
  INVENTORY: 'syndrax_inventory',
  SETTINGS: 'syndrax_settings',
  COMPETITORS: 'syndrax_competitors',
  LAST_SYNC: 'syndrax_last_sync',
  API_KEY: 'syndrax_api_key',
  ACTIVITY_LOG: 'syndrax_activity',
  SYNC_LOG: 'syndrax_sync_log',
  AUTO_SYNC_ENABLED: 'syndrax_auto_sync'
} as const;

export interface Order {
  id: string;
  buyerName: string;
  buyerAddress: string;
  buyerCity: string;
  buyerState: string;
  buyerZip: string;
  buyerCountry: string;
  itemTitle: string;
  itemId: string;
  quantity: number;
  salePrice: number;
  sourcePlatform: 'amazon' | 'aliexpress';
  status: 'pending' | 'in_progress' | 'complete' | 'failed';
  trackingNumber?: string;
  createdAt: number;
  updatedAt: number;
}

export interface InventoryItem {
  listingId: string;          // eBay item ID (primary key)
  title: string;
  ebayPrice: number;
  quantity: number;
  customLabel: string;        // Raw base64 SKU from eBay
  asin: string;               // Decoded ASIN
  sourceUrl: string;          // https://www.amazon.com/dp/{ASIN}
  sourcePlatform: 'amazon' | 'aliexpress' | 'unknown';
  imageUrl: string;
  listingUrl: string;
  lastScanned: string;        // ISO timestamp
  supplierPrice: number;      // From last price check — 0 if never checked
  inStock: boolean;           // From last price check — true by default
  stockLevel: 'in_stock' | 'low_stock' | 'out_of_stock';
  // Legacy compatibility
  itemId?: string;
  lastChecked?: number;
  stockStatus?: string;
  supplierUrl?: string;
  priceChangePercent?: number;
}

export interface SyncLogItem {
  itemId: string;
  title: string;
  action: 'PRICE_UPDATED' | 'OUT_OF_STOCK' | 'NO_CHANGE' | 'ERROR' | 'BACK_IN_STOCK';
  oldPrice?: number;
  newPrice?: number;
  supplierPrice?: number;
  changePercent?: string;
  error?: string;
  timestamp: string;
}

export interface SyncStats {
  lastSync: string | null;
  itemsChecked: number;
  itemsUpdated: number;
  outOfStockCount: number;
  avgProfitMargin: number;
}

export interface Settings {
  markupPercent: number;
  priceChangeThreshold: number;
  defaultSupplier: 'amazon' | 'aliexpress';
  dailySyncTime: string;
  debugMode: boolean;
}

export interface ActivityItem {
  id: string;
  message: string;
  status: 'success' | 'error' | 'warning';
  timestamp: number;
}

export interface CompetitorProduct {
  title: string;
  soldPrice: number;
  estimatedCost: number;
  estimatedProfit: number;
  profitPercent: number;
  seller: string;
  condition: string;
  url: string;
}

export const storage = {
  async get<T>(key: string): Promise<T | undefined> {
    const result = await chrome.storage.local.get(key);
    return result[key] as T | undefined;
  },

  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  },

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  },

  async clear(): Promise<void> {
    await chrome.storage.local.clear();
  },

  async getOrders(): Promise<Order[]> {
    return (await this.get<Order[]>(KEYS.ORDERS)) || [];
  },

  async saveOrder(order: Order): Promise<void> {
    const orders = await this.getOrders();
    const index = orders.findIndex(o => o.id === order.id);
    if (index >= 0) {
      orders[index] = order;
    } else {
      orders.push(order);
    }
    await this.set(KEYS.ORDERS, orders);
  },

  async getInventory(): Promise<InventoryItem[]> {
    return (await this.get<InventoryItem[]>(KEYS.INVENTORY)) || [];
  },

  async saveInventory(items: InventoryItem[]): Promise<void> {
    await this.set(KEYS.INVENTORY, items);
  },

  async getSettings(): Promise<Settings> {
    const defaults: Settings = {
      markupPercent: 30,
      priceChangeThreshold: 5,
      defaultSupplier: 'amazon',
      dailySyncTime: '06:00',
      debugMode: false
    };
    const stored = await this.get<Partial<Settings>>(KEYS.SETTINGS);
    return { ...defaults, ...stored };
  },

  async saveSettings(settings: Settings): Promise<void> {
    await this.set(KEYS.SETTINGS, settings);
  },

  async getApiKey(): Promise<string | undefined> {
    return this.get<string>(KEYS.API_KEY);
  },

  async saveApiKey(key: string): Promise<void> {
    await this.set(KEYS.API_KEY, key);
  },

  async getActivityLog(): Promise<ActivityItem[]> {
    return (await this.get<ActivityItem[]>(KEYS.ACTIVITY_LOG)) || [];
  },

  async addActivity(message: string, status: 'success' | 'error' | 'warning'): Promise<void> {
    const log = await this.getActivityLog();
    const item: ActivityItem = {
      id: crypto.randomUUID(),
      message,
      status,
      timestamp: Date.now()
    };
    log.unshift(item);
    await this.set(KEYS.ACTIVITY_LOG, log.slice(0, 50));
  },

  async getCompetitors(): Promise<CompetitorProduct[]> {
    return (await this.get<CompetitorProduct[]>(KEYS.COMPETITORS)) || [];
  },

  async saveCompetitors(products: CompetitorProduct[]): Promise<void> {
    await this.set(KEYS.COMPETITORS, products);
  },

  async getLastSync(): Promise<number | undefined> {
    return this.get<number>(KEYS.LAST_SYNC);
  },

  async updateLastSync(): Promise<void> {
    await this.set(KEYS.LAST_SYNC, Date.now());
  }
};
