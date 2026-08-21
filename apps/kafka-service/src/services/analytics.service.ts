import prisma from "@packages/libs/prisma";


export const updateUserAnalytics = async (event: any) => {
  try {
    const existingData = await prisma.userAnalytics.findUnique({
      where: {
        userId: event.userId,
      },
    });

    let updatedOptions: any = existingData?.actions || [];

    const actionExists = updatedOptions.some(
      (entry: any) =>
        entry.productId === event.productId && entry.action === event.action,
    );

    // Always store `product_view` for recommendation
    if (event.action === "product_view") {
      updatedOptions.push({
        productId: event?.productId,
        shopId: event.shopId,
        action: event.action,
        timestamp: new Date(),
      });
    } else if (
      ["add_to_cart", "add_to_wishlist"].includes(event.action) &&
      !actionExists
    ) {
      updatedOptions.push({
        productId: event?.productId,
        shopId: event.shopId,
        action: event?.action,
        timestamp: new Date(),
      });
    }

    // remove add_to_cart if remove_from_cart is triggered
    else if (event.action === "remove_from_cart") {
      updatedOptions = updatedOptions.filter(
        (entry: any) =>
          !(
            entry.productId === event.productId &&
            entry.action === "add_to_cart"
          ),
      );
    }

    // remove add_to_wishlist if remove_from_wishlist is triggered
    else if (event.action === "remove_from_wishlist") {
      updatedOptions = updatedOptions.filter(
        (entry: any) =>
          !(
            entry.productId === event.productId &&
            entry.action === "add_to_wishlist"
          ),
      );
    }

    // Keep only the last 100 actions (prevent storage overload)
    if (updatedOptions.length > 100) {
      updatedOptions.shift();
    }

    const extraFields: Record<string, any> = {};

    if (event.country) {
      extraFields.country = event.country;
    }

    if (event.city) {
      extraFields.city = event.city;
    }

    // Update or create user analytics
    await prisma.userAnalytics.upsert({
      where: { userId: event.userId },
      create: {
        userId: event.userId,
        lastVisited: new Date(),
        actions: updatedOptions,
        ...extraFields,
      },
      update: {
        userId: event?.userId,
        lastVisited: new Date(),
        actions: updatedOptions,
        ...extraFields,
      },
    });

    // Also update product analytics
  } catch (error) {}
};

export const updateProductAnalytics = async (event: any) => {
  try {
    if (!event.productId) return;

    // Define update fields dynamically
    const updateFields: any = {};

    if (event.action === "product_view") updateFields.views = { increment: 1 };
    if (event.action === "add_to_cart")
      updateFields.cartAdds = { increment: 1 };
    if (event.action === "remove_from_cart")
      updateFields.cartAdds = { decrement: 1 };
    if (event.action === "add_to_wishlist")
      updateFields.wishListAdds = { increment: 1 };
    if (event.action === "remove_from_wishlist")
      updateFields.wishListAdds = { decrement: 1 };
    if (event.action === "purchase") updateFields.purchases = { increment: 1 };

    // Update or create product analytics
    await prisma.productAnalytics.upsert({
      where: { productId: event.productId },
      update: {
        lastViewedAt: new Date(),
        ...updateFields, // Apply the correct increment field
      },
      create: {
        productId: event.productId,
        shopId: event.shopId || null,
        views: event.action === "product_view" ? 1 : 0,
        cartAdds: event.action === "add_to_cart" ? 1 : 0,
        wishListAdds: event.action === "add_to_wishlist" ? 1 : 0,
        purchases: event.action === "purchase" ? 1 : 0,
        lastViewedAt: new Date(),
      },
    });
  } catch (error) {
    console.log("Error updating product analytics", error);
  }
};
