import { pageArgs } from '@packages/utils/api';
import { trustedCartItems, trustedDiscount, shippingQuote } from './checkout-quote';
import { STORE_CURRENCY, usdCents } from '@packages/utils/money';
import { NotFoundError, ValidationError } from "@packages/error-handler";
import prisma from "@packages/libs/prisma";
import redis from "@packages/libs/redis";
import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import Stripe from "stripe";

import { sendBehaviorLog } from "@packages/utils/logs/behavior-log";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-08-26.dahlia",
});

// Create payment intent
export const createPaymentIntent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { sessionId } = req.body;
    if (typeof sessionId !== "string" || !sessionId) {
      return next(new ValidationError("Payment session is required."));
    }

    const sessionData = await redis.get(`payment-session:${sessionId}`);
    if (!sessionData) {
      return next(new ValidationError("Payment session has expired."));
    }

    const session = JSON.parse(sessionData);
    if (session.userId !== req.user!.id) {
      return next(
        new ValidationError("Payment session does not belong to you."),
      );
    }

    const customerAmount = usdCents(session.totalAmount);
    if (!Number.isSafeInteger(customerAmount) || customerAmount <= 0) {
      return next(new ValidationError("Payment amount is invalid."));
    }
    const platformFee = Math.floor(customerAmount * 0.1);

    const intentData: Stripe.PaymentIntentCreateParams = {
      amount: customerAmount,
      currency: STORE_CURRENCY,
      payment_method_types: ["card"],
      metadata: {
        sessionId,
        userId: req.user!.id,
      },
    };

    // Only split payment if seller has a connected Stripe account
    const sellerAccountIds = session.seller
      .map((seller: { stripeAccountId?: string }) => seller.stripeAccountId)
      .filter((accountId: string | undefined): accountId is string =>
        Boolean(accountId?.startsWith("acct_")),
      );

    if (sellerAccountIds.length === 1 && session.seller.length === 1) {
      intentData.application_fee_amount = platformFee;
      intentData.transfer_data = { destination: sellerAccountIds[0] };
    }

    const paymentIntent = await stripe.paymentIntents.create(intentData, { idempotencyKey: `checkout-${sessionId}` });
    const savedSession = await prisma.paymentSession.findUnique({ where: { id: sessionId } });
    if (!savedSession || savedSession.userId !== req.user!.id) throw new ValidationError('Payment session unavailable');
    await prisma.paymentSession.update({ where: { id: sessionId }, data: { payload: { ...(savedSession.payload as any), paymentIntentId: paymentIntent.id } } });
    await sendBehaviorLog("paymentAttempt", {
      type: "info",
      source: "order-service",
      message: "Payment attempt created",
      metadata: {
        userId: req.user!.id,
        paymentIntentId: paymentIntent.id,
        amount: customerAmount / 100,
      },
    });
    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    return next(error);
  }
};

// Create payment session
export const createPaymentSession = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { cart, selectedAddressId, coupon } = req.body;
    const userId = req.user!.id;

    const trustedCart = await trustedCartItems(cart);

    let shippingAddress: any;
    if (!selectedAddressId) return next(new ValidationError("Choose a shipping address."));
    if (selectedAddressId) {
      const address = await prisma.address.findFirst({
        where: { id: selectedAddressId, userId },
        select: { id: true, name: true, street: true, city: true, zip: true, country: true, label: true },
      });
      shippingAddress = address;
      if (!address) {
        return next(new ValidationError("Shipping address is invalid."));
      }
    }

    // Fetch all seller and their stripe account
    const uniqueShopIds = [
      ...new Set(trustedCart.map((item: any) => item.shopId)),
    ];

    const shops = await prisma.shops.findMany({
      where: {
        id: {
          in: uniqueShopIds,
        },
      },
      select: {
        id: true,
        sellerId: true,
        sellers: {
          select: {
            stripe_id: true,
          },
        },
      },
    });

    const sellerData = shops.map((shop) => ({
      shopId: shop.id,
      sellerId: shop.sellerId,
      stripeAccountId: shop?.sellers?.stripe_id,
    }));

    const subTotal = trustedCart.reduce((sum, item) => sum + usdCents(item.sale_price) * item.quantity, 0) / 100;
    const trustedCoupon = await trustedDiscount(trustedCart, coupon?.code || coupon?.couponCode || coupon?.discountCode);
    const shippingByShop = shippingQuote(uniqueShopIds);
    const shippingFee = Object.values(shippingByShop).reduce((sum, fee) => sum + usdCents(fee), 0) / 100;
    const totalAmount = (usdCents(subTotal) - usdCents(trustedCoupon?.discountAmount || 0) + usdCents(shippingFee)) / 100;
    if (totalAmount <= 0) throw new ValidationError('Order total must be positive');
    // Create session payload
    const sessionId = crypto.randomUUID();

    const sessionData = {
      userId,
      cart: trustedCart,
      seller: sellerData,
      totalAmount,
      subTotal, shippingFee, shippingByShop, currency: STORE_CURRENCY,
      shippingAddressId: selectedAddressId || null,
      coupon: trustedCoupon,
      shippingAddress,
    };

    await prisma.paymentSession.create({ data: { id: sessionId, userId, payload: sessionData, expiresAt: new Date(Date.now() + 600000) } });
    await redis.setex(
      `payment-session:${sessionId}`,
      600, // 10 minutes
      JSON.stringify(sessionData),
    );

    return res.status(200).json({ sessionId });
  } catch (error) {
    return next(error);
  }
};

// Verifying payment session
export const verifyPaymentSession = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
      return res.status(404).json({ error: "Session ID is required!" });
    }

    // Fetch session from redis
    const sessionKey = `payment-session:${sessionId}`;
    const sessionData = await redis.get(sessionKey);

    if (!sessionData) {
      return res.status(404).json({ error: "Session not found!" });
    }

    const session = JSON.parse(sessionData);
    if (session.userId !== req.user!.id) return res.status(403).json({ message: "Session does not belong to you" });

    return res.status(200).json({
      success: true,
      session,
    });
  } catch (error) {
    return next(error);
  }
};

export { paymentWebhook as createOrder } from "./payment-webhook.controller";

// Get Seller Orders
export const getSellerOrders = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const shop = await prisma.shops.findUnique({
      where: {
        sellerId: req.seller!.id,
      },
    });

    if (!shop) throw new NotFoundError('Seller shop not found');
    // Fetch order for this shop
    const orders = await prisma.orders.findMany({
      where: {
        shopId: shop?.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return res.status(200).json(orders);
  } catch (error) {
    return next(error);
  }
};

// Get orders for the authenticated user
export const getUserOrders = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const orders = await prisma.orders.findMany({
      where: { userId: req.user!.id },
      include: {
        shop: {
          select: { id: true, name: true },
        },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(orders);
  } catch (error) {
    return next(error);
  }
};

// Get single order by ID (authenticated user)
export const getOrderById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { orderId } = req.params;

    if (!orderId || typeof orderId !== "string") {
      return next(new ValidationError("Order ID is required."));
    }

    const order = await prisma.orders.findFirst({
      where: { id: orderId, userId: req.user!.id },
      include: {
        shop: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              select: { id: true, title: true, images: true },
            },
          },
        },
      },
    });

    if (!order) {
      return next(new NotFoundError("Order not found."));
    }

    return res.status(200).json({ order });
  } catch (error) {
    return next(error);
  }
};

// Keep the legacy export on the same validated lifecycle path.
export { sellerOrderStatus as updateOrderStatus } from './order-management.controller';

// Verify coupon code
export const verifyConponCode = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { couponCode, cart } = req.body;

    if (!couponCode) throw new ValidationError('Coupon code is required');
    const items = await trustedCartItems(cart);
    const discount = await trustedDiscount(items, couponCode);
    res.json({ valid: true, discount: discount!.discountValue, discountAmount: discount!.discountAmount, discountProductId: discount!.discountedProductId, discountLineKey: discount!.discountedLineKey, discountType: discount!.discountType });
  } catch (error) {
    return next(error);
  }
};

// Get admin order
export const getAdminOrders = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const orders = await prisma.orders.findMany({
      ...pageArgs(req.query),
      include: {
        user: { select: { id: true, name: true, email: true } },
        shop: { select: { id: true, name: true } },
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    next(error);
  }
};

