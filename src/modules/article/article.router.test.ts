import { testFactory } from "../../lib/test/testFactory";
import { testRequest } from "../../lib/test/testRequest";
import {
  expectUnauthorized,
  itShouldRequireAuth,
} from "../../lib/test/testUtils";
import { useTestDatabase } from "../../lib/test/useTestDatabase";
import { db } from "../../db/db";
import { articleRepo } from "./article.repo";

describe("article router", () => {
  useTestDatabase();

  describe("GET /articles", () => {
    it("should load articles for public request, favorited and author following fields must be false, newer articles should go first", async () => {
      const author = await testFactory.user.create();
      await testFactory.article.createList(2, { userId: author.id });

      const res = await testRequest.get("/articles");

      const data = res.json();
      expect(data.length).toBe(2);

      const [first, second] = data;
      expect(first.favorited).toBe(false);
      expect(first.author.following).toBe(false);
      expect(first.createdAt).toBeGreaterThan(second.createdAt);
    });

    it("should load articles for authorized user, favorited and author following fields must have proper values, newer articles should go first", async () => {
      const currentUser = await testFactory.user.create();

      const notFollowedAuthor = await testFactory.user.create();
      await testFactory.article.create({ userId: notFollowedAuthor.id });

      const followedAuthor = await testFactory.user.create({
        follows: {
          create: [
            {
              followerId: currentUser.id,
            },
          ],
        },
      });

      await testFactory.article.create({
        userId: followedAuthor.id,
        favorites: {
          create: [
            {
              userId: currentUser.id,
            },
          ],
        },
      });

      const res = await testRequest.as(currentUser).get("/articles");

      const data = res.json();
      const [first, second] = data;

      expect(second.favorited).toBe(false);
      expect(second.author.following).toBe(false);

      expect(first.favorited).toBe(true);
      expect(first.author.following).toBe(true);
    });

    describe("query params", () => {
      describe("author", () => {
        it("should filter articles by username of author", async () => {
          const [author1, author2] = await testFactory.user.createList(2);

          await testFactory.article.create({ userId: author1.id });
          await testFactory.article.create({ userId: author2.id });

          const res = await testRequest.get("/articles", {
            query: {
              author: author1.username,
            },
          });

          const data = res.json();
          expect(data.length).toBe(1);
          expect(data[0].author.username).toBe(author1.username);
        });
      });

      describe("tag", () => {
        it("should filter articles by tag", async () => {
          const author = await testFactory.user.create();

          // create article with matching tag
          await testFactory.article.create({
            userId: author.id,
            articleTags: {
              create: ["one", "two"].map((name) => ({
                tag: {
                  create: {
                    name,
                  },
                },
              })),
            },
          });

          // create article with different tags
          await testFactory.article.create({
            userId: author.id,
            articleTags: {
              create: ["three", "four"].map((name) => ({
                tag: {
                  create: {
                    name,
                  },
                },
              })),
            },
          });

          // create article without tags
          await testFactory.article.create({ userId: author.id });

          const res = await testRequest.get("/articles", {
            query: {
              tag: "one",
            },
          });

          const data = res.json();
          expect(data.length).toBe(1);
          expect(data[0].tags).toEqual(["one", "two"]);
        });
      });

      describe("feed", () => {
        itShouldRequireAuth(() =>
          testRequest.get("/articles", {
            query: {
              feed: "true",
            },
          }),
        );

        it("should return articles from followed authors for authorized user", async () => {
          const currentUser = await testFactory.user.create();
          const unfollowedAuthor = await testFactory.user.create();
          const followedAuthor = await testFactory.user.create({
            follows: {
              create: [
                {
                  followerId: currentUser.id,
                },
              ],
            },
          });

          const expectedArticles = await testFactory.article.createList(2, {
            userId: followedAuthor.id,
          });

          await testFactory.article.createList(2, {
            userId: unfollowedAuthor.id,
          });

          const res = await testRequest.as(currentUser).get("/articles", {
            query: {
              feed: "true",
            },
          });

          const data = res.json();
          expect(data.length).toBe(2);
          expect(data).toMatchObject(
            expectedArticles
              .reverse()
              .map((article) => ({ slug: article.slug })),
          );
        });
      });

      describe("favorite", () => {
        itShouldRequireAuth(() =>
          testRequest.get("/articles", {
            query: {
              favorite: "true",
            },
          }),
        );

        it("should returns only articles favorited by current user", async () => {
          const [currentUser, author] = await testFactory.user.createList(2);

          const favoritedArticles = await testFactory.article.createList(2, {
            userId: author.id,
            favorites: {
              create: [
                {
                  userId: currentUser.id,
                },
              ],
            },
          });

          await testFactory.article.create({ userId: author.id });

          const res = await testRequest.as(currentUser).get("/articles", {
            query: {
              favorite: "true",
            },
          });

          const data = res.json();
          expect(data).toMatchObject(
            favoritedArticles
              .reverse()
              .map((article) => ({ slug: article.slug })),
          );
        });
      });
    });
  });

  describe("POST /articles", () => {
    const params = testFactory.article
      .pick({
        slug: true,
        title: true,
        body: true,
      })
      .build();

    itShouldRequireAuth(() =>
      testRequest.post("/articles", {
        ...params,
        tags: [],
      }),
    );

    it("should create article without tags, return articleDTO", async () => {
      const currentUser = await testFactory.user.create();

      const res = await testRequest.as(currentUser).post("/articles", {
        ...params,
        tags: [],
      });

      const data = res.json();
      expect(data.tags).toEqual([]);
      expect(data.author.username).toBe(currentUser.username);
    });

    it("should create article and tags, should connect existing tags, return articleDTO", async () => {
      const currentUser = await testFactory.user.create();
      const tagId = await db.tag.get("id").create({ name: "one" });

      const res = await testRequest.as(currentUser).post("/articles", {
        ...params,
        tags: ["one", "two"],
      });

      const data = res.json();
      expect(data.tags).toEqual(["one", "two"]);
      expect(data.favorited).toBe(false);
      expect(data.author.username).toBe(currentUser.username);
      expect(data.author.following).toBe(false);

      const savedArticle = await db.article
        .findBy({ slug: data.slug })
        .select("slug", "title", "body", {
          tags: (q) => q.tags.order("name"),
        });

      expect(savedArticle).toMatchObject(params);
      expect(savedArticle.tags).toMatchObject([
        {
          id: tagId,
          name: "one",
        },
        {
          name: "two",
        },
      ]);
    });
  });

  describe("PATCH /articles/:slug", () => {
    const params = testFactory.article
      .pick({
        slug: true,
        title: true,
        body: true,
      })
      .build();

    // this test helper was defined earlier
    itShouldRequireAuth(() =>
      testRequest.patch("/articles/article-slug", params),
    );

    it("should return unauthorized error when trying to update article of other user", async () => {
      const currentUser = await testFactory.user.create();
      const author = await testFactory.user.create();
      const article = await testFactory.article.create({
        userId: author.id,
      });

      const res = await testRequest
        .as(currentUser)
        .patch(`/articles/${article.slug}`, params);

      // this test helper was defined earlier
      expectUnauthorized(res);
    });

    it("should update article fields", async () => {
      const currentUser = await testFactory.user.create();
      const article = await testFactory.article.create({
        userId: currentUser.id,
      });

      const res = await testRequest
        .as(currentUser)
        .patch(`/articles/${article.slug}`, params);

      const data = res.json();
      expect(data).toMatchObject(params);
    });

    it("should set new tags to article, create new tags, delete not used tags", async () => {
      const [currentUser, otherAuthor] = await testFactory.user.createList(2);

      const article = await testFactory.article.create({
        userId: currentUser.id,
        articleTags: {
          create: ["one", "two"].map((name) => ({
            tag: {
              create: {
                name,
              },
            },
          })),
        },
      });

      await testFactory.article.create({
        userId: otherAuthor.id,
        articleTags: {
          create: ["two", "three"].map((name) => ({
            tag: {
              create: {
                name,
              },
            },
          })),
        },
      });

      const res = await testRequest
        .as(currentUser)
        .patch(`/articles/${article.slug}`, {
          tags: ["two", "new tag"],
        });

      const data = res.json();
      expect(data.tags).toEqual(["new tag", "two"]);

      const allTagNames = await db.tag.pluck("name");
      expect(allTagNames).not.toContain("one");
    });
  });

  describe("POST /articles/:slug/favorite", () => {
    it("should mark article as favorited when passing true", async () => {
      const [currentUser, author] = await testFactory.user.createList(2);
      const article = await testFactory.article.create({
        userId: author.id,
      });

      await testRequest
        .as(currentUser)
        .post(`/articles/${article.slug}/favorite`, {
          favorite: true,
        });

      const { favorited } = await articleRepo
        .find(article.id)
        // .selectFavorited will be defined in articleRepo later
        .selectFavorited(currentUser.id);
      expect(favorited).toBe(true);
    });

    it("should not fail when passing true and article is already favorited", async () => {
      const [currentUser, author] = await testFactory.user.createList(2);
      const article = await testFactory.article.create({
        userId: author.id,
        favorites: {
          create: [
            {
              userId: currentUser.id,
            },
          ],
        },
      });

      const res = await testRequest
        .as(currentUser)
        .post(`/articles/${article.slug}/favorite`, {
          favorite: true,
        });

      expect(res.statusCode).toBe(200);
    });

    it("should unmark article as favorited when passing false", async () => {
      const [currentUser, author] = await testFactory.user.createList(2);
      const article = await testFactory.article.create({
        userId: author.id,
        favorites: {
          create: [
            {
              userId: currentUser.id,
            },
          ],
        },
      });

      await testRequest
        .as(currentUser)
        .post(`/articles/${article.slug}/favorite`, {
          favorite: false,
        });

      const { favorited } = await articleRepo
        .find(article.id)
        .selectFavorited(currentUser.id);
      expect(favorited).toBe(false);
    });

    it("should not fail when article is not favorited and passing false", async () => {
      const [currentUser, author] = await testFactory.user.createList(2);
      const article = await testFactory.article.create({
        userId: author.id,
      });

      const res = await testRequest
        .as(currentUser)
        .post(`/articles/${article.slug}/favorite`, {
          favorite: false,
        });

      expect(res.statusCode).toBe(200);
    });
  });

  describe("DELETE /articles/:slug", () => {
    itShouldRequireAuth(() => testRequest.delete("/articles/article-slug"));

    it("should return unauthorized error when trying to delete article of other user", async () => {
      const [currentUser, author] = await testFactory.user.createList(2);
      const article = await testFactory.article.create({
        userId: author.id,
      });

      const res = await testRequest
        .as(currentUser)
        .delete(`/articles/${article.slug}`);

      expectUnauthorized(res);
    });

    it("should delete article", async () => {
      const currentUser = await testFactory.user.create();
      const article = await testFactory.article.create({
        userId: currentUser.id,
      });

      await testRequest.as(currentUser).delete(`/articles/${article.slug}`);

      const exists = await db.article.find(article.id).exists();
      expect(exists).toBe(false);
    });

    it("should delete unused tags, and leave used tags", async () => {
      const currentUser = await testFactory.user.create();
      const article = await testFactory.article.create({
        userId: currentUser.id,
        articleTags: {
          create: ["one", "two"].map((name) => ({
            tag: {
              create: {
                name,
              },
            },
          })),
        },
      });

      await testFactory.article.create({
        userId: currentUser.id,
        articleTags: {
          create: ["two", "three"].map((name) => ({
            tag: {
              connectOrCreate: {
                where: { name },
                create: { name },
              },
            },
          })),
        },
      });

      await testRequest.as(currentUser).delete(`/articles/${article.slug}`);

      const allTagNames = await db.tag.pluck("name");
      expect(allTagNames).toEqual(["two", "three"]);
    });
  });
});
