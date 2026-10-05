"use client";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import useSeller from "apps/seller-ui/src/hooks/useSeller";
import axios from "apps/seller-ui/src/utils/axioInstance";

interface Notification { id: string; title: string; message: string; isRead: boolean }
export default function SellerNotificationToasts() {
  const { seller } = useSeller();
  const seen = useRef<{ sellerId: string; ids: Set<string> } | null>(null);
  const { data } = useQuery<{ notifications: Notification[] }>({
    queryKey: ["seller-notifications", seller?.id],
    queryFn: async () => (await axios.get("/product/api/get-seller-notifications")).data,
    enabled: !!seller?.id,
    refetchInterval: 30_000,
  });
  useEffect(() => {
    if (!seller?.id || !data) return;
    // The first response is history, not newly arriving notifications.
    if (!seen.current || seen.current.sellerId !== seller.id) {
      seen.current = { sellerId: seller.id, ids: new Set(data.notifications.map(item => item.id)) };
      return;
    }
    for (const item of [...data.notifications].reverse()) {
      if (!seen.current.ids.has(item.id) && !item.isRead) {
        toast(<div><p className="font-semibold">{item.title}</p><p className="text-sm">{item.message}</p></div>, {
          id: `seller-notification-${item.id}`, duration: 6000,
        });
      }
      seen.current.ids.add(item.id);
    }
  }, [data, seller?.id]);
  return null;
}
