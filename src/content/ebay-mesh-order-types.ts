/**
 * eBay Mesh Order Overlay - Type Definitions
 * For use with: https://www.ebay.com/mesh/ord/details?orderid=*
 */

export interface ShippingAddress {
    fullName: string;
    street: string;
    street2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    phone?: string;
}

export interface LineItem {
    itemId: string;
    title: string;
    sku: string;
    decodedSku: string;
    quantity: number;
    available: number;
    itemPrice: number;
    itemTotal: number;
    imageUrl: string;
    itemUrl: string;
    trackingInfo?: string;
    condition?: string;
}

export interface OrderData {
    orderId: string;
    orderDate?: string;
    orderStatus?: string;
    lineItems: LineItem[];
    shipping: ShippingAddress;
    shippingCost?: number;
    salesTax?: number;
    totalAmount?: number;
    buyerId?: string;
    buyerUsername?: string;
}

export interface AutoOrderSettings {
    getLinkOnly: boolean;
    useGiftOption: boolean;
    giftMessage: string;
    giftSender: string;
    defaultQuantityIncrease: number;
    autoFillAddress: boolean;
}

export interface ETASettings {
    etaMessage: string;
    customEtaDate: string;
}

export interface FeedbackSettings {
    feedbackMessage: string;
}

export interface OverlayState {
    isExpanded: boolean;
    settingsModalVisible: boolean;
    currentItemIndex: number;
    processingAutoOrder: boolean;
}

export interface ChromeStorageData {
    autoOrderSettings: AutoOrderSettings;
    etaSettings: ETASettings;
    feedbackSettings: FeedbackSettings;
    currentFulfillmentOrder?: OrderData;
    fulfillmentTimestamp?: number;
    pendingAmazonOrder?: {
        shipping: ShippingAddress;
        itemTitle: string;
        quantity: number;
        giftOptions?: {
            enabled: boolean;
            message: string;
            sender: string;
        };
    };
}

export interface MessagePayload {
    type: string;
    data?: any;
}

export const DEFAULT_AUTO_ORDER_SETTINGS: AutoOrderSettings = {
    getLinkOnly: false,
    useGiftOption: false,
    giftMessage: '',
    giftSender: '',
    defaultQuantityIncrease: 0,
    autoFillAddress: true
};

export const DEFAULT_ETA_SETTINGS: ETASettings = {
    etaMessage: 'Your order is expected to arrive by {date}. Thank you for your purchase!',
    customEtaDate: ''
};

export const DEFAULT_FEEDBACK_SETTINGS: FeedbackSettings = {
    feedbackMessage: 'Thank you for your purchase! We hope you enjoy your item. If you have any questions, please don\'t hesitate to reach out.'
};

// DOM Selectors for eBay Mesh Order Details Page
export const EBAY_MESH_SELECTORS = {
    // Page identification
    orderIdFromUrl: /orderid[=\/]([^&\/]+)/i,
    
    // Shipping address selectors
    shipToContainer: '.ship-to',
    addressContainer: '.ship-to .address',
    copyAddressButton: '.ship-to button[aria-label*="Copy address"]',
    
    // Address field buttons (within .address div)
    nameButton: '.address div:first-child .tooltip button',
    streetButton: '.address div:nth-child(2) .tooltip button',
    cityStateZipContainer: '.address div:nth-child(3)',
    countryButton: '.address div:nth-child(4) .tooltip button',
    
    // Item info selectors
    itemInfoContainer: '#itemInfo',
    lineItemCard: '.lineItemCard',
    lineItemCardInfo: '.lineItemCardInfo',
    itemIdContainer: '.lineItemCardInfo__itemId.spaceTop',
    skuContainer: '.lineItemCardInfo__sku.spaceTop',
    
    // Item details
    itemTitle: '.lineItemCardInfo__content .details a span.PSEUDOLINK',
    itemImage: '.orders-image-control__image',
    itemLink: '.lineItemCardInfo__content .details a',
    
    // Quantity and price
    quantityValue: '.quantity__value span.sh-bold',
    quantityAvailable: '.quantity__value',
    itemPriceValue: '.soldPrice__value',
    itemTotalValue: '.total__value',
    
    // Item ID text
    itemIdText: '.lineItemCardInfo__itemId span.sh-secondary:last-child',
    skuText: '.lineItemCardInfo__sku span.sh-secondary:last-child',
    
    // Tracking
    trackingContainer: '.lineItemCardInfo__tracking',
    addTrackingButton: '.tracking-info button.edit-link',
    
    // Order header info
    orderStatus: '.order-status',
    orderDate: '.order-date'
};
