import { orchidORM } from "orchid-orm";
import { config } from "../config";
import { UserTable } from "../modules/user/user.table";
import { UserFollowTable } from "../modules/user/userFollow.table";

export const db = orchidORM(
  {
    databaseURL: config.currentDatabaseUrl,
  },
  {
    user: UserTable,
    userFollow: UserFollowTable,
  },
);
