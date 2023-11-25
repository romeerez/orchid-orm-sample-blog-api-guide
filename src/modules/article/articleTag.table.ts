import { BaseTable } from "../../db/baseTable";
import { ArticleTable } from "./article.table";
import { TagTable } from "../tag/tag.table";

export class ArticleTagTable extends BaseTable {
  readonly table = "articleTag";
  columns = this.setColumns((t) => ({
    articleId: t.integer().foreignKey("article", "id"),
    tagId: t.integer().foreignKey("tag", "id"),
    ...t.primaryKey(["tagId", "articleId"]),
  }));

  relations = {
    article: this.belongsTo(() => ArticleTable, {
      columns: ["articleId"],
      references: ["id"],
    }),
    tag: this.belongsTo(() => TagTable, {
      columns: ["tagId"],
      references: ["id"],
    }),
  };
}
