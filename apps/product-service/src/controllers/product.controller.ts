import { NextFunction, Request, Response } from "express";
import prisma from "@packages/libs/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@packages/error-handler";
import { imageKit } from "@packages/libs/imagekit";
import { Prisma } from "@prisma/client";
import { sendBehaviorLog } from "@packages/utils/logs/behavior-log";
import { objectId } from "@packages/utils/api";
import { transaction } from "@packages/utils/transaction";
import { scanProductListing } from "@packages/utils/product-moderation-ai";
import { submitProductReport } from "@packages/utils/product-moderation";

// Get product categories
export const getCategories = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const config = await prisma.site_config.findFirst();

    if (!config) {
      return res.status(404).json({ message: "Categories not found" });
    }

    return res.status(200).json({
      categories: config.categories,
      subCategories: config.subCategories,
    });
  } catch (error) {
    return next(error);
  }
};

// Create discount codes
export const createDiscountCode = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { public_name, discountType, discountValue, discountCode, productIds = [] } = req.body;
    const value = Number(discountValue);
    if (typeof public_name !== 'string' || !public_name.trim() || typeof discountCode !== 'string' || !discountCode.trim() || discountCode.length > 100 || !['percentage', 'fixed', 'flat'].includes(discountType) || !Number.isFinite(value) || value <= 0 || (discountType === 'percentage' && value > 100)) throw new ValidationError('Provide a valid name, code and discount value');
    if (!Array.isArray(productIds) || productIds.length > 1000 || productIds.some(id => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))) throw new ValidationError('Invalid selected products');
    const selectedIds = [...new Set<string>(productIds)];
    if (selectedIds.length && !req.seller.shop?.id) throw new ValidationError('Create a shop before selecting products');
    const isDiscountCodeExists = await prisma.discountCodes.findFirst({
      where: { discountCode: discountCode.trim() },
    });

    if (isDiscountCodeExists) {
      return res.status(400).json({ message: "Discount code already exists" });
    }

    const discount_code = await prisma.$transaction(async tx => {
      const where = { id: { in: selectedIds }, shopId: req.seller.shop?.id, isDeleted: false };
      if (selectedIds.length && await tx.products.count({ where }) !== selectedIds.length) throw new ValidationError('Select available products belonging to your shop');
      const code = await tx.discountCodes.create({
      data: {
        public_name: public_name.trim(),
        discountType: discountType === 'flat' ? 'fixed' : discountType,
        discountValue: value,
        discountCode: discountCode.trim(),
        sellerId: req.seller.id,
      },
      });
      if (selectedIds.length) {
        const updated = await tx.products.updateMany({ where, data: { discount_codes: { push: code.id } } });
        if (updated.count !== selectedIds.length) throw new ValidationError('Selected products changed. Please retry');
      }
      return code;
    });

    try {
      await prisma.notifications.create({
        data: {
          title: "🎉 Promotion created",
          message: `Your promotion "${public_name}" is ready.`,
          type: "Promotion",
          sellerId: req.seller.id,
          redirectUrl: "/dashboard/discount-codes",
          metadata: { discountCodeId: discount_code.id },
        },
      });
    } catch (notificationError) {
      console.error("Error creating promotion notification:", notificationError);
    }

    return res
      .status(201)
      .json({ message: "Discount code created successfully", discount_code });
  } catch (error) {
    return next(error);
  }
};

// Get discount codes for seller
export const getDiscountCodes = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const sellerId = req.seller.id;
    const discountCodes = await prisma.discountCodes.findMany({
      where: { sellerId },
    });
    return res.status(200).json({
      success: true,
      discount_codes: discountCodes,
    });
  } catch (error) {
    return next(error);
  }
};

// Delete discount codes
export const deleteDiscountCodes = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = objectId(req.params.id);
    const sellerId = req.seller.id;
    await transaction(async tx => {
      const discountCode = await tx.discountCodes.findUnique({
        where: { id },
        select: { id: true, sellerId: true },
      });
      if (!discountCode) throw new NotFoundError("Discount code not found");
      if (discountCode.sellerId !== sellerId) throw new ForbiddenError("You don't have permission to access this discount code");

      const shop = await tx.shops.findUnique({ where: { sellerId }, select: { id: true } });
      if (shop) {
        const products = await tx.products.findMany({
          where: { shopId: shop.id, discount_codes: { has: id } },
          select: { id: true, discount_codes: true },
        });
        // MongoDB scalar lists require replacing the array. A conflicting product
        // update aborts this transaction; the helper retries from a fresh snapshot.
        for (const product of products) {
          await tx.products.update({
            where: { id: product.id, shopId: shop.id },
            data: { discount_codes: { set: product.discount_codes.filter(code => code !== id) } },
          });
        }
      }
      await tx.discountCodes.delete({ where: { id, sellerId } });
    });

    return res.status(200).json({ message: "Discount code deleted successfully" });
  } catch (error) {
    return next(error);
  }
};

// Upload product images
export const uploadProductImages = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { fileName } = req.body;

    if (typeof fileName !== "string" || !fileName.startsWith("data:image/")) {
      return next(new ValidationError("A valid product image is required."));
    }

    const response = await imageKit.upload({
      file: fileName,
      fileName: `product-${Date.now()}.jpg`,
      folder: "/products",
    });

    return res.status(201).json({
      file_url: response.url,
      fileName: response.fileId,
    });
  } catch (error) {
    return next(error);
  }
};

// Delete product images
export const deleteProductImages = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { fileId } = req.body;
    await imageKit.deleteFile(fileId);
    return res.status(200).json({ message: "Product image deleted successfully" });
  } catch (error) {
    return next(error);
  }
};

// Create Product
export const createProduct = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      title,
      short_description,
      detailed_description,
      detail_description, // UI sends this
      warranty = "No Warranty",
      custom_specification,
      slug,
      tags,
      tag, // UI sends this
      cash_on_delivery,
      brand,
      video_url,
      category,
      colors = [],
      sizes = [],
      discount_codes,
      discountCodes, // UI sends this
      stock,
      sale_price,
      regular_price,
      subCategory,
      custom_properties,
      customProperties, // UI sends this
      custom_specifications, // UI sends this
      images = [],
    } = req.body;

    const finalTags = tags || tag;
    const finalDiscountCodes = discount_codes || discountCodes || [];
    const finalCustomProperties = custom_properties || customProperties || {};
    const finalCustomSpecifications =
      custom_specification || custom_specifications || [];

    const missingFields = [
      ["title", title],
      ["slug", slug],
      ["short_description", short_description],
      ["detail_description", detailed_description || detail_description],
      ["category", category],
      ["subCategory", subCategory],
      ["sale_price", sale_price],
      ["regular_price", regular_price],
      ["stock", stock],
      ["tag", finalTags],
    ]
      .filter(([, value]) => value === undefined || value === null || value === "")
      .map(([field]) => field);

    if (missingFields.length > 0) {
      return next(
        new ValidationError(`Missing required fields: ${missingFields.join(", ")}`),
      );
    }

    const hasUploadedImage =
      Array.isArray(images) &&
      images.some(
        (image: any) =>
          typeof image?.url === "string" &&
          image.url.length > 0 &&
          typeof image?.fileId === "string" &&
          image.fileId.length > 0,
      );

    if (!hasUploadedImage) {
      return next(
        new ValidationError("At least one product image is required."),
      );
    }

    if (!req.seller?.shop?.id) {
      return next(
        new ValidationError("Create your shop before listing products."),
      );
    }

    const slugChecking = await prisma.products.findUnique({
      where: { slug },
    });

    if (slugChecking) {
      return next(
        new ValidationError(
          "Slug already exists! Please use a different slug.",
        ),
      );
    }

    const listing = { title, category, description: `${short_description}\n${String(detailed_description || detail_description)}`.replace(/<[^>]*>/g, ' ').slice(0, 12000) };
    let moderation: { flagged: boolean; category: string; reason: string } | null = null;
    let scanUnavailable = false;
    try { moderation = await scanProductListing(listing); } catch { scanUnavailable = true; }
    const reviewRequired = scanUnavailable || moderation?.flagged === true;
    const newProduct = await prisma.products.create({
      data: {
        title,
        short_description,
        detailed_description: detailed_description || detail_description, // Handle both names
        warranty,
        cash_on_delivery,
        slug,
        shopId: req.seller.shop.id!,
        tags: Array.isArray(finalTags) ? finalTags : finalTags.split(","),
        brand,
        video_url,
        category,
        subCategory,
        colors: colors || [],
        discount_codes: Array.isArray(finalDiscountCodes)
          ? finalDiscountCodes
          : [],
        sizes: sizes || [],
        stock: parseInt(stock),
        sale_price: parseFloat(sale_price),
        regular_price: parseFloat(regular_price),
        custom_properties: finalCustomProperties,
        custom_specification: finalCustomSpecifications,
        status: reviewRequired ? 'PendingReview' : 'Active',
        ...(reviewRequired ? { moderationReason: scanUnavailable ? 'Automatic screening is unavailable; administrator review is required.' : moderation!.reason } : {}),
        images: {
          create: images
            .filter((img: any) => img && img.fileId && img.url) // UI sends img.url
            .map((img: any) => ({ file_id: img.fileId, url: img.url })),
        },
      },
      include: {
        images: true,
      },
    });

    if (moderation?.flagged) {
      await submitProductReport(newProduct.id, req.seller.id, 'AI', moderation.category, moderation.reason, listing).catch(error => console.error('Could not persist AI moderation report:', error));
    }

    await sendBehaviorLog("productCreated", {
      type: "success",
      source: "product-service",
      message: "Seller created a product",
      metadata: { sellerId: req.seller.id, productId: newProduct.id },
    });

    return res.status(201).json({
      success: true,
      message: reviewRequired ? "Product submitted for administrator review" : "Product created successfully",
      newProduct,
    });
  } catch (error) {
    return next(error);
  }
};

// Get Products
export const getShopProducts = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const products = await prisma.products.findMany({
      where: {
        shopId: req.seller.shop.id!,
      },
      include: {
        images: true,
        _count: { select: { reviews: true } },
      },
    });

    return res.status(200).json({
      success: true,
      products,
    });
  } catch (error) {
    return next(error);
  }
};

// Delete Products
export const deleteProduct = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const productId = req.params.id;
    const sellerId = req.seller?.shop?.id;

    const product = await prisma.products.findUnique({
      where: { id: productId },
      select: { id: true, shopId: true, isDeleted: true },
    });

    if (!product) {
      return next(new ValidationError("Product not found!"));
    }

    if (product.shopId !== sellerId) {
      return next(new ValidationError("Unauthorized!"));
    }

    if (product.isDeleted) {
      return next(new ValidationError("Product is already deleted!"));
    }

    const deletedProduct = await prisma.products.update({
      where: { id: productId },
      data: {
        isDeleted: true,
        deleteAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await sendBehaviorLog("productDeleted", {
      type: "success",
      source: "product-service",
      message: "Seller scheduled a product for deletion",
      metadata: { sellerId: req.seller.id, productId: deletedProduct.id },
    });

    return res.status(200).json({
      message:
        "Product is scheduled for deletion in 24 hours! You can restore it within this period.",
      deletedAt: deletedProduct.deleteAt,
    });
  } catch (error) {
    return next(error);
  }
};

// Restore Products
export const restoreProduct = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const productId = req.params.id;
    const sellerId = req.seller?.shop?.id;

    const product = await prisma.products.findUnique({
      where: { id: productId },
      select: { id: true, shopId: true, isDeleted: true },
    });

    if (!product) {
      return next(new ValidationError("Product not found!"));
    }

    if (product.shopId !== sellerId) {
      return next(new ValidationError("Unauthorized action!"));
    }

    if (!product.isDeleted) {
      return next(new ValidationError("Product is not in deleted state"));
    }

    await prisma.products.update({
      where: { id: productId },
      data: {
        isDeleted: false,
        deleteAt: null,
      },
    });

    return res.status(200).json({
      message: "Product restored successfully",
    });
  } catch (error) {
    return next(error);
  }
};

// Get All Products
export const getAllProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const type = req.query.type;

    const baseFilter = {
      status: 'Active' as const, isDeleted: false,
      OR: [
        { starting_date: null },
        { starting_date: { isSet: false } },
        { ending_date: null },
        { ending_date: { isSet: false } },
      ],
    };

    const orderBy: Prisma.productsOrderByWithRelationInput =
      type === "latest"
        ? { createdAt: "desc" as Prisma.SortOrder }
        : { totalSales: "desc" as Prisma.SortOrder };

    const [products, total, top10Products] = await Promise.all([
      await prisma.products.findMany({
        skip,
        take: limit,
        include: {
          images: true,
          shop: true,
        },
        where: baseFilter,
        orderBy,
      }),

      prisma.products.count({ where: baseFilter }),

      prisma.products.findMany({
        take: 10,
        where: baseFilter,
        orderBy,
      }),
    ]);

    return res.status(201).json({
      products,
      top10By: type === "latest" ? "latest" : "topSales",
      top10Products,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return next(error);
  }
};

// Get product details
export const getProductDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const product = await prisma.products.findUnique({
      where: { slug: req.params.slug, status: 'Active', isDeleted: false },
      include: {
        images: true,
        shop: true,
      },
    });

    if (product) {
      await sendBehaviorLog("productView", {
        type: "info",
        source: "product-service",
        message: "Product details viewed",
        metadata: { productId: product.id, slug: product.slug },
      });
    }

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    return next(error);
  }
};

// Get filtered products
export { filteredCatalog as getFilteredProducts } from './catalog-query';
// Get filtered events
export const getFilteredEvents = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      priceRange = [0, 10000],
      categories = [],
      colors = [],
      sizes = [],
      page = 1,
      limit = 12,
    } = req.query;

    const parsedPriceRange =
      typeof priceRange === "string"
        ? priceRange.split(",").map(Number)
        : [0, 10000];

    const parsedPage = Number(page);
    const parsedLimit = Number(limit);

    const skip = (parsedPage - 1) * parsedLimit;

    const filters: Record<string, any> = {
      status: 'Active', isDeleted: false,
      sale_price: {
        gte: parsedPriceRange[0],
        lte: parsedPriceRange[1],
      },
      NOT: {
        starting_date: null,
      },
    };

    if (categories && (categories as string[]).length > 0) {
      filters.category = {
        in: Array.isArray(categories)
          ? categories
          : String(categories).split(","),
      };
    }

    if (colors && (colors as string[]).length > 0) {
      filters.colors = {
        hasSome: Array.isArray(colors) ? colors : [colors],
      };
    }

    if (sizes && (sizes as string[]).length > 0) {
      filters.sizes = {
        hasSome: Array.isArray(sizes) ? sizes : [sizes],
      };
    }

    const [products, total] = await Promise.all([
      prisma.products.findMany({
        where: filters,
        skip,
        take: parsedLimit,
        include: {
          images: true,
          shop: true,
        },
      }),
      prisma.products.count({ where: filters }),
    ]);

    const totalPages = Math.ceil(total / parsedLimit);

    return res.json({
      products,
      pagination: {
        total,
        page: parsedPage,
        totalPages,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Get shop by ID (public)
export const getShopById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const shop = await prisma.shops.findUnique({
      where: { id },
      include: {
        avatar: true,
        sellers: {
          select: {
            id: true,
            name: true,
            country: true,
          },
        },
        products: {
          where: { isDeleted: false, status: 'Active' },
          take: 20,
          orderBy: { createdAt: "desc" },
          include: {
            images: true,
            shop: true,
          },
        },
      },
    });

    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    return res.json({
      shop: {
        ...shop,
        followerCount: await prisma.users.count({ where: { following: { has: id } } }),
        avatar: shop.avatar?.[0]?.url ?? "",
      },
      sellerId: shop.sellerId,
    });
  } catch (error) {
    return next(error);
  }
};

// Get filtered shops
export const getFilteredShops = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { categories = [], countries = [], page = 1, limit = 12 } = req.query;

    const parsedPage = Number(page);
    const parsedLimit = Number(limit);
    const skip = (parsedPage - 1) * parsedLimit;

    const filters: Record<string, any> = {
      status: 'Active', isDeleted: false,};

    if (categories && String(categories).length > 0) {
      filters.category = {
        in: Array.isArray(categories)
          ? categories
          : String(categories).split(","),
        mode: "insensitive",
      };
    }

    if (countries && String(countries).length > 0) {
      const countryArray = Array.isArray(countries)
        ? countries
        : String(countries).split(",");
      filters.sellers = {
        is: {
          country: {
            in: countryArray,
            mode: "insensitive",
          },
        },
      };
    }

    const [shops, total] = await Promise.all([
      prisma.shops.findMany({
        where: filters,
        skip,
        take: parsedLimit,
        include: {
          // followers: true,
          products: true,
        },
      }),
      prisma.shops.count({ where: filters }),
    ]);

    const totalPages = Math.ceil(total / parsedLimit);

    return res.json({
      shops,
      pagination: {
        total,
        page: parsedPage,
        totalPages,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Search products
export const searchProducts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const query = req.query.q as string;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: "Search query is required." });
    }

    const products = await prisma.products.findMany({
      where: {
        status: 'Active', isDeleted: false,
        OR: [
          {
            title: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            short_description: {
              contains: query,
              mode: "insensitive",
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
      },
      take: 10,
      orderBy: {
        createdAt: "desc",
      },
    });

    await sendBehaviorLog("productSearch", {
      type: "info",
      source: "product-service",
      message: "Product search completed",
      metadata: { queryLength: query.trim().length, resultCount: products.length },
    });

    return res.status(200).json({ products });
  } catch (error) {
    return next(error);
  }
};

// Top Shops
export const topShops = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Aggregate total sales per shop from orders
    const topShopsData = await prisma.orders.groupBy({
      by: ["shopId"],
      _sum: {
        totalAmount: true,
      },
      orderBy: {
        _sum: {
          totalAmount: "desc",
        },
      },
      take: 10,
    });
    // Fetch the corresponding shop details
    const shopIds = topShopsData.map((item) => item.shopId);

    const shops = await prisma.shops.findMany({
      where: {
        id: {
          in: shopIds,
        },
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        coverBanner: true,
        address: true,
        ratings: true,
        category: true,
      },
    });

    // Include recently created shops when there are not enough shops with sales yet.
    const fallbackShops = await prisma.shops.findMany({
      where: {
        id: {
          notIn: shopIds,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: Math.max(0, 10 - shops.length),
      select: {
        id: true,
        name: true,
        avatar: true,
        coverBanner: true,
        address: true,
        ratings: true,
        category: true,
      },
    });

    // Merge sales with shop data
    const enrichedShops = [...shops, ...fallbackShops].map((shop) => {
      const salesData = topShopsData.find((s) => s.shopId === shop.id);
      return {
        ...shop,
        avatar: shop.avatar[0]?.url ?? "",
        rating: shop.ratings ?? 0,
        totalSales: salesData?._sum.totalAmount ?? 0,
      };
    });

    const top10Shops = enrichedShops
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 10);

    return res.status(200).json({ shops: top10Shops });
  } catch (error) {
    console.error("Error fetching top shop: ", error);
    return next(error);
  }
};

// Get All Events
export const getAllEvents = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const baseFilter = {
      status: 'Active' as const, isDeleted: false,
      AND: [{ starting_date: { not: null } }, { ending_date: { not: null } }],
    };

    const [events, total, top10BySales] = await Promise.all([
      prisma.products.findMany({
        skip,
        take: limit,
        where: baseFilter,
        include: {
          images: true,
          shop: true,
        },
        orderBy: {
          totalSales: "desc",
        },
      }),
      prisma.products.count({ where: baseFilter }),
      prisma.products.findMany({
        where: baseFilter,
        take: 10,
        orderBy: {
          totalSales: "desc",
        },
      }),
    ]);

    return res.status(200).json({
      events,
      top10BySales,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching all events: ", error);
    return next(error);
  }
};


