import { users, sellers, shops } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: users;
      seller?: sellers & { shop?: shops | null };
      role?: "user" | "seller" | "admin";
    }
  }
}
