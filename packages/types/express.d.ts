import { Users, Sellers, Shop } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: Users;
      seller?: Sellers & { shop?: Shop | null };
      role?: "user" | "seller";
    }
  }
}
