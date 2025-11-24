// lib/orders.ts
import api from "./api";
import { getToken } from "./authService";

export interface OrderLine {
  code: string;
  article: string;
  description: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: number;
  usercode: string;       // matches backend response
  sum: number;
  created_at: string;     // ISO datetime
  items_json: string;     // JSON string of OrderLine[]
}

export const PAGE_SIZE = 100;

/**
 * Create a new order.
 * Pass `items` as an array of OrderLine.
 * NOTE: Backend expects { sum, items } (not items_json in the request).
 */
export async function createOrder(
  items: OrderLine[],
  sum: number
): Promise<Order> {
  const token = await getToken();
  const payload = { sum, items };
  const res = await api.post<Order>("/orders/", payload, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return res.data;
}

/**
 * List recent orders for the current user.
 * Defaults to 100; adjust by passing a custom limit if needed.
 */
export async function listOrders(limit: number = PAGE_SIZE): Promise<Order[]> {
  const token = await getToken();
  const res = await api.get<Order[]>("/orders/", {
    params: { limit },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return res.data;
}

/**
 * Load older orders using paging (offset + limit).
 * Use with a "Load older" button; each call fetches the next 100 by default.
 */
export async function listOrdersPage(
  offset: number,
  limit: number = PAGE_SIZE
): Promise<Order[]> {
  const token = await getToken();
  const res = await api.get<Order[]>("/orders/", {
    params: { offset, limit },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return res.data;
}

/**
 * Get a single order by ID.
 */
export async function getOrderById(orderId: number): Promise<Order> {
  const token = await getToken();
  const res = await api.get<Order>(`/orders/${orderId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return res.data;
}
