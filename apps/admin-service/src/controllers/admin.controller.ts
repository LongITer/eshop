import { NextFunction, Request, Response } from "express";
import prisma from "@packages/libs/prisma";

// Get all products (admin)
export const getAllProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const search = (req.query.search as string) || "";

    const where = search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { category: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [products, total] = await Promise.all([
      prisma.products.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          images: true,
          shop: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      }),
      prisma.products.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      products,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

// Get all events (admin)
export const getAllEvents = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const search = (req.query.search as string) || "";

    const baseFilter: any = {
      AND: [{ starting_date: { not: null } }, { ending_date: { not: null } }],
    };

    if (search) {
      baseFilter.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
      ];
    }

    const [events, total] = await Promise.all([
      prisma.products.findMany({
        where: baseFilter,
        skip,
        take: limit,
        orderBy: { starting_date: "desc" },
        include: {
          images: true,
          shop: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      }),
      prisma.products.count({ where: baseFilter }),
    ]);

    return res.status(200).json({
      success: true,
      events,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

// Get all admin
export const getAllAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const admins = await prisma.users.findMany({
      where: {
        role: "admin",
      },
    });

    return res.status(200).json({
      success: true,
      admins,
    });
  } catch (error) {
    next(error);
  }
};

// Add new admin (promote existing user by email)
export const addAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, role = "admin" } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const allowedRoles = ["admin", "user", "seller"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await prisma.users.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === role) {
      return res.status(400).json({ message: `User is already a ${role}` });
    }

    const updated = await prisma.users.update({
      where: { email },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });

    return res.status(200).json({
      success: true,
      message: `${updated.name}'s role has been updated to ${role}`,
      user: updated,
    });
  } catch (error) {
    next(error);
  }
};


// Get site_config (customizations: categories, subCategories, logo, banner)
export const getSiteConfig = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const config = await prisma.site_config.findFirst();

    if (!config) {
      return res.status(404).json({ message: "Site config not found" });
    }

    return res.status(200).json({ success: true, config });
  } catch (error) {
    next(error);
  }
};

// Update site_config (customizations)
export const updateSiteConfig = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { categories, subCategories, logo, banner } = req.body;

    const config = await prisma.site_config.findFirst();

    if (!config) {
      return res.status(404).json({ message: "Site config not found" });
    }

    const updated = await prisma.site_config.update({
      where: { id: config.id },
      data: {
        ...(categories !== undefined && { categories }),
        ...(subCategories !== undefined && { subCategories }),
        ...(logo !== undefined && { logo }),
        ...(banner !== undefined && { banner }),
      },
    });

    return res.status(200).json({
      success: true,
      message: "Site config updated successfully",
      config: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Get all users
export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const search = (req.query.search as string) || "";

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
          role: "user",
        }
      : { role: "user" };

    const [users, total] = await Promise.all([
      prisma.users.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          avatar: true,
        },
      }),
      prisma.users.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      users,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

// Get all sellers
export const getAllSellers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const search = (req.query.search as string) || "";

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [sellers, total] = await Promise.all([
      prisma.sellers.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          phone_number: true,
          country: true,
          createdAt: true,
          shop: {
            select: {
              id: true,
              name: true,
              avatar: true,
              category: true,
              ratings: true,
            },
          },
        },
      }),
      prisma.sellers.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      sellers,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};
