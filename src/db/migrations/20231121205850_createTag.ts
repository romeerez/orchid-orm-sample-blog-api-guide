import { change } from "../dbScript";

change(async (db) => {
  await db.createTable("tag", (t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
    ...t.timestamps(),
  }));
});
