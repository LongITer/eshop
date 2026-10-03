/**
 * Product Matcher Service
 * Queries the product database to find PC components matching the user's
 * purpose, budget, and preferences.
 */

import prisma from "@packages/libs/prisma";
import { PC_COMPONENT_CATEGORIES, PURPOSE_PROFILES } from "../data/pc-knowledge";

export interface MatchedProduct {
  id: string;
  title: string;
  slug: string;
  category: string;
  subCategory: string;
  sale_price: number;
  regular_price: number;
  stock: number;
  rating: number;
  image: string | null;
  shopName: string;
  shopId: string;
  brand: string | null;
}

export interface ProductSearchContext {
  purpose: string;
  budgetMin: number;
  budgetMax: number;
  preferences: string[];
}

const PRODUCT_SEARCH_TERMS: Record<string, string[]> = {
  cpu: ["cpu", "processor", "bộ xử lý", "ryzen", "intel core"],
  gpu: ["gpu", "vga", "card đồ họa", "graphics"],
  ram: ["ram", "memory", "bộ nhớ"],
  storage: ["ssd", "hdd", "ổ cứng", "storage"],
  motherboard: ["mainboard", "motherboard", "bo mạch chủ"],
};

/** Find in-stock shop products for a component-specific AI question. */
export async function findShopProductsForAI(
  userMessage: string
): Promise<MatchedProduct[]> {
  const lowerMessage = userMessage.toLowerCase();
  const component = Object.keys(PRODUCT_SEARCH_TERMS).find((key) => {
    const pattern =
      key === "cpu"
        ? /cpu|processor|bộ\s*xử\s*lý/
        : key === "gpu"
          ? /gpu|vga|card\s*đồ\s*họa/
          : key === "ram"
            ? /ram|memory|bộ\s*nhớ/
            : key === "storage"
              ? /ssd|hdd|ổ\s*cứng|storage/
              : /mainboard|motherboard|bo\s*mạch\s*chủ/;
    return pattern.test(lowerMessage);
  });

  if (!component) return [];

  try {
    const terms = PRODUCT_SEARCH_TERMS[component];
    const products = await prisma.products.findMany({
      where: {
        AND: [
          {
            OR: terms.flatMap((term) => [
              { category: { contains: term, mode: "insensitive" } },
              { subCategory: { contains: term, mode: "insensitive" } },
              { title: { contains: term, mode: "insensitive" } },
              { tags: { hasSome: [term, term.toUpperCase()] } },
            ]),
          },
          { stock: { gt: 0 }, status: "Active", isDeleted: false },
        ],
      },
      include: {
        images: { take: 1 },
        shop: { select: { name: true } },
      },
      orderBy: [{ sale_price: "desc" }, { rating: "desc" }],
      take: 100,
    });

    return products.map((product) => ({
      id: product.id,
      title: product.title,
      slug: product.slug,
      category: product.category,
      subCategory: product.subCategory,
      sale_price: product.sale_price,
      regular_price: product.regular_price,
      stock: product.stock,
      rating: product.rating,
      image: product.images[0]?.url || null,
      shopName: product.shop.name,
      shopId: product.shopId,
      brand: product.brand,
    }));
  } catch (error) {
    console.error("Error finding shop products for AI:", error);
    return [];
  }
}

/**
 * Find products that match the PC build context.
 * Searches for PC component products within the budget range.
 */
export async function findMatchingProducts(
  context: ProductSearchContext
): Promise<MatchedProduct[]> {
  try {
    // Search for PC-related products
    const products = await prisma.products.findMany({
      where: {
        OR: [
          {
            category: {
              in: PC_COMPONENT_CATEGORIES,
            },
          },
          {
            subCategory: {
              in: PC_COMPONENT_CATEGORIES,
            },
          },
          {
            tags: {
              hasSome: [
                "pc", "linh kiện", "cpu", "gpu", "ram", "ssd",
                "mainboard", "psu", "case", "vga", "card đồ họa",
              ],
            },
          },
        ],
        sale_price: {
          gte: 0,
          lte: context.budgetMax,
        },
        stock: { gt: 0 },
        status: "Active",
        isDeleted: false,
      },
      include: {
        images: { take: 1 },
        shop: { select: { name: true } },
      },
      orderBy: [{ rating: "desc" }, { totalSales: "desc" }],
      take: 100,
    });

    const purposeProfile = PURPOSE_PROFILES.find(
      (profile) => profile.key === context.purpose
    );
    const preferenceCategories: Record<string, string> = {
      gpu_priority: "gpu",
      ram_priority: "ram",
      storage_priority: "storage",
    };
    const preferredCategories = new Set(
      context.preferences
        .map((preference) => preferenceCategories[preference])
        .filter(Boolean)
    );
    const purposePriorities = purposeProfile?.priorities;
    const targetBudget = (context.budgetMin + context.budgetMax) / 2;
    const budgetShares: Record<string, number> = {
      cpu: 0.2,
      gpu: 0.35,
      ram: 0.1,
      storage: 0.1,
      motherboard: 0.12,
      psu: 0.08,
      case: 0.05,
      cooler: 0.05,
      monitor: 0.15,
    };
    const getComponentType = (product: (typeof products)[number]) => {
      const searchable = `${product.category} ${product.subCategory} ${product.tags.join(" ")}`.toLowerCase();
      if (/cpu|processor|bộ xử lý/.test(searchable)) return "cpu";
      if (/gpu|vga|card đồ họa|graphics/.test(searchable)) return "gpu";
      if (/ram|memory|bộ nhớ/.test(searchable)) return "ram";
      if (/ssd|hdd|storage|ổ cứng|lưu trữ/.test(searchable)) return "storage";
      if (/mainboard|motherboard|bo mạch/.test(searchable)) return "motherboard";
      if (/psu|power supply|nguồn/.test(searchable)) return "psu";
      if (/case|vỏ máy/.test(searchable)) return "case";
      if (/cooler|tản nhiệt/.test(searchable)) return "cooler";
      if (/monitor|màn hình/.test(searchable)) return "monitor";
      return "other";
    };
    const priorityScore = (type: string) => {
      const priority = purposePriorities?.[type as keyof typeof purposePriorities];
      return priority === "high" ? 3 : priority === "medium" ? 2 : 1;
    };
    const ranked = products
      .map((product) => {
        const componentType = getComponentType(product);
        const targetPrice = targetBudget * (budgetShares[componentType] || 0.1);
        const priceFit = targetPrice
          ? 1 - Math.min(Math.abs(product.sale_price - targetPrice) / targetPrice, 1)
          : 0;
        return {
          product,
          componentType,
          score:
            priorityScore(componentType) * 100 +
            (preferredCategories.has(componentType) ? 150 : 0) +
            product.rating * 10 +
            Math.log1p(product.totalSales) +
            priceFit * 20,
        };
      })
      .sort((a, b) => b.score - a.score);

    const selected = new Map<string, (typeof ranked)[number]>();
    for (const item of ranked) {
      if (item.componentType !== "other" && !selected.has(item.componentType)) {
        selected.set(item.componentType, item);
      }
    }
    const chosen = [...selected.values()].sort((a, b) => b.score - a.score);
    for (const item of ranked) {
      if (chosen.length >= 6) break;
      if (!chosen.some((entry) => entry.product.id === item.product.id)) {
        chosen.push(item);
      }
    }

    return chosen.slice(0, 6).map(({ product: p }) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      category: p.category,
      subCategory: p.subCategory,
      sale_price: p.sale_price,
      regular_price: p.regular_price,
      stock: p.stock,
      rating: p.rating,
      image: p.images[0]?.url || null,
      shopName: p.shop.name,
      shopId: p.shopId,
      brand: p.brand,
    }));
  } catch (error) {
    console.error("Error finding matching products:", error);
    return [];
  }
}

/**
 * Find PC build templates from the database.
 */
export async function findBuildTemplates(
  purpose: string,
  budgetMin: number,
  budgetMax: number
) {
  try {
    const templates = await prisma.pcBuildTemplate.findMany({
      where: {
        purpose,
        isActive: true,
        budgetMin: { lte: budgetMax },
        budgetMax: { gte: budgetMin },
      },
      orderBy: { createdAt: "desc" },
    });

    return templates;
  } catch (error) {
    console.error("Error finding build templates:", error);
    return [];
  }
}

/**
 * Get template products — resolves productIds in a template to actual product data.
 */
export async function getTemplateProducts(productIds: string[]) {
  try {
    if (!productIds || productIds.length === 0) return [];

    const products = await prisma.products.findMany({
      where: {
        id: { in: productIds },
        status: "Active",
        isDeleted: false,
        stock: { gt: 0 },
      },
      include: {
        images: { take: 1 },
        shop: { select: { name: true } },
      },
    });

    return products.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      category: p.category,
      subCategory: p.subCategory,
      sale_price: p.sale_price,
      regular_price: p.regular_price,
      stock: p.stock,
      rating: p.rating,
      image: p.images[0]?.url || null,
      shopName: p.shop.name,
      shopId: p.shopId,
      brand: p.brand,
    }));
  } catch (error) {
    console.error("Error getting template products:", error);
    return [];
  }
}
