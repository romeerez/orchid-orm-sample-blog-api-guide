import { change } from "../dbScript";

change(async (db) => {
  await db.createTable("articleFavorite", (t) => ({
    userId: t.integer().foreignKey("user", "id"),
    articleId: t.integer().foreignKey("article", "id"),
    ...t.primaryKey(["userId", "articleId"]),
  }));
});
