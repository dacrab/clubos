import { SaleWithDetails, GroupedSale } from "@/types/sales";
import { STATISTICS, CARD_DISCOUNT } from "@/lib/constants";

// Types
export type ChartDataItem = {
  name: string;
  value: number;
  total: number;
  percentage?: string;
};

// Constants
export const CHART_STYLES = {
  colors: {
    primary: 'hsl(var(--primary))',
    green: 'hsl(142.1 76.2% 36.3%)',
    yellow: 'hsl(47.9 95.8% 53.1%)',
    red: 'hsl(0 84.2% 60.2%)',
    blue: 'hsl(217.2 91.2% 59.8%)'
  },
  tooltip: {
    background: 'hsl(var(--background))',
    border: 'hsl(var(--border))',
    text: 'hsl(var(--foreground))',
    textMuted: 'hsl(var(--muted-foreground))'
  },
  grid: {
    stroke: 'hsl(var(--border))'
  },
  axis: {
    stroke: 'hsl(var(--muted-foreground))',
    fontSize: 12
  }
} as const;

export const MEDAL_COLORS = {
  0: "text-yellow-500", // Gold
  1: "text-gray-400",   // Silver
  2: "text-amber-600",  // Bronze
  default: "text-muted-foreground"
} as const;

// Date-related functions
/**
 * Filters sales by date range
 */
export function filterSalesByDateRange(
  sales: SaleWithDetails[], 
  dateRange: { startDate: string | null; endDate: string | null } | null
): SaleWithDetails[] {
  // First filter out deleted sales
  const activeSales = sales.filter(sale => !sale.is_deleted);
  
  if (!dateRange?.startDate || !dateRange?.endDate) return activeSales;

  return activeSales.filter(sale => {
    const saleDate = new Date(sale.created_at);
    const startDate = new Date(dateRange.startDate!);
    const endDate = new Date(dateRange.endDate!);
    endDate.setHours(23, 59, 59, 999); // Include the entire end day

    return saleDate >= startDate && saleDate <= endDate;
  });
}

/**
 * Groups sales by date and aggregates quantities
 */
export function aggregateSalesByDate(
  sales: SaleWithDetails[], 
  valueKey: 'quantity' | 'total_price'
): Array<{ date: string; revenue?: number; quantity?: number }> {
  // Filter out deleted sales
  const activeSales = sales.filter(sale => !sale.is_deleted);
  
  const aggregated = activeSales.reduce((acc, sale) => {
    const date = new Date(sale.created_at).toLocaleDateString('el');
    // Only include non-treat sales in the aggregation
    if (!sale.is_treat) {
      // Use exact precision for monetary values
      if (valueKey === 'total_price') {
        acc[date] = +((acc[date] || 0) + sale[valueKey]).toFixed(2);
      } else {
        acc[date] = (acc[date] || 0) + sale[valueKey];
      }
    }
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(aggregated)
    .map(([date, value]) => ({ 
      date, 
      [valueKey === 'total_price' ? 'revenue' : 'quantity']: value 
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-STATISTICS.DEFAULT_DAYS_TO_SHOW);
}

/**
 * Groups sales by product and aggregates quantities
 */
export function aggregateSalesByProduct(
  sales: SaleWithDetails[],
  topCount: number = STATISTICS.DEFAULT_TOP_PRODUCTS_COUNT,
  showAll: boolean = false
): ChartDataItem[] {
  // Filter out deleted sales
  const activeSales = sales.filter(sale => !sale.is_deleted);
  
  // Group sales by product, excluding treats
  const productSales = activeSales.reduce((acc, sale) => {
    if (!sale.product?.name || sale.is_treat) return acc;
    
    const productName = sale.product.name;
    if (!acc[productName]) {
      acc[productName] = { name: productName, value: 0, total: 0 };
    }
    acc[productName].value += sale.quantity;
    acc[productName].total += sale.total_price;
    return acc;
  }, {} as Record<string, ChartDataItem>);

  // Sort and slice data
  const sortedData = Object.values(productSales)
    .sort((a, b) => b.value - a.value)
    .slice(0, showAll ? undefined : topCount);

  // Calculate percentages
  const total = sortedData.reduce((sum, item) => sum + item.value, 0);
  return sortedData.map(item => ({
    ...item,
    percentage: ((item.value / total) * 100).toFixed(1)
  }));
}

/**
 * Aggregates sales by category and aggregates quantities
 */
export function aggregateSalesByCategory(
  sales: SaleWithDetails[],
  categoryName: string
): ChartDataItem[] {
  if (!categoryName) return [];

  // Filter out deleted sales
  const activeSales = sales.filter(sale => !sale.is_deleted);

  const salesByItem = activeSales.reduce((acc, sale) => {
    if (sale.product?.category?.name === categoryName && !sale.is_treat) {
      const itemName = sale.product.name;
      if (!acc[itemName]) {
        acc[itemName] = { name: itemName, value: 0, total: 0 };
      }
      acc[itemName].value += sale.quantity;
      acc[itemName].total += sale.total_price;
    }
    return acc;
  }, {} as Record<string, ChartDataItem>);

  return Object.values(salesByItem)
    .sort((a, b) => b.value - a.value)
    .slice(0, STATISTICS.DEFAULT_TOP_PRODUCTS_COUNT);
}

/**
 * Calculates various sales statistics consistent with RegisterClosingsList and ClosingDetails
 */
export function calculateSalesStats(sales: SaleWithDetails[]) {
  // Filter out deleted sales
  const activeSales = sales.filter(sale => !sale.is_deleted);
  
  // Group sales by payment method and treat status
  const nonTreatSales = activeSales.filter(s => !s.is_treat);
  const treatSales = activeSales.filter(s => s.is_treat);
  
  // Group sales by payment type based on order's card discount count
  const cashSales = activeSales.filter(s => !s.is_treat && (!s.order?.card_discount_count || s.order.card_discount_count === 0));
  const cardSales = activeSales.filter(s => !s.is_treat && s.order?.card_discount_count && s.order.card_discount_count > 0);
  
  // Calculate card discount based on order data
  // We need to count each order's card_discount_count only once to avoid duplicates
  const uniqueOrders = Array.from(new Set(cardSales.map(s => s.order?.id)))
    .map(id => cardSales.find(s => s.order?.id === id)?.order)
    .filter(Boolean);
  
  const cardDiscountCount = uniqueOrders.reduce((sum, order) => 
    sum + (order?.card_discount_count || 0), 0);
  // Use exact precision for card discount amount
  const cardDiscountAmount = +(cardDiscountCount * CARD_DISCOUNT).toFixed(2);
  
  // Calculate treat value (actual monetary value of treats) with exact precision
  const treatsAmount = +(treatSales.reduce((sum, sale) => 
    sum + +(sale.unit_price * sale.quantity).toFixed(2), 0)).toFixed(2);
  
  // Calculate final amounts after discounts with exact precision
  const totalBeforeDiscounts = +(nonTreatSales.reduce((sum, sale) => 
    sum + sale.total_price, 0)).toFixed(2);
  
  // Calculate cash and card revenues with exact precision
  const cashRevenue = +(cashSales.reduce((sum, sale) => sum + sale.total_price, 0)).toFixed(2);
  
  // We need to pro-rate the discount across all items in an order
  // First, group card sales by order
  const salesByOrder = cardSales.reduce((acc, sale) => {
    const orderId = sale.order?.id || 'unknown';
    if (!acc[orderId]) acc[orderId] = [];
    acc[orderId].push(sale);
    return acc;
  }, {} as Record<string, SaleWithDetails[]>);
  
  // Then calculate the revenue for each order with proper discount distribution and exact precision
  const cardRevenue = +(Object.values(salesByOrder).reduce((totalRevenue, orderSales) => {
    // Skip if there are no sales or first sale has no order
    if (!orderSales.length || !orderSales[0].order) return totalRevenue;
    
    const order = orderSales[0].order;
    const orderTotal = +(orderSales.reduce((sum, sale) => sum + sale.total_price, 0)).toFixed(2);
    const orderDiscount = +(order.card_discount_count * CARD_DISCOUNT).toFixed(2);
    
    // Apply the discount proportionally to the order total with exact precision
    const orderRevenue = Math.max(0, +(orderTotal - orderDiscount).toFixed(2));
    return +(totalRevenue + orderRevenue).toFixed(2);
  }, 0)).toFixed(2);
  
  // Calculate final total with exact precision
  const finalTotalAmount = +(cashRevenue + cardRevenue).toFixed(2);
  
  return {
    // Sales quantities
    totalSales: nonTreatSales.reduce((sum, sale) => sum + sale.quantity, 0),
    cashSalesCount: cashSales.reduce((sum, sale) => sum + sale.quantity, 0),
    cardSalesCount: cardSales.reduce((sum, sale) => sum + sale.quantity, 0),
    treatCount: treatSales.reduce((sum, sale) => sum + sale.quantity, 0),
    
    // Revenue figures
    totalBeforeDiscounts,
    cardDiscountCount,
    cardDiscountAmount,
    treatsAmount,
    
    // Final amounts
    totalRevenue: finalTotalAmount,
    cashRevenue,
    cardRevenue,
    
    // Order-level stats
    uniqueProducts: new Set(activeSales.map(sale => sale.product_id)).size,
    totalOrders: uniqueOrders.length,
    averageOrderValue: uniqueOrders.length ? finalTotalAmount / uniqueOrders.length : 0
  };
}

/**
 * Calculates the "net" sales by removing treats before chart aggregation
 * This ensures that charts for revenue and quantity reflect actual sales, not giveaways
 */
export function calculateNetSales(sales: SaleWithDetails[]): SaleWithDetails[] {
  return sales.filter(sale => !sale.is_treat);
}

/**
 * Get total items from sales, excluding treats
 */
export function getTotalItems(sales: SaleWithDetails[]): number {
  return sales.filter(sale => !sale.is_treat)
    .reduce((sum, sale) => sum + sale.quantity, 0);
}