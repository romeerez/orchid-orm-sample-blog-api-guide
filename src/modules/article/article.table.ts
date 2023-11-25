import { BaseTable } from "../../db/baseTable";
import { ArticleTagTable } from "./articleTag.table";
import { ArticleFavoriteTable } from "./articleFavorite.table";
import { UserTable } from "../user/user.table";
import { TagTable } from "../tag/tag.table";

export class ArticleTable extends BaseTable {
  readonly table = "article";
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    userId: t.integer().foreignKey("user", "id").index(),
    slug: t.text().unique().min(10).max(200),
    title: t.text().min(10).max(200),
    body: t.text().min(100).max(100000),
    favoritesCount: t.integer(),
    ...t.timestamps(),
  }));

  relations = {
    author: this.belongsTo(() => UserTable, {
      columns: ["userId"],
      references: ["id"],
      required: true,
    }),

    articleTags: this.hasMany(() => ArticleTagTable, {
      columns: ["id"],
      references: ["articleId"],
    }),

    tags: this.hasMany(() => TagTable, {
      through: "articleTags",
      source: "tag",
    }),

    favorites: this.hasMany(() => ArticleFavoriteTable, {
      columns: ["id"],
      references: ["articleId"],
    }),
  };
}
