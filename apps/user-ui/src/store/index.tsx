import { create } from "zustand";
import { persist } from "zustand/middleware";

// Helper to send tracking events to the server-side Kafka producer
const sendKafkaEvent = async (eventData: Record<string, any>) => {
  try {
    await fetch("/api/track-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventData),
    });
  } catch (error) {
    console.error("Failed to send tracking event:", error);
  }
};

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

type Location = {
  country: string;
  city: string;
} | null;

type Store = {
  cart: CartItem[];
  wishlist: WishlistItem[];

  addToCart: (
    product: CartItem,
    user: any,
    location: Location,
    deviceInfo: string,
  ) => void;

  removeFromCart: (
    id: string,
    user: any,
    location: Location,
    deviceInfo: string,
  ) => void;

  addToWishlist: (
    product: WishlistItem,
    user: any,
    location: Location,
    deviceInfo: string,
  ) => void;

  removeFromWishlist: (
    id: string,
    user: any,
    location: Location,
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

        // Send kafka event
        if (user?.id && location && deviceInfo) {
          sendKafkaEvent({
            userId: user.id,
            productId: product.id,
            shopId: product.shopId,
            action: "add_to_cart",
            country: location?.country || "Unknown",
            city: location?.city || "Unknown",
            device: deviceInfo || "Unknown Device",
          });
        }
      },

      // Remove from Cart
      removeFromCart: (id, user, location, deviceInfo) => {
        const removeProduct = get().cart.find((item) => item.id === id);
        set((state) => ({
          cart: state.cart?.filter((item) => item.id !== id),
        }));

        // Send kafka event
        if (user?.id && location && deviceInfo && removeProduct) {
          sendKafkaEvent({
            userId: user.id,
            productId: removeProduct.id,
            shopId: removeProduct.shopId,
            action: "remove_from_cart",
            country: location?.country || "Unknown",
            city: location?.city || "Unknown",
            device: deviceInfo || "Unknown Device",
          });
        }
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

        // Send kafka event
        if (user?.id && location && deviceInfo) {
          sendKafkaEvent({
            userId: user.id,
            productId: product.id,
            shopId: product.shopId,
            action: "add_to_wishlist",
            country: location?.country || "Unknown",
            city: location?.city || "Unknown",
            device: deviceInfo || "Unknown Device",
          });
        }
      },

      // Remove from wishlist
      removeFromWishlist: (id, user, location, deviceInfo) => {
        const removeProduct = get().wishlist.find((item) => item.id === id);
        set((state) => ({
          wishlist: state.wishlist.filter((item) => item.id !== id),
        }));

        // Send kafka event
        if (user?.id && location && deviceInfo && removeProduct) {
          sendKafkaEvent({
            userId: user.id,
            productId: removeProduct.id,
            shopId: removeProduct.shopId,
            action: "remove_from_wishlist",
            country: location?.country || "Unknown",
            city: location?.city || "Unknown",
            device: deviceInfo || "Unknown Device",
          });
        }
      },
    }),
    { name: "store-storage" },
  ),
);
