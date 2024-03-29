import { userDTO } from "../user/user.dto";
import { z } from "zod";
import { TagTable } from "../tag/tag.table";
import { ArticleTable } from "./article.table";

const tagListDTO = TagTable.outputSchema().shape.name.array();

export const articleDTO = ArticleTable.outputSchema()
  .pick({
    slug: true,
    title: true,
    body: true,
    favoritesCount: true,
    createdAt: true,
    updatedAt: true,
  })
  .and(
    z.object({
      tags: tagListDTO,
      favorited: z.boolean(),
      author: userDTO,
    }),
  );

export const articleCreateDTO = ArticleTable.inputSchema()
  .pick({
    slug: true,
    title: true,
    body: true,
  })
  .extend({
    tags: tagListDTO,
  });

export const articleUpdateDTO = articleCreateDTO
  .extend({
    favorite: z.boolean(),
  })
  .partial();

export const articleSlugDTO = ArticleTable.inputSchema().pick({ slug: true });
