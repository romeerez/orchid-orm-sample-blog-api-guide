import {
  getCurrentUserId,
  getOptionalCurrentUserId,
} from "../user/user.service";
import { z } from "zod";
import { UnauthorizedError } from "../../lib/errors";
import {
  articleCreateDTO,
  articleDTO,
  articleSlugDTO,
  articleUpdateDTO,
} from "./article.dto";
import { FastifyApp } from "../../app";
import { articleRepo } from "./article.repo";
import { db } from "../../db/db";
import { tagRepo } from "../tag/tag.repo";

export function articleRouter(app: FastifyApp) {
  app.get("/articles", {
    schema: {
      querystring: z.object({
        author: z.string().optional(),
        tag: z.string().optional(),
        feed: z.literal("true").optional(),
        favorite: z.literal("true").optional(),
        limit: z
          .preprocess((s) => parseInt(s as string), z.number().min(1).max(20))
          .default(20),
        offset: z
          .preprocess((s) => parseInt(s as string), z.number().min(0))
          .optional(),
      }),
      result: articleDTO.array(),
    },
    async handler(req) {
      // currentUserId will be an id for authorized, undefined for not authorized
      const currentUserId = getOptionalCurrentUserId(req);

      let query = articleRepo
        .selectDTO(currentUserId)
        .order({
          createdAt: "DESC",
        })
        // limit has default 20 in the params schema above
        .limit(req.query.limit)
        // offset parameter is optional, and it is fine to pass `undefined` to the .offset method
        .offset(req.query.offset);

      // filtering articles by author, tag, and other relations by using `whereExists`
      if (req.query.author) {
        query = query.filterByAuthorUsername(req.query.author);
      }

      if (req.query.tag) {
        query = query.filterByTag(req.query.tag);
      }

      if (req.query.feed ?? req.query.favorite) {
        if (!currentUserId) throw new UnauthorizedError();

        if (req.query.feed) {
          query = query.filterForUserFeed(currentUserId);
        }

        if (req.query.favorite) {
          query = query.filterFavorite(currentUserId);
        }
      }

      // query is Promise-like and will be awaited automatically
      return query;
    },
  });

  app.post("/articles", {
    schema: {
      body: articleCreateDTO,
      response: {
        200: articleDTO,
      },
    },
    async handler(req) {
      const currentUserId = getCurrentUserId(req);

      // wrap creating an article and retrieving it to the transaction
      return db.$transaction(async () => {
        const { tags, ...params } = req.body;

        const articleId = await db.article.get("id").create({
          ...params,
          favoritesCount: 0,
          userId: currentUserId,
          articleTags: {
            create: tags.map((name) => ({
              tag: {
                connectOrCreate: {
                  where: { name },
                  create: { name },
                },
              },
            })),
          },
        });

        return articleRepo.selectDTO(currentUserId).find(articleId);
      });
    },
  });

  app.patch("/articles/:slug", {
    schema: {
      body: articleUpdateDTO,
      params: articleSlugDTO,
      response: {
        200: articleDTO,
      },
    },
    async handler(req) {
      const currentUserId = getCurrentUserId(req);

      return db.$transaction(async () => {
        const { slug } = req.params;

        // retrieve required fields and the current tags of article
        const article = await articleRepo
          .findBy({ slug })
          .select("id", "userId", {
            tags: (q) => q.tags.select("id", "name"),
          });

        if (article.userId !== currentUserId) {
          throw new UnauthorizedError();
        }

        const { tags, ...params } = req.body;

        await articleRepo
          .find(article.id)
          .update(params)
          // updateTags is a repo method, see below
          .updateTags(article.tags, tags);

        return await articleRepo.selectDTO(currentUserId).find(article.id);
      });
    },
  });

  app.post("/articles/:slug/favorite", {
    schema: {
      body: z.object({
        favorite: z.boolean(),
      }),
      params: articleSlugDTO,
    },
    async handler(req) {
      const currentUserId = getCurrentUserId(req);
      const { slug } = req.params;
      const { favorite } = req.body;

      // assign favorites query to a variable to use it for different queries later:
      const favoritesQuery = db.article.findBy({ slug }).favorites;

      if (favorite) {
        try {
          await favoritesQuery.create({
            userId: currentUserId,
          });
        } catch (err) {
          // ignore case when an article is already favorited
          if (err instanceof db.articleFavorite.error && err.isUnique) {
            return;
          }
          throw err;
        }
      } else {
        await favoritesQuery
          .where({
            userId: currentUserId,
          })
          .delete();
      }
    },
  });

  app.delete("/articles/:slug", {
    schema: {
      params: articleSlugDTO,
    },
    async handler(req) {
      const currentUserId = getCurrentUserId(req);
      const { slug } = req.params;

      // wrapping in the transaction to search for an article and delete it in a single transaction
      await db.$transaction(async () => {
        const article = await db.article
          .select("id", "userId", {
            tagIds: (q) => q.tags.pluck("id"),
          })
          .findBy({ slug });

        if (article.userId !== currentUserId) {
          throw new UnauthorizedError();
        }

        // assign a query to a variable to reuse it
        const articleQuery = db.article.find(article.id);

        if (article.tagIds.length) {
          // before deleting a record need to delete all its related records
          // otherwise there would be an error complaining about a foreign key violation
          await articleQuery.articleTags.all().delete();
        }

        await articleQuery.delete();

        if (article.tagIds.length) {
          // tag repo with `deleteUnused` was defined before, at the step of updating the article
          await tagRepo.whereIn("id", article.tagIds).deleteUnused();
        }
      });
    },
  });
}
