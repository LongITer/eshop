import { NextFunction, Response } from "express";
import prisma from "@packages/libs/prisma";

const LOW_STOCK_THRESHOLD = 5;
const REVENUE_DAYS = 30;

// Get dashboard stats for the seller's shop
export const getSellerStats = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const shopId: string | null | undefined = req.seller?.shop?.id;

    if (!shopId) {
      return res.status(200).json({
        success: true,
        shop: null,
        stats: {
          totalRevenue: 0,
          totalOrders: 0,
          totalProducts: 0,
          lowStockCount: 0,
          pendingOrders: 0,
          statusCounts: {},
        },
        revenueByDay: [],
        recentOrders: [],
        topProducts: [],
        lowStockProducts: [],
      });
    }

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (REVENUE_DAYS - 1));

    const [
      totalProducts,
      totalOrders,
      revenueAgg,
      statusGroups,
      paidOrdersInPeriod,
      recentOrders,
      topSales,
      lowStockCount,
      lowStockProducts,
      shop,
    ] = await Promise.all([
      prisma.products.count({
        where: { shopId, isDeleted: false },
      }),
      prisma.orders.count({
        where: { shopId },
      }),
      prisma.orders.aggregate({
        where: { shopId, paymentStatus: "Paid", status: { notIn: ['Cancelled', 'Returned', 'Refunded'] } },
        _sum: { totalAmount: true },
      }),
      prisma.orders.groupBy({
        by: ["status"],
        where: { shopId },
        _count: { _all: true },
      }),
      prisma.orders.findMany({
        where: { shopId, paymentStatus: "Paid", status: { notIn: ['Cancelled', 'Returned', 'Refunded'] }, createdAt: { gte: since } },
        select: { createdAt: true, totalAmount: true },
      }),
      prisma.orders.findMany({
        where: { shopId },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          user: { select: { name: true, email: true } },
          items: { select: { title: true, image: true, quantity: true } },
        },
      }),
      prisma.orderItems.groupBy({
        by: ["productId"],
        where: { order: { shopId, paymentStatus: 'Paid', status: { notIn: ['Cancelled', 'Returned', 'Refunded'] } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      prisma.products.count({
        where: {
          shopId,
          isDeleted: false,
          stock: { lte: LOW_STOCK_THRESHOLD },
        },
      }),
      prisma.products.findMany({
        where: {
          shopId,
          isDeleted: false,
          stock: { lte: LOW_STOCK_THRESHOLD },
        },
        orderBy: { stock: "asc" },
        take: 8,
        include: { images: true },
      }),
      prisma.shops.findUnique({
        where: { id: shopId },
        select: { id: true, name: true, avatar: true },
      }),
    ]);

    const revenueByDay: { date: string; revenue: number; orders: number }[] =
      [];
    for (let i = 0; i < REVENUE_DAYS; i++) {
      const day = new Date(since);
      day.setUTCDate(since.getUTCDate() + i);
      revenueByDay.push({
        date: day.toISOString().slice(0, 10),
        revenue: 0,
        orders: 0,
      });
    }

    const indexByDate = new Map(revenueByDay.map((entry) => [entry.date, entry]));
    for (const order of paidOrdersInPeriod) {
      const key = order.createdAt.toISOString().slice(0, 10);
      const entry = indexByDate.get(key);
      if (entry) {
        entry.revenue += order.totalAmount;
        entry.orders += 1;
      }
    }

    const topProductIds = topSales.map((s) => s.productId);
    const topProductsFound =
      topProductIds.length > 0
        ? await prisma.products.findMany({
            where: { id: { in: topProductIds } },
            include: { images: true },
          })
        : [];

    const topProducts = topSales
      .map((s) => {
        const product = topProductsFound.find((p) => p.id === s.productId);
        return product
          ? {
              id: product.id,
              title: product.title,
              slug: product.slug,
              sale_price: product.sale_price,
              image: product.images[0]?.url ?? "",
              unitsSold: s._sum.quantity ?? 0,
            }
          : null;
      })
      .filter((p) => p !== null);

    const statusCounts: Record<string, number> = {};
    for (const group of statusGroups) {
      statusCounts[group.status] = group._count._all;
    }

    res.status(200).json({
      success: true,
      shop: shop
        ? {
            id: shop.id,
            name: shop.name,
            avatar: shop.avatar?.[0]?.url ?? "",
          }
        : null,
      stats: {
        totalRevenue: revenueAgg._sum.totalAmount ?? 0,
        totalOrders,
        totalProducts,
        lowStockCount,
        pendingOrders: statusCounts["Pending"] ?? 0,
        statusCounts,
      },
      revenueByDay,
      recentOrders,
      topProducts,
      lowStockProducts,
    });
  } catch (error) {
    return next(error);
  }
};
