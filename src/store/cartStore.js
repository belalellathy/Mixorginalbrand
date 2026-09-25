import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCartStore = create(
  persist(
    (set, get) => ({
      cartItems: [],
      totalPrice: 0,
      totalItems: 0,

      addToCart: (product, quantity = 1) => {
        if (!product || quantity <= 0) return;
        const stock = typeof product.stock === 'number' ? product.stock : Infinity;
        const { cartItems } = get();
        const existingIndex = cartItems.findIndex((item) => item.product.id === product.id);

        let updatedItems;
        if (existingIndex > -1) {
          updatedItems = cartItems.map((item, index) =>
            index === existingIndex
              ? { ...item, quantity: Math.min(item.quantity + quantity, stock) }
              : item
          );
        } else {
          updatedItems = [...cartItems, { product, quantity: Math.min(quantity, stock) }];
        }

        const totalItems = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = Number(
          updatedItems
            .reduce((sum, item) => sum + item.quantity * Number(item.product.price), 0)
            .toFixed(2)
        );

        set({ cartItems: updatedItems, totalItems, totalPrice });
      },

      removeFromCart: (productId) => {
        const { cartItems } = get();
        const updatedItems = cartItems.filter((item) => item.product.id !== productId);

        const totalItems = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = Number(
          updatedItems
            .reduce((sum, item) => sum + item.quantity * Number(item.product.price), 0)
            .toFixed(2)
        );

        set({ cartItems: updatedItems, totalItems, totalPrice });
      },

      updateQuantity: (productId, quantity, maxStock) => {
        const { cartItems } = get();
        let updatedItems;

        if (typeof maxStock === 'number' && quantity > maxStock) return;

        if (quantity <= 0) {
          updatedItems = cartItems.filter((item) => item.product.id !== productId);
        } else {
          updatedItems = cartItems.map((item) =>
            item.product.id === productId ? { ...item, quantity } : item
          );
        }

        const totalItems = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = Number(
          updatedItems
            .reduce((sum, item) => sum + item.quantity * Number(item.product.price), 0)
            .toFixed(2)
        );

        set({ cartItems: updatedItems, totalItems, totalPrice });
      },

      clearCart: () => {
        set({ cartItems: [], totalItems: 0, totalPrice: 0 });
      },
    }),
    {
      name: 'leclat-beauty-cart',
    }
  )
);
