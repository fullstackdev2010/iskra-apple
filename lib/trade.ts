// lib/trade.ts
import api from './api';
import { API_HOST } from "../lib/constants";

// 🔥 global discount sync
import { getMe } from "./auth";
import { getGlobalContext } from "../context/GlobalProvider";

async function refreshUserDiscountsIfNeeded() {
  try {
    const ctx = getGlobalContext();
    if (!ctx) return;                      // context not ready yet (initial boot)

    const oldUser = ctx.user;
    const freshUser = await getMe({ bustCache: true });

    if (
      freshUser &&
      (freshUser.discount !== oldUser?.discount ||
       freshUser.discount2 !== oldUser?.discount2)
    ) ctx.setUser(freshUser);

  } catch {}
}

export interface TradeItemOut {
  id: number;
  code: string;
  article: string;
  description?: string;
  stock: string;
  price: number;
  price2?: number;
  picture?: string;
}

// 1. Hierarchy endpoints
export async function getHierarchyByCodeItems(field: string, value: string): Promise<TradeItemOut[]> {
  await refreshUserDiscountsIfNeeded();  // 🔥 ensure discounts are updated
  const res = await api.get<TradeItemOut[]>('/trade/hierarchy/items', { params: { [field]: value } });
  return res.data;
}

export async function getHierarchyByCodeTools(field: string, value: string): Promise<TradeItemOut[]> {
  await refreshUserDiscountsIfNeeded();
  const res = await api.get<TradeItemOut[]>('/trade/hierarchy/tools', { params: { [field]: value } });
  return res.data;
}

export async function getCombinedHierarchyByCodeParts(field: string, value: string): Promise<TradeItemOut[]> {
  await refreshUserDiscountsIfNeeded();
  const res = await api.get<TradeItemOut[]>('/trade/hierarchy/parts', { params: { [field]: value } });
  return res.data;
}

// 2. Item listings by code
async function fetchTradeItems(kind: string, code: string) {
  await refreshUserDiscountsIfNeeded();   // 🔥 global sync

  const base = `${API_HOST}/trade/hierarchy/${kind}`;
  const byParentUrl = `${base}?parentId=${encodeURIComponent(code)}`;
  const byParentResponse = await fetch(byParentUrl);

  const errorText = await byParentResponse.text();
  if (!byParentResponse.ok) throw new Error(`trade fetch failed: ${byParentResponse.status} ${errorText}`);

  return JSON.parse(errorText);
}

export const fetchItemsByCode = (code: string) => fetchTradeItems('items', code);
export const fetchToolsByCode = (code: string) => fetchTradeItems('tools', code);
export const fetchPartsByCode = (code: string) => fetchTradeItems('parts', code);

export async function getTradeItemsByCodeItems(field: string, value: string): Promise<TradeItemOut[]> {
  await refreshUserDiscountsIfNeeded();
  const res = await api.get<TradeItemOut[]>('/trade/items', { params: { [field]: value } });
  return res.data;
}

export async function getTradeItemsByCodeTools(field: string, value: string): Promise<TradeItemOut[]> {
  await refreshUserDiscountsIfNeeded();
  const res = await api.get<TradeItemOut[]>('/trade/tools', { params: { [field]: value } });
  return res.data;
}

export async function getCombinedTradeItemsByCodeParts(field: string, value: string): Promise<TradeItemOut[]> {
  await refreshUserDiscountsIfNeeded();
  const res = await api.get<TradeItemOut[]>('/trade/parts', { params: { [field]: value } });
  return res.data;
}

export async function searchTradeItemsItems(query: string): Promise<TradeItemOut[]> {
  await refreshUserDiscountsIfNeeded();   // 🔥 search paths too
  const res = await api.get('/trade/search/items', { params: { q: query } });
  return res.data;
}

export async function searchTradeItemsTools(query: string): Promise<TradeItemOut[]> {
  await refreshUserDiscountsIfNeeded();
  const res = await api.get('/trade/search/tools', { params: { q: query } });
  return res.data;
}

export async function searchCombinedTradeItemsParts(query: string): Promise<TradeItemOut[]> {
  await refreshUserDiscountsIfNeeded();
  const res = await api.get('/trade/search/parts', { params: { q: query } });
  return res.data;
}

export async function searchTradeItems(catalog: string, query: string): Promise<TradeItemOut[]> {
  await refreshUserDiscountsIfNeeded();
  const cat = catalog.toLowerCase();
  if (cat === 'items' || cat === 'electro') return searchTradeItemsItems(query);
  if (cat === 'tools' || cat === 'handtools') return searchTradeItemsTools(query);
  if (cat === 'parts') return searchCombinedTradeItemsParts(query);
  throw new Error(`Не поддерживаемый каталог: ${catalog}`);
}
