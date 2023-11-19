import { orchidORM } from "orchid-orm";
import { config } from "../config";
import { UserTable } from "../modules/user/user.table";

export const db = orchidORM(
  {
    databaseURL: config.currentDatabaseUrl,
  },
  {
    user: UserTable,
  },
);
