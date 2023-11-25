import { change } from "../dbScript";

change(async (db) => {
  await db.createTable("article", (t) => ({
    id: t.identity().primaryKey(),
    userId: t.integer().foreignKey("user", "id").index(),
    slug: t.text().unique(),
    title: t.text(),
    body: t.text(),
    favoritesCount: t.integer(),
    ...t.timestamps(),
  }));
});
