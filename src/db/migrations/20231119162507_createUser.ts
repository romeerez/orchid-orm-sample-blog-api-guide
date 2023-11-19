import { change } from "../dbScript";

change(async (db) => {
  await db.createTable("user", (t) => ({
    id: t.identity().primaryKey(),
    username: t.text().unique(),
    email: t.text().unique(),
    password: t.text(),
    ...t.timestamps(),
  }));
});
