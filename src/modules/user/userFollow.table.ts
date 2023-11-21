import { BaseTable } from "../../db/baseTable";
import { UserTable } from "./user.table";

export class UserFollowTable extends BaseTable {
  readonly table = "userFollow";
  columns = this.setColumns((t) => ({
    // in the migration we have a string argument for the foreign table
    // in the model it can be a string as well, or as a callback with table class
    followingId: t.integer().foreignKey(() => UserTable, "id"),
    followerId: t.integer().foreignKey(() => UserTable, "id"),
    ...t.primaryKey(["followingId", "followerId"]),
  }));
}
