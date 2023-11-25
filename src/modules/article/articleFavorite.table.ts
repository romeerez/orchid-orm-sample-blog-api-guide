import { BaseTable } from "../../db/baseTable";
import { ArticleTable } from "./article.table";

export class ArticleFavoriteTable extends BaseTable {
  readonly table = "articleFavorite";
  columns = this.setColumns((t) => ({
    userId: t.integer().foreignKey("user", "id"),
    articleId: t.integer().foreignKey("article", "id"),
    ...t.primaryKey(["userId", "articleId"]),
  }));

  relations = {
    article: this.belongsTo(() => ArticleTable, {
      columns: ["articleId"],
      references: ["id"],
    }),
  };
}
