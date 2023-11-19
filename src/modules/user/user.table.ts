import { BaseTable } from "../../db/baseTable";

export class UserTable extends BaseTable {
  readonly table = "user";
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    username: t.string().unique().min(3).max(30),
    email: t.string().unique().email(),
    password: t.string().min(8),
    ...t.timestamps(),
  }));
}
