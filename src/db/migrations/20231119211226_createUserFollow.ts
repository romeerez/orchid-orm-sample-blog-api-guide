import { change } from "../dbScript";

change(async (db) => {
  await db.createTable("userFollow", (t) => ({
    followingId: t.integer().foreignKey("user", "id"),
    followerId: t.integer().foreignKey("user", "id"),
    ...t.primaryKey(["followingId", "followerId"]),
  }));
});
