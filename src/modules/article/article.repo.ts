import { createRepo } from "orchid-orm";
import { db } from "../../db/db";
import { userRepo } from "../user/user.repo";
import { tagRepo } from "../tag/tag.repo";

// define selectFavorite using `makeHelper` to use in multiple methods:
const selectFavorited = db.article.makeHelper(
  (q: typeof db.article, currentUserId: number | undefined) =>
    currentUserId
      ? q.favorites.where({ userId: currentUserId }).exists()
      : q.sql`false`.type((t) => t.boolean()),
);

export const articleRepo = createRepo(db.article, {
  queryMethods: {
    selectDTO(q, currentUserId: number | undefined) {
      return q.select(
        "slug",
        "title",
        "body",
        "favoritesCount",
        "createdAt",
        "updatedAt",
        {
          tags: (q) => q.tags.order("name").pluck("name"),
          // use selectFavorited from above
          favorited: () => selectFavorited(q, currentUserId),
          author: (q) => userRepo(q.author).selectDTO(currentUserId),
        },
      );
    },
    selectFavorited(q, currentUserId: number | undefined) {
      return q.select({ favorited: () => selectFavorited(q, currentUserId) });
    },
    filterByAuthorUsername(q, username: string) {
      return q.whereExists("author", (q) => q.where({ username }));
    },
    filterByTag(q, name: string) {
      return q.whereExists("tags", (q) => q.where({ name }));
    },
    filterForUserFeed(q, currentUserId: number) {
      return q.whereExists("author", (q) =>
        q.whereExists("follows", (q) => q.where({ followerId: currentUserId })),
      );
    },
    filterFavorite(q, currentUserId: number) {
      return q.whereExists("favorites", (q) =>
        q.where({ userId: currentUserId }),
      );
    },
  },
  queryOneWithWhereMethods: {
    async updateTags(
      q,
      // tags which article is connected to at the moment
      currentTags: { id: number; name: string }[],
      // tag names from user parameters to use for the article
      tags?: string[],
    ) {
      const currentTagNames = currentTags.map(({ name }) => name);
      const addTagNames = tags?.filter(
        (name) => !currentTagNames.includes(name),
      );
      const removeTagIds = tags
        ? currentTags
            .filter(({ name }) => !tags.includes(name))
            .map((tag) => tag.id)
        : [];

      await q.update({
        articleTags: {
          // note the `?` mark: nothing will happen if `addTagNames` is not defined
          create: addTagNames?.map((name) => ({
            tag: {
              connectOrCreate: {
                where: { name },
                create: { name },
              },
            },
          })),
          // won't delete anything if we pass an empty array
          delete: removeTagIds.length ? { tagId: { in: removeTagIds } } : [],
        },
      });

      if (removeTagIds.length) {
        // `deleteUnused` will be defined in a tag repo
        await tagRepo.whereIn("id", removeTagIds).deleteUnused();
      }
    },
  },
});
