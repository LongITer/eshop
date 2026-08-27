import { NextFunction, Request, Response } from "express";
import prisma from "@packages/libs/prisma";
import { ValidationError } from "@packages/error-handler";
import { imageKit } from "@packages/libs/imagekit";
import { Prisma } from "@prisma/client";

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

    res.status(200).json({
      categories: config.categories,
      subCategories: config.subCategories,
    });
  } catch (error) {
    next(error);
  }
};

// Create discount codes
export const createDiscountCode = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { public_name, discountType, discountValue, discountCode } = req.body;
    const isDiscountCodeExists = await prisma.discountCodes.findFirst({
      where: { discountCode },
    });

    if (isDiscountCodeExists) {
      return res.status(400).json({ message: "Discount code already exists" });
    }

    const discount_code = await prisma.discountCodes.create({
      data: {
        public_name,
        discountType,
        discountValue: parseFloat(discountValue),
        discountCode,
        sellerId: req.seller.id,
      },
    });

    res
      .status(201)
      .json({ message: "Discount code created successfully", discount_code });
  } catch (error) {
    next(error);
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
    res.status(200).json({
      success: true,
      discount_codes: discountCodes,
    });
  } catch (error) {
    next(error);
  }
};

// Delete discount codes
export const deleteDiscountCodes = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const sellerId = req.seller.id;

    // Check discount code exists and belongs to the seller
    const discountCode = await prisma.discountCodes.findUnique({
      where: { id },
      select: { id: true, sellerId: true },
    });

    // If discount code not found or doesn't belong to the seller
    if (!discountCode) {
      return res.status(404).json({ message: "Discount code not found" });
    }

    if (discountCode.sellerId !== sellerId) {
      return res.status(403).json({
        message: "You don't have permission to access this discount code",
      });
    }

    await prisma.discountCodes.delete({
      where: { id },
    });

    res.status(200).json({ message: "Discount code deleted successfully" });
  } catch (error) {
    next(error);
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

    const response = await imageKit.upload({
      file: fileName,
      fileName: `product-${Date.now()}.jpg`,
      folder: "/products",
    });

    res.status(201).json({
      file_url: response.url,
      fileName: response.fileId,
    });
  } catch (error) {
    next(error);
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
    res.status(200).json({ message: "Product image deleted successfully" });
  } catch (error) {
    next(error);
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

    if (
      !title ||
      !slug ||
      !short_description ||
      !category ||
      !subCategory ||
      !sale_price ||
      !images ||
      !finalTags ||
      !stock ||
      !regular_price
    ) {
      return next(new ValidationError("Missing required fields"));
    }

    if (!req.seller.id) {
      return next(new ValidationError("Only seller can create products!"));
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

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      newProduct,
    });
  } catch (error) {
    next(error);
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
      },
    });

    return res.status(200).json({
      success: true,
      products,
    });
  } catch (error) {
    next(error);
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

    return res.status(200).json({
      message:
        "Product is scheduled for deletion in 24 hours! You can restore it within this period.",
      deletedAt: deletedProduct.deleteAt,
    });
  } catch (error) {
    next(error);
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
    next(error);
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
        orderBy: {
          totalSales: "desc",
        },
      }),

      prisma.products.count({ where: baseFilter }),

      prisma.products.findMany({
        take: 10,
        where: baseFilter,
        orderBy,
      }),
    ]);

    res.status(201).json({
      products,
      top10By: type === "latest" ? "latest" : "topSales",
      top10Products,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
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
      where: { slug: req.params.slug },
      include: {
        images: true,
        shop: true,
      },
    });
    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    return next(error);
  }
};

// Get filtered products
export const getFilteredProducts = async (
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
      excludeId = "",
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
      sale_price: {
        gte: parsedPriceRange[0],
        lte: parsedPriceRange[1],
      },
      OR: [
        { starting_date: null },
        { starting_date: { isSet: false } },
      ],
    };

    // Exclude current product from recommendations
    if (excludeId && typeof excludeId === "string") {
      filters.id = {
        not: excludeId,
      };
    }

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

    res.json({
      products,
      pagination: {
        total,
        page: parsedPage,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};
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

    res.json({
      products,
      pagination: {
        total,
        page: parsedPage,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
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

    const filters: Record<string, any> = {};

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

    res.json({
      shops,
      pagination: {
        total,
        page: parsedPage,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
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

    return res.status(200).json({ products });
  } catch (error) {
    next(error);
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
