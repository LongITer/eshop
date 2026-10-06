import { NotFoundError, ValidationError } from "@packages/error-handler";
import prisma from "@packages/libs/prisma";
import redis from "@packages/libs/redis";
import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import Stripe from "stripe";
import { orderStatus } from "@prisma/client";

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
    if (session.userId !== req.user.id) {
      return next(
        new ValidationError("Payment session does not belong to you."),
      );
    }

    const customerAmount = Math.round(session.totalAmount * 100);
    if (!Number.isSafeInteger(customerAmount) || customerAmount <= 0) {
      return next(new ValidationError("Payment amount is invalid."));
    }
    const platformFee = Math.floor(customerAmount * 0.1);

    const intentData: Stripe.PaymentIntentCreateParams = {
      amount: customerAmount,
      currency: "usd",
      payment_method_types: ["card"],
      metadata: {
        sessionId,
        userId: req.user.id,
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
    await sendBehaviorLog("paymentAttempt", {
      type: "info",
      source: "order-service",
      message: "Payment attempt created",
      metadata: {
        userId: req.user.id,
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
    const userId = req.user.id;

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return next(new ValidationError("Cart is empty or invalid."));
    }

    const requestedItems = cart.map((item: any) => ({
      id: item?.id,
      quantity: Number(item?.quantity),
      selectedOptions: item?.selectedOptions || {},
    }));

    if (
      requestedItems.some(
        (item: any) =>
          typeof item.id !== "string" ||
          !Number.isInteger(item.quantity) ||
          item.quantity <= 0,
      )
    ) {
      return next(new ValidationError("Cart contains invalid items."));
    }

    const productIds = requestedItems.map((item: any) => item.id);
    if (new Set(productIds).size !== productIds.length) {
      return next(new ValidationError("Cart contains duplicate products."));
    }

    const products = await prisma.products.findMany({
      where: { id: { in: productIds }, isDeleted: false, status: "Active" },
      select: {
        id: true,
        title: true,
        sale_price: true,
        stock: true,
        discount_codes: true,
        colors: true,
        sizes: true,
        shopId: true,
        images: { select: { url: true } },
      },
    });
    const productById = new Map(
      products.map((product) => [product.id, product]),
    );
    if (
      products.length !== requestedItems.length ||
      requestedItems.some(
        (item: any) =>
          !productById.has(item.id) ||
          productById.get(item.id)!.stock < item.quantity,
      )
    ) {
      return next(
        new ValidationError("A product is unavailable or out of stock."),
      );
    }

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

    const trustedCart = requestedItems.map((item: any) => {
      const product = productById.get(item.id)!;
      if ((item.selectedOptions.color && !product.colors.includes(item.selectedOptions.color)) || (item.selectedOptions.size && !product.sizes.includes(item.selectedOptions.size))) throw new ValidationError("Invalid product variant");
      return {
        ...item,
        title: product.title,
        sale_price: product.sale_price,
        shopId: product.shopId,
        image: product.images[0]?.url || null,
      };
    });

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

    // Calculate total
    const subTotal = trustedCart.reduce((total: number, item: any) => {
      return total + item.quantity * item.sale_price;
    }, 0);

    let trustedCoupon: any = null;
    if (coupon?.code || coupon?.couponCode || coupon?.discountCode) {
      const code = coupon.code || coupon.couponCode || coupon.discountCode;
      if (typeof code !== 'string') throw new ValidationError('Invalid coupon');
      const record = await prisma.discountCodes.findFirst({ where: { discountCode: code } });
      if (!record) throw new ValidationError('Coupon no longer exists');
      const eligible = trustedCart.find(item => productById.get(item.id)!.discount_codes.includes(record.id));
      if (!eligible) throw new ValidationError('Coupon does not apply to these products');
      const price = eligible.sale_price * eligible.quantity;
      const discountAmount = Math.round(Math.min(price, record.discountType === 'percentage' ? price * record.discountValue / 100 : record.discountValue) * 100) / 100;
      if (discountAmount < 0 || !Number.isFinite(discountAmount)) throw new ValidationError('Invalid coupon amount');
      trustedCoupon = { id: record.id, code, discountAmount, discountedProductId: eligible.id };
    }
    const totalAmount = Math.round((subTotal - (trustedCoupon?.discountAmount || 0)) * 100) / 100;
    if (totalAmount <= 0) throw new ValidationError('Order total must be positive');
    // Create session payload
    const sessionId = crypto.randomUUID();

    const sessionData = {
      userId,
      cart: trustedCart,
      seller: sellerData,
      totalAmount,
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
    if (session.userId !== req.user.id) return res.status(403).json({ message: "Session does not belong to you" });

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
        sellerId: req.seller.id,
      },
    });

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
      where: { userId: req.user.id },
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
      where: { id: orderId, userId: req.user.id },
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

// Update Order Status
export const updateOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!orderId || typeof orderId !== "string") {
      return next(new ValidationError("Order ID is required."));
    }

    if (typeof status !== "string" || !(status in orderStatus)) {
      return next(new ValidationError("Invalid order status."));
    }

    const shop = await prisma.shops.findUnique({
      where: { sellerId: req.seller.id },
      select: { id: true },
    });

    if (!shop) {
      return next(new NotFoundError("Seller shop not found."));
    }

    const existingOrder = await prisma.orders.findFirst({
      where: { id: orderId, shopId: shop.id },
      select: { id: true, status: true },
    });

    if (!existingOrder) {
      return next(new NotFoundError("Order not found."));
    }

    const nextStatus = orderStatus[status as keyof typeof orderStatus];
    const updatedOrder = await prisma.orders.update({
      where: { id: existingOrder.id },
      data: {
        status: nextStatus,
        deliveredAt: nextStatus === orderStatus.Delivered ? new Date() : null,
        cancelledAt: nextStatus === orderStatus.Cancelled ? new Date() : null,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        items: true,
      },
    });

    await sendBehaviorLog("orderStatusChange", {
      type: "info",
      source: "order-service",
      message: "Seller changed order status",
      metadata: {
        sellerId: req.seller.id,
        orderId: updatedOrder.id,
        previousStatus: existingOrder.status,
        status: updatedOrder.status,
      },
    });

    if (nextStatus === orderStatus.Cancelled) {
      await sendBehaviorLog("orderCancelled", {
        type: "warn",
        source: "order-service",
        message: "Order cancelled by seller",
        metadata: { sellerId: req.seller.id, orderId: updatedOrder.id },
      });
    }

    return res.status(200).json(updatedOrder);
  } catch (error) {
    return next(error);
  }
};

// Verify coupon code
export const verifyConponCode = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { couponCode, cart } = req.body;

    if (!couponCode || !cart || cart.length === 0) {
      return next(new ValidationError("Coupon code and cart are required!"));
    }

    const discount = await prisma.discountCodes.findFirst({
      where: { discountCode: couponCode },
    });

    if (!discount) {
      return next(new NotFoundError("Discount code is not valid or expired."));
    }

    // Find matching products that includes this discount code
    const matchingProduct = cart.find((item: any) => {
      return item.discountCodes?.some((d: any) => d === discount.id);
    });

    if (!matchingProduct) {
      return res.status(200).json({
        valid: false,
        discount: 0,
        discountAmount: 0,
        message: "No matching products found for this coupon!",
      });
    }

    // Calculate discount amount
    let discountAmount = 0;
    const price = matchingProduct.sale_price * matchingProduct.quantity;

    if (discount.discountType === "percentage") {
      discountAmount = (price * discount.discountValue) / 100;
    } else if (discount.discountType === "fixed") {
      discountAmount = discount.discountValue;
    }

    discountAmount = Math.min(discountAmount, price);

    res.status(200).json({
      valid: true,
      discount: discount.discountValue,
      discountAmount: discountAmount.toFixed(2),
      discountProductId: matchingProduct.id,
      discountType: discount.discountType,
      message: "Discount applied to 1 eligible product",
    });
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
      include: {
        user: true,
        shop: true,
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

