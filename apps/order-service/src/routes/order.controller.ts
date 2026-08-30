import { ValidationError } from "@packages/error-handler";
import prisma from "@packages/libs/prisma";
import redis from "@packages/libs/redis";
import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

// Create payment intent
export const createPaymentIntent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { amount, sellerStripeAccountId, sessionId } = req.body;

  const customerAmount = Math.round(amount * 100);
  const platformFee = Math.floor(customerAmount * 0.1);

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: customerAmount,
      currency: "usd",
      payment_method_types: ["card"],
      application_fee_amount: platformFee,
      transfer_data: {
        destination: sellerStripeAccountId,
      },
      metadata: {
        sessionId,
        userId: req.user.id,
      },
    });
    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {}
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

    if (cart || !Array.isArray(cart) || cart.length === 0) {
      return next(new ValidationError("Cart is empty or invalid."));
    }

    const normalizedCart = JSON.stringify(
      cart
        .map((item: any) => ({
          id: item.id,
          quantity: item.quantity,
          sale_price: item.sale_price,
          shopId: item.shopId,
          selectedOptions: item.selectedOptions || {},
        }))
        .sort((a, b) => a.id.localCompare(b.id)),
    );

    const keys = await redis.keys("payment-session:*");

    for (const key in keys) {
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
    const uniqueShopIds = [...new Set(cart.map((item: any) => item.shopId))];

    const shops = await prisma.shops.findMany({
      where: {
        id: {
          in: uniqueShopIds,
        },
      },
      select: {
        id: true,
        sellers: {
          stripeId: true,
        },
      },
    });

    const sellerData = shops.map((shop) => ({
      shopId: shop.id,
      sellerId: shop.sellerId,
      stripeAccountId: shop?.sellers?.stripeId,
    }));

    // Calculate total
    const totalAmount = cart.reduce((total: number, item: any) => {
      return total + item.quantity * item.sale_price;
    }, 0);

    // Create session payload
    const sessionId = crypto.randomUUID();

    const sessionData = {
      userId,
      cart,
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
    next(error);
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
    next(error);
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
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const sessionId = paymentIntent.metadata.sessionId;
        const userId = paymentIntent.metadata.userId;

        const sessionKey = `payment-session:${sessionId}`;
        const sessionData = await redis.get(sessionKey);

        if (!sessionData) {
          console.warn("Session data expired or missing for", sessionId);
          return res
            .status(200)
            .send("No session found, skipping order creation");
        }

        const { cart, totalAmount, shippingAddressId, coupon } =
          JSON.parse(sessionData);

        const user = await prisma.users.findUnique({ where: { id: userId } });
        const name = user?.name!;
        const email = user?.email!;

        const shopGrouped = cart.reduce((acc: any, item: any) => {
          if (!acc[item.shopId]) acc[item.shopId] = [];
          acc[item.shopId].push(item);
          return acc;
        }, {});

        for (const shopId in shopGrouped) {
          const orderItems = shopGrouped[shopId];

          let orderTotal = orderItems.reduce(
            (sum: number, p: any) => sum + p.quantity * p.sale_price,
            0,
          );

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

            const discountAmount = discountedItem.sale_price * 0.1;

            orderTotal -= discountAmount;
          }
        }
      }

      // Create order
      await prisma.orders.create({
        data: {
          userId,
          shopId,
          total: orderTotal,
          status: "Paid",
          shippingAddressId: shippingAddressId || null,
          couponCode: coupon?.code || null,
          discountAmount: coupon?.discountAmount || 0,
          items: {
            create: orderItems.map((item: any) => ({
              productId: item.id,
              quantity: item.quantity,
              price: item.sale_price,
              selectedOptions: item.selectedOptions,
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
          ? (existingAnalytics.actions as Prisma.JsonArray)
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

      // Send email for user
      // await sendEmail(
      //   email,
      //   "🛍️ Your Eshop Order Confirmation",
      //   "order-confirmation",
      //   {
      //     name,
      //     cart,
      //     totalAmount: coupon?.discountAmount
      //       ? totalAmount - coupon?.discountAmount
      //       : totalAmount,
      //     trackingUrl: `https://eshop.com/order/${sessionId}`,
      //   },
      );
    } catch (err: any) {
      console.error("Webhook signature verification failed.", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } catch (error) {
    next(error);
  }
};
