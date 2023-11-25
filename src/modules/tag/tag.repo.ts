import { createRepo } from "orchid-orm";
import { db } from "../../db/db";

export const tagRepo = createRepo(db.tag, {
  queryMethods: {
    deleteUnused(q) {
      return q.whereNotExists("articleTags").delete();
    },
  },
});
