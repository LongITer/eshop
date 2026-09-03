import { ValidationError } from "@packages/error-handler";
import prisma from "@packages/libs/prisma";
import redis from "@packages/libs/redis";
import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { sendEmail } from "../utils/send-email";

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
      return next(new ValidationError("Payment session does not belong to you."));
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

    const paymentIntent = await stripe.paymentIntents.create(intentData);
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
        shopId: true,
        images: { select: { url: true } },
      },
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    if (
      products.length !== requestedItems.length ||
      requestedItems.some(
        (item: any) =>
          !productById.has(item.id) ||
          productById.get(item.id)!.stock < item.quantity,
      )
    ) {
      return next(new ValidationError("A product is unavailable or out of stock."));
    }

    if (selectedAddressId) {
      const address = await prisma.address.findFirst({
        where: { id: selectedAddressId, userId },
        select: { id: true },
      });
      if (!address) {
        return next(new ValidationError("Shipping address is invalid."));
      }
    }

    const trustedCart = requestedItems.map((item: any) => {
      const product = productById.get(item.id)!;
      return {
        ...item,
        title: product.title,
        sale_price: product.sale_price,
        shopId: product.shopId,
        image: product.images[0]?.url || null,
      };
    });

    const normalizedCart = JSON.stringify(
      trustedCart
        .map((item: any) => ({
          id: item.id,
          quantity: item.quantity,
          sale_price: item.sale_price,
          shopId: item.shopId,
          selectedOptions: item.selectedOptions || {},
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );

    const keys = await redis.keys("payment-session:*");

    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const session = JSON.parse(data);
        if (session.userId === userId) {
          const existingCart = JSON.stringify(
            session.cart
              .map((item: any) => ({
                id: item.id,
                quantity: item.quantity,
                sale_price: item.sale_price,
                shopId: item.shopId,
                selectedOptions: item.selectedOptions || {},
              }))
              .sort((a: any, b: any) => a.id.localeCompare(b.id)),
          );

          if (existingCart === normalizedCart) {
            return res.status(200).json({ sessionId: key.split(":")[1] });
          } else {
            await redis.del(key);
          }
        }
      }
    }
    // Fetch all seller and their stripe account
    const uniqueShopIds = [...new Set(trustedCart.map((item: any) => item.shopId))];

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
    const totalAmount = trustedCart.reduce((total: number, item: any) => {
      return total + item.quantity * item.sale_price;
    }, 0);

    // Create session payload
    const sessionId = crypto.randomUUID();

    const sessionData = {
      userId,
      cart: trustedCart,
      seller: sellerData,
      totalAmount,
      shippingAddressId: selectedAddressId || null,
      coupon: coupon || null,
    };

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

    return res.status(200).json({
      success: true,
      session,
    });
  } catch (error) {
    return next(error);
  }
};

// Create order
export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const stripeSignature = req.headers["stripe-signature"];
    if (!stripeSignature) {
      return res.status(400).send("Missing stripe signature!");
    }

    const rawBody = (req as any).rawBody;

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        stripeSignature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );

      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        const sessionId = paymentIntent.metadata.sessionId;
        const userId = paymentIntent.metadata.userId;

        if (!sessionId || !userId || paymentIntent.amount_received !== paymentIntent.amount) {
          return res.status(400).send("Invalid payment metadata or amount");
        }

        const existingOrder = await prisma.orders.findFirst({
          where: { stripePaymentId: paymentIntent.id },
          select: { id: true },
        });
        if (existingOrder) {
          return res.status(200).json({ received: true, duplicate: true });
        }

        const lockKey = `payment-processing:${paymentIntent.id}`;
        const lockAcquired = await redis.set(lockKey, "1", "EX", 300, "NX");
        if (lockAcquired !== "OK") {
          return res.status(200).json({ received: true, processing: true });
        }

        const sessionKey = `payment-session:${sessionId}`;
        const sessionData = await redis.get(sessionKey);

        if (!sessionData) {
          console.warn("Session data expired or missing for", sessionId);
          return res
            .status(200)
            .send("No session found, skipping order creation");
        }

        const { cart, totalAmount, shippingAddressId, coupon } = JSON.parse(sessionData);
        const expectedAmount = Math.round(
          (coupon?.discountAmount ? totalAmount - coupon.discountAmount : totalAmount) *
            100,
        );
        if (paymentIntent.amount_received !== expectedAmount) {
          return res.status(400).send("Payment amount does not match order");
        }

        const user = await prisma.users.findUnique({ where: { id: userId } });
        const name = user?.name!;
        const email = user?.email!;

        const shopGrouped = cart.reduce((acc: any, item: any) => {
          if (!acc[item.shopId]) acc[item.shopId] = [];
          acc[item.shopId].push(item);
          return acc;
        }, {});

        // Fetch shipping address
        let shippingAddressData: any = {};
        if (shippingAddressId) {
          const addr = await prisma.address.findUnique({
            where: { id: shippingAddressId },
          });
          if (addr) {
            shippingAddressData = {
              name: addr.name,
              street: addr.street,
              city: addr.city,
              zip: addr.zip,
              country: addr.country,
              label: addr.label,
            };
          }
        }

        for (const shopId in shopGrouped) {
          const orderItems = shopGrouped[shopId];

          const subTotal = orderItems.reduce(
            (sum: number, p: any) => sum + p.quantity * p.sale_price,
            0,
          );

          let discount = 0;

          // Apply discount if applicable
          if (
            coupon &&
            coupon.discountedProductId &&
            orderItems.some(
              (item: any) => item.id === coupon.discountedProductId,
            )
          ) {
            const discountedItem = orderItems.find(
              (item: any) => item.id === coupon.discountedProductId,
            );

            if (coupon.discountType === "percentage") {
              discount =
                discountedItem.sale_price * (coupon.discountValue / 100);
            } else {
              discount = coupon.discountValue;
            }
          }

          const orderTotal = subTotal - discount;
          const orderNumber = `ORD-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

          // Create order
          await prisma.orders.create({
            data: {
              orderNumber,
              userId,
              shopId,
              subTotal,
              discount,
              totalAmount: orderTotal,
              paymentStatus: "Paid",
              paymentMethod: "card",
              stripePaymentId: paymentIntent.id,
              shippingAddress: shippingAddressData,
              items: {
                create: orderItems.map((item: any) => ({
                  productId: item.id,
                  title: item.title || "Untitled Product",
                  image: item.image || null,
                  color: item.selectedOptions?.color || null,
                  size: item.selectedOptions?.size || null,
                  quantity: item.quantity,
                  unitPrice: item.sale_price,
                  totalPrice: item.quantity * item.sale_price,
                })),
              },
            },
          });

          // Update product & analytics
          for (const item of orderItems) {
            const { id: productId, quantity } = item;

            await prisma.products.update({
              where: { id: productId },
              data: {
                stock: { decrement: quantity },
                totalSales: { increment: quantity },
              },
            });

            await prisma.productAnalytics.upsert({
              where: { productId },
              create: {
                productId,
                shopId,
                purchases: quantity,
                lastViewedAt: new Date(),
              },
              update: {
                purchases: { increment: quantity },
              },
            });

            const existingAnalytics = await prisma.userAnalytics.findUnique({
              where: { userId },
            });

            const newAction = {
              productId,
              shopId,
              action: "purchase",
              timestamp: Date.now(),
            };

                    const currentActions = Array.isArray(existingAnalytics?.actions)
                      ? (existingAnalytics.actions as Prisma.InputJsonValue[])
              : [];

            if (existingAnalytics) {
              await prisma.userAnalytics.update({
                where: { userId },
                data: {
                  lastVisited: new Date(),
                  actions: [...currentActions, newAction],
                },
              });
            } else {
              await prisma.userAnalytics.create({
                data: {
                  userId,
                  lastVisited: new Date(),
                  actions: [newAction],
                },
              });
            }
          }
        }

        // Send email for user
        await sendEmail(
          email,
          "🛍️ Your Eshop Order Confirmation",
          "order-confirmation",
          {
            name,
            cart,
            totalAmount: coupon?.discountAmount
              ? totalAmount - coupon?.discountAmount
              : totalAmount,
            trackingUrl: `https://eshop.com/order/${sessionId}`,
          },
        );

        const createdShopIds = Object.keys(shopGrouped);

        const sellerShops = await prisma.shops.findMany({
          where: {
            id: { in: createdShopIds },
          },
          select: {
            id: true,
            sellerId: true,
            name: true,
          },
        });

        for (const shop of sellerShops) {
          const firstProduct = shopGrouped[shop.id][0];
          const productTitle = firstProduct?.title || "new item";

          await prisma.notifications.create({
            data: {
              title: "🛒 New Order Received",
              message: `A customer just ordered ${productTitle} from your shop.`,
              type: "NewOrder",
              sellerId: shop.sellerId,
              redirectUrl: `/order/${sessionId}`,
              metadata: { buyerId: userId },
            },
          });
        }

        // Create notification for admin
        await prisma.notifications.create({
          data: {
            title: "📦 Platform Order Alert",
            message: `A new order was placed by ${name}.`,
            type: "System",
            userId,
            redirectUrl: `https://eshop.com/order/${sessionId}`,
          },
        });

        // Delete session
        await redis.del(sessionKey);
      }

      return res.status(200).json({ received: true });
    } catch (err: any) {
      console.error("Webhook signature verification failed.", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } catch (error) {
    console.log(error);
    return next(error);
  }
};
