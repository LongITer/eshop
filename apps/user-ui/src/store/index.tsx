import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  id: string;
  title: string;
  price: number;
  quantity?: number;
  images?: string[];
  [key: string]: any;
};

export type WishlistItem = {
  id: string;
  title: string;
  price: number;
  images?: string[];
  [key: string]: any;
};

type Store = {
  cart: CartItem[];
  wishlist: WishlistItem[];

  addToCart: (
    product: CartItem,
    user: any,
    location: string,
    deviceInfo: string,
  ) => void;

  removeFromCart: (
    id: string,
    user: any,
    location: string,
    deviceInfo: string,
  ) => void;

  addToWishlist: (
    product: WishlistItem,
    user: any,
    location: string,
    deviceInfo: string,
  ) => void;

  removeFromWishlist: (
    id: string,
    user: any,
    location: string,
    deviceInfo: string,
  ) => void;
};

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      cart: [],
      wishlist: [],

      // Add to Cart
      addToCart: (product, user, location, deviceInfo) => {
        set((state) => {
          const existing = state.cart?.find((item) => item.id === product.id);
          if (existing) {
            return {
              cart: state.cart.map((item) =>
                item.id === product.id
                  ? { ...item, quantity: (item.quantity ?? 1) + 1 }
                  : item,
              ),
            };
          }
          return {
            cart: [...state.cart, { ...product, quantity: 1 }],
          };
        });
      },

      // Remove from Cart
      removeFromCart: (id, user, location, deviceInfo) => {
        const removeProduct = get().cart.find((item) => item.id === id);
        set((state) => ({
          cart: state.cart?.filter((item) => item.id !== id),
        }));
      },

      // Add to wishlist
      addToWishlist: (product, user, location, deviceInfo) => {
        set((state) => {
          if (state.wishlist.find((item) => item.id === product.id))
            return state;
          return {
            wishlist: [...state.wishlist, product],
          };
        });
      },

      // Remove from wishlist
      removeFromWishlist: (id, user, location, deviceInfo) => {
        const removeProduct = get().wishlist.find((item) => item.id === id);
        set((state) => ({
          wishlist: state.wishlist.filter((item) => item.id !== id),
        }));
      },
    }),
    { name: "store-storage" },
  ),
);
