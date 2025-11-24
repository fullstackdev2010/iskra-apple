// app/store/cartStore.tsx
import { create } from 'zustand';

interface CartItem {
  code: string;
  article: string;
  description: string;
  price: number;
  quantity: number;
  stock: string;
  picture?: string;
}

interface CartState {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (code: string) => void;
  updateQuantity: (code: string, quantity: number) => void;
  incrementQuantity: (code: string) => void;
  decrementQuantity: (code: string) => void;
  clearCart: () => void;
  total: number;
  cartCount: number;
}

function parseStockLimit(stock: string): number {
  if (!stock) return 0;
  const n = parseInt(stock);
  if (!isNaN(n)) return n;
  if (stock === '>10') return 100;
  if (stock === '>100') return 200;
  if (stock.toLowerCase() === 'много') return 300;
  return 0;
}

const useCartStore = create<CartState>((set) => ({
  cart: [],
  total: 0,
  cartCount: 0,

  addToCart: (item: CartItem) => set((state) => {
    // Single line per SKU — merge by code only
    const existingItem = state.cart.find((cartItem) => cartItem.code === item.code);
    let updatedCart;

    if (existingItem) {
      const maxQty = parseStockLimit(existingItem.stock);
      const nextQty = Math.min(existingItem.quantity + 1, maxQty);
      // Keep existing price; user cannot mix prices for the same SKU
      updatedCart = state.cart.map((cartItem) =>
        cartItem.code === item.code
          ? { ...cartItem, quantity: nextQty }
          : cartItem
      );
    } else {
      updatedCart = [...state.cart, { ...item, quantity: 1 }];
    }

    return {
      cart: updatedCart,
      total: updatedCart.reduce((sum, cartItem) => sum + cartItem.price * cartItem.quantity, 0),
      cartCount: updatedCart.reduce((sum, cartItem) => sum + cartItem.quantity, 0),
    };
  }),

  removeFromCart: (code: string) => set((state) => {
    const updatedCart = state.cart.filter((item) => item.code !== code);
    return {
      cart: updatedCart,
      total: updatedCart.reduce((sum, item) => sum + item.price * item.quantity, 0),
      cartCount: updatedCart.reduce((sum, item) => sum + item.quantity, 0),
    };
  }),

  updateQuantity: (code: string, quantity: number) => set((state) => {
    const updatedCart = state.cart.map((item) => {
      if (item.code === code) {
        const maxQty = parseStockLimit(item.stock);
        return { ...item, quantity: Math.min(quantity, maxQty) };
      }
      return item;
    });
    return {
      cart: updatedCart,
      total: updatedCart.reduce((sum, item) => sum + item.price * item.quantity, 0),
      cartCount: updatedCart.reduce((sum, item) => sum + item.quantity, 0),
    };
  }),

  incrementQuantity: (code: string) => set((state) => {
    const updatedCart = state.cart.map((item) => {
      if (item.code === code) {
        const maxQty = parseStockLimit(item.stock);
        const nextQty = Math.min(item.quantity + 1, maxQty);
        return { ...item, quantity: nextQty };
      }
      return item;
    });
    return {
      cart: updatedCart,
      total: updatedCart.reduce((sum, item) => sum + item.price * item.quantity, 0),
      cartCount: updatedCart.reduce((sum, item) => sum + item.quantity, 0),
    };
  }),

  decrementQuantity: (code: string) => set((state) => {
    const updatedCart = state.cart.map((item) =>
      item.code === code && item.quantity > 1
        ? { ...item, quantity: item.quantity - 1 }
        : item
    );
    return {
      cart: updatedCart,
      total: updatedCart.reduce((sum, item) => sum + item.price * item.quantity, 0),
      cartCount: updatedCart.reduce((sum, item) => sum + item.quantity, 0),
    };
  }),

  clearCart: () => set({ cart: [], total: 0, cartCount: 0 }),
}));

export default useCartStore;
