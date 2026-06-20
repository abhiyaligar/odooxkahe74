/**
 * Aggregates order statuses across Sales, Purchase, and Manufacturing orders
 * into a unified breakdown for chart display.
 *
 * @param {Object} orders
 * @param {Array} orders.salesOrders       - Array of SalesOrder objects with `status` field
 * @param {Array} orders.purchaseOrders    - Array of PurchaseOrder objects with `status` field
 * @param {Array} orders.manufacturingOrders - Array of ManufacturingOrder objects with `status` field
 * @returns {Array<{name: string, value: number, color: string}>}
 *   Sorted breakdown entries. Zero-count buckets are omitted.
 */
export function getOrderStatusBreakdown({ salesOrders = [], purchaseOrders = [], manufacturingOrders = [] }) {
  const buckets = {
    Draft: 0,
    "In Progress": 0,
    Completed: 0,
    Cancelled: 0,
  };

  // --- Sales Orders ---
  salesOrders.forEach((o) => {
    switch (o.status) {
      case "Draft":
        buckets.Draft++;
        break;
      case "Confirmed":
      case "PartiallyDelivered":
        buckets["In Progress"]++;
        break;
      case "FullyDelivered":
        buckets.Completed++;
        break;
      case "Cancelled":
        buckets.Cancelled++;
        break;
      default:
        break;
    }
  });

  // --- Purchase Orders ---
  purchaseOrders.forEach((o) => {
    switch (o.status) {
      case "Draft":
        buckets.Draft++;
        break;
      case "Confirmed":
      case "PartiallyReceived":
        buckets["In Progress"]++;
        break;
      case "FullyReceived":
        buckets.Completed++;
        break;
      case "Cancelled":
        buckets.Cancelled++;
        break;
      default:
        break;
    }
  });

  // --- Manufacturing Orders ---
  manufacturingOrders.forEach((o) => {
    switch (o.status) {
      case "Draft":
        buckets.Draft++;
        break;
      case "InProgress":
        buckets["In Progress"]++;
        break;
      case "Completed":
        buckets.Completed++;
        break;
      case "Cancelled":
        buckets.Cancelled++;
        break;
      default:
        break;
    }
  });

  // Color mapping using the project's semantic status palette
  const colorMap = {
    Draft: "var(--muted-foreground)",
    "In Progress": "var(--color-warning)",
    Completed: "var(--color-success)",
    Cancelled: "var(--color-danger)",
  };

  // Build result array, omitting any bucket with count === 0
  return Object.entries(buckets)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({
      name,
      value,
      color: colorMap[name],
    }));
}
