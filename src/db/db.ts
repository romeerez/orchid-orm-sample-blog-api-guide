import { orchidORM } from "orchid-orm";
import { config } from "../config";
import { UserTable } from "../modules/user/user.table";
import { UserFollowTable } from "../modules/user/userFollow.table";
import { ArticleTable } from "../modules/article/article.table";
import { TagTable } from "../modules/tag/tag.table";
import { ArticleTagTable } from "../modules/article/articleTag.table";
import { ArticleFavoriteTable } from "../modules/article/articleFavorite.table";

export const db = orchidORM(
  {
    databaseURL: config.currentDatabaseUrl,
  },
  {
    user: UserTable,
    userFollow: UserFollowTable,
    article: ArticleTable,
    tag: TagTable,
    articleTag: ArticleTagTable,
    articleFavorite: ArticleFavoriteTable,
  },
);
