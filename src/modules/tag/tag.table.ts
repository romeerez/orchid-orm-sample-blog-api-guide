import { BaseTable } from "../../db/baseTable";
import { ArticleTagTable } from "../article/articleTag.table";

export class TagTable extends BaseTable {
  readonly table = "tag";
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
    ...t.timestamps(),
  }));

  relations = {
    articleTags: this.hasMany(() => ArticleTagTable, {
      columns: ["id"],
      references: ["tagId"],
    }),
  };
}
