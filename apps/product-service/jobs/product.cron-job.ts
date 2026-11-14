import prisma from "@packages/libs/prisma";
import cron from "node-cron";

cron.schedule("0 * * * *", async () => {
  try {
    const now = new Date();
    // Keep products referenced by order history or other records so cleanup
    // cannot break foreign-key relations or remove historical catalog data.
    await prisma.products.deleteMany({
      where: {
        isDeleted: true,
        deleteAt: { lte: now },
        orderItems: { none: {} },
        reviews: { none: {} },
        inventoryHistory: { none: {} },
        variants: { none: {} },
      },
    });
  } catch (error) {
    console.log("Error in product cleanup cron job:", error);
  }
});
