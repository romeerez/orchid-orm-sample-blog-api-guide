import { change } from "../dbScript";

change(async (db) => {
  await db.createTable("user", (t) => ({
    id: t.identity().primaryKey(),
    username: t.string().unique(),
    email: t.string().unique(),
    password: t.string(),
    ...t.timestamps(),
  }));
});
