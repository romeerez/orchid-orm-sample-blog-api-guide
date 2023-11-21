import { BaseTable } from "../../db/baseTable";
import { UserFollowTable } from "./userFollow.table";

export class UserTable extends BaseTable {
  readonly table = "user";
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    username: t.string().unique().min(3).max(30),
    email: t.string().unique().email(),
    password: t.string().min(8),
    ...t.timestamps(),
  }));

  relations = {
    follows: this.hasMany(() => UserFollowTable, {
      columns: ["id"],
      references: ["followingId"],
    }),

    followings: this.hasMany(() => UserFollowTable, {
      columns: ["id"],
      references: ["followerId"],
    }),
  };
}
