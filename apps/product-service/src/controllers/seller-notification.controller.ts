import { NextFunction, Request, Response } from "express";
import prisma from "@packages/libs/prisma";

type SellerRequest = Request;

export const getSellerNotifications = async (
  req: SellerRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const sellerId = req.seller!.id;
    const where = { sellerId };
    const [notifications, unreadCount] = await Promise.all([
      prisma.notifications.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.notifications.count({ where: { ...where, isRead: false } }),
    ]);

    return res.status(200).json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    return next(error);
  }
};

export const markSellerNotificationRead = async (
  req: SellerRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    if (!/^[a-f\d]{24}$/i.test(id)) {
      return res.status(400).json({ message: "Invalid notification id" });
    }

    const result = await prisma.notifications.updateMany({
      where: { id, sellerId: req.seller!.id },
      data: { isRead: true },
    });

    if (result.count === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
};

export const markAllSellerNotificationsRead = async (
  req: SellerRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await prisma.notifications.updateMany({
      where: { sellerId: req.seller!.id, isRead: false },
      data: { isRead: true },
    });

    return res.status(200).json({
      success: true,
      updatedCount: result.count,
    });
  } catch (error) {
    return next(error);
  }
};
