import "dotenv/config";
import connectDB from "../db/index.js";
import { Product } from "../models/product.model.js";
import catalog from "../data/initialCatalog.json" with { type: "json" };

const syncCatalog = async () => {
  await connectDB();
  let inserted = 0;
  let updated = 0;

  try {
    for (const item of catalog) {
      const result = await Product.updateOne(
        { sku: item.sku },
        {
          $set: {
            name: item.name,
            slug: item.id,
            description: item.description,
            price: item.price,
            category: item.category,
            images: item.image ? [item.image] : [],
            specs: { sourceId: item.id, tierPricing: item.tierPricing || [] },
            isAvailable: true,
          },
          // Catalog stock initializes new SKUs only. Later runs preserve the
          // inventory count maintained by the backend.
          $setOnInsert: { stock: item.stock },
        },
        { upsert: true },
      );
      if (result.upsertedCount) inserted += 1;
      else if (result.modifiedCount) updated += 1;
    }
    console.log(`Catalog sync complete: ${inserted} products added, ${updated} products updated.`);
  } finally {
    await Product.db.close();
  }
};

syncCatalog().catch((error) => {
  console.error("Catalog sync failed:", error.message);
  process.exitCode = 1;
});
