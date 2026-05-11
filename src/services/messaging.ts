export type MessageType =
  | 'EXTRACT_ORDER'
  | 'FULFILL_ORDER'
  | 'SCAN_INVENTORY'
  | 'START_SCAN'
  | 'CHECK_SUPPLIER'
  | 'UPDATE_LISTING'
  | 'GENERATE_SEO'
  | 'SCAN_COMPETITORS'
  | 'GET_STORAGE'
  | 'SET_STORAGE'
  | 'ADD_ACTIVITY'
  | 'ORDER_EXTRACTED'
  | 'FULFILLMENT_STATUS'
  | 'INVENTORY_SCANNED'
  | 'LISTING_CREATED'
  | 'PRODUCT_SCRAPED'
  | 'PRICE_CHECK_RESULT'
  | 'CHECK_PRICE'
  | 'RUN_PRICE_SYNC'
  | 'RUN_FULL_SYNC'
  | 'CHECK_SINGLE_PRICE'
  | 'GET_SYNC_STATS'
  | 'GET_LAST_SYNC_SESSION'
  | 'COMPETITORS_SCANNED'
  | 'PAGE_READY'
  | 'SCAN_PROGRESS'
  | 'SCAN_COMPLETE'
  | 'SYNC_STARTED'
  | 'SYNC_PROGRESS'
  | 'SYNC_COMPLETE'
  | 'AMAZON_PRICE_RESULT'
  | 'AMAZON_SCRAPE_RESULT'
  | 'CHECK_AMAZON_BATCH';

export interface Message<T = unknown> {
  type: MessageType;
  payload: T;
  timestamp: number;
}

export function createMessage<T>(type: MessageType, payload: T): Message<T> {
  return {
    type,
    payload,
    timestamp: Date.now()
  };
}

export function sendToTab<T>(tabId: number, type: MessageType, payload: T): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, createMessage(type, payload));
}

export function sendToBackground<T>(type: MessageType, payload: T): Promise<unknown> {
  return chrome.runtime.sendMessage(createMessage(type, payload));
}

export function onMessage(
  handler: (
    message: Message<unknown>,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => boolean | void
): void {
  chrome.runtime.onMessage.addListener(handler);
}

export function onMessageOnce(
  messageType: MessageType,
  handler: (payload: unknown) => void
): void {
  const listener = (message: Message<unknown>) => {
    if (message.type === messageType) {
      handler(message.payload);
      chrome.runtime.onMessage.removeListener(listener);
    }
  };
  chrome.runtime.onMessage.addListener(listener);
}
