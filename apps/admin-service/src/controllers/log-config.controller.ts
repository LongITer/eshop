import { NextFunction, Request, Response } from "express";
import prisma from "@packages/libs/prisma";
import { invalidateLogConfigCache } from "@packages/utils/logs/behavior-log";

/**
 * GET /admin/log-config
 * Returns the current logging configuration.
 * If no config exists, creates one with default values.
 */
export const getLogConfig = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  try {
    let config = await prisma.log_config.findFirst();

    if (!config) {
      config = await prisma.log_config.create({ data: {} });
    }

    return res.status(200).json({ success: true, config });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /admin/update-log-config
 * Accepts a partial object of behavior toggles to update.
 * Example body: { "userLogin": false, "productView": true }
 */
export const updateLogConfig = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> => {
  try {
    const allowedFields = [
      "userLogin",
      "userRegistration",
      "userLogout",
      "passwordChange",
      "passwordReset",
      "productView",
      "productSearch",
      "productFilter",
      "addToCart",
      "addToWishlist",
      "orderCreated",
      "orderCancelled",
      "paymentAttempt",
      "paymentSuccess",
      "paymentFailed",
      "couponUsed",
      "sellerLogin",
      "sellerRegistration",
      "shopCreated",
      "productCreated",
      "productDeleted",
      "orderStatusChange",
      "apiErrors",
      "rateLimitHit",
      "webhookEvents",
    ];

    // Filter only allowed boolean fields from the request body
    const updateData: Record<string, boolean> = {};
    for (const field of allowedFields) {
      if (typeof req.body[field] === "boolean") {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update. Provide boolean values for behavior actions.",
      });
    }

    let config = await prisma.log_config.findFirst();

    if (!config) {
      config = await prisma.log_config.create({ data: updateData });
    } else {
      config = await prisma.log_config.update({
        where: { id: config.id },
        data: updateData,
      });
    }

    // Invalidate the shared cache so all services pick up changes.
    await invalidateLogConfigCache();

    return res.status(200).json({
      success: true,
      message: "Log configuration updated successfully",
      config,
    });
  } catch (error) {
    return next(error);
  }
};
