import prisma from "@packages/libs/prisma";
import cron from "node-cron";

cron.schedule("0 * * * *", async () => {
  try {
    const now = new Date();
    // Delete products where deletedAt is older than 24 hours
    await prisma.products.deleteMany({
      where: {
        isDeleted: true,
        deleteAt: { lte: now },
      },
    });
  } catch (error) {
    console.log("Error in product cleanup cron job:", error);
  }
});
