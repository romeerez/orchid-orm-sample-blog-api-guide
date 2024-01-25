# Building A Sample App With Orchid ORM

This guide documents the process of creating of API server.
Here you can get an overall idea of how `Orchid ORM` looks and feels,
what problem it solves, and see the benefits and possible drawbacks.

The API server is for a blog site with users, articles, and tags, users can follow each other.
It is inspired by [realworld](https://github.com/gothinkster/realworld) API spec, slightly simplified.

This repository contains the full code. You can clone it, run `pnpm i`, `pnpm create`, `pnpm migrate` and `pnpm dev` to start the server,
`pnpm test` to run all tests.

## Table of contents

- [Initializing Project](#initializing-project)
- [Main Files Of Orchid ORM](#main-files-of-orchid-orm)
  - [Base Table](#base-table)
  - [appCodeUpdater](#appcodeupdater)
- [Test Utilities](#test-utilities)
- [User Endpoints](#user-endpoints)
  - [Migration](#migration)
  - [Table Class](#table-class)
  - [Tests For Registration](#tests-for-registration)
  - [Implementing Registration](#implementing-registration)
  - [Tests For Login Route](#tests-for-login-route)
  - [Implementing Login](#implementing-login)
  - [Follow And Unfollow](#implementing-login)
- [Articles Functionality](#articles-functionality)
  - [Article Related Tables](#article-related-tables)
  - [List Articles](#list-articles)
  - [Refactoring Code By Using Repo](#refactoring-code-by-using-repo)
  - [Create Article](#create-an-article)
  - [Update Article](#update-article)
  - [Mark And Unmark The Article As A Favorite](#mark-and-unmark-the-article-as-a-favorite)
  - [Delete An Article](#delete-an-article)

## Initializing Project

Running `pnpm create orchid-orm` launches the initializing script (see details in [Quickstart](https://orchid-orm.netlify.app/guide/quickstart.html) guide), it asks a several questions to initialize the project.

Choosing `tsx` to run `.ts` files, choosing timestamps as numbers. Opting-in for: test database, `Zod`, test factories. Skipping demo tables.

Setting up linters, pre-commit hooks, configuring server and test runner are important steps for setting up a project.
It is beyond the scope of this guide, here you can see commits for how it was done for this app:

- [configuring eslint, prettier, husky, lint-staged](https://github.com/romeerez/orchid-orm-sample-blog-api-guide/commit/5da67f506747291f95c5b2cb3dd93b1449d8f0d5).
- [configuring fastify server](https://github.com/romeerez/orchid-orm-sample-blog-api-guide/commit/f2eeccbe4d07a902695d758de08bb6bbe1c53482).
- [configuring vitest test runner](https://github.com/romeerez/orchid-orm-sample-blog-api-guide/commit/c8724087ae66ae1df0556124febdef7446b0294d).

Copy `.env.example` file to `.env.local`, edit postgres credentials and database name.

When having postgres locally, you can create databases with `pnpm db create`.
Or you can use a hosted database, then set `ssl=true` in the URLs in `.env.local` file.

## Main Files Of Orchid ORM

- [db](./src/db/db.ts): to set connection options, link all table files, export a `db` instance to use it across the app.
- [baseTable](./src/db/baseTable.ts): to customize column types and to set options that will be applied for all tables.
- [dbScript](./src/db/dbScript.ts): configure the migrations script that will be executed with `pnpm db [command]`.

### Base Table

Read more details in [these docs](https://orchid-orm.netlify.app/guide/orm-and-query-builder.html#defining-a-base-table).

`BaseTable` has a common configuration for all tables.

By default, Orchid ORM is assuming that columns in your database are named with `camelCase`.
Though it's not quite common, in this way ORM doesn't have to do name mappings.
Set `shakeCase: true` in case you want to have `snake_case` named column in a database,
and the ORM will map them to `camelCase` naming when loading records, will map namings back when inserting or updating.

For string column types, Orchid ORM offers `string` and `text` columns.
`string` is an alias for `varchar` with a database limit 255 by default.
It is also validated on app level when you're using `Zod` schemas derived from the table.
`text` has no limits on a database level, and can have validations on app level.

By default, the `text` column type has no strict validation bounds, user can potentially submit a limitless text.
Here you can set a default minimum and maximum for all `text` columns.
It can be later overridden for a specific column with `min` and `max` methods.

There are 3 ways to handle timestamps: as strings (ISO format), as numbers (epoch), and as `Date` objects.

`Date` object seems like an obvious choice, but remember that it would involve additional serializing and deserializing to JSON,
adds some difficulties to tests when asserting results, may lead to time-zone related bugs.

`schemaConfig: zodSchemaConfig` enables using a `Zod` schema that's automatically defined for each table.

Access the schema with `MyTable.inputSchema()` for validating incoming data, use `MyTable.outputSchema()` for validating data loaded from a database.

```ts
// src/db/baseTable

import { createBaseTable } from "orchid-orm";
import { zodSchemaConfig } from "orchid-orm-schema-to-zod";

export const BaseTable = createBaseTable({
  // Set `snakeCase` to `true` if columns in your database are in snake_case.
  // snakeCase: true,

  schemaConfig: zodSchemaConfig,

  // Customize column types for all tables.
  columnTypes: (t) => ({
    ...t,
    // Set min and max validations for all text columns,
    // it is only checked when validating with Zod schemas derived from the table.
    text: (min = 0, max = Infinity) => t.text(min, max),
    // Parse timestamps to number.
    timestamp: (precision?: number) => t.timestamp(precision).asNumber(),
  }),
});
```

### `appCodeUpdater`

In Orchid ORM, migrations are independent of app files.
That means that first you have to create a table in a migration, and then create a table definition file in the app.
There are plans to make this process smoother, like in some other ORMs, to generate migrations based on table files,
but we're not there yet.

To simplify this process, there is a `appCodeUpdater` option in the [db script file](./src/db/dbScript.ts):

```ts
export const change = rakeDb(databases, {
  // ...snip
  appCodeUpdater: appCodeUpdater({
    tablePath: (tableName) => `./tables/${tableName}.table.ts`,
    ormPath: "./db.ts",
  }),
  // set to false to disable code updater
  useCodeUpdater: process.env.NODE_ENV === "development",
});
```

After running a migration, it will automatically create a table file in case when new table was created,
and will update it accordingly when migration is altering the table.
It's not 100% reliable though, make sure the files were generated properly.

## Test Utilities

Orchid ORM offers handy utilities for tests: [testTransaction](https://orchid-orm.netlify.app/guide/transactions.html#testtransaction) and [Test Factories](https://orchid-orm.netlify.app/guide/test-factories.html).

For test transactions, there is a "hook" defined in [src/lib/test/useTestDatabase.ts](./src/lib/test/useTestDatabase.ts),
it will be called from tests to wrap up database connection.

Test factory is defined in [src/lib/test/testFactory](./src/lib/test/testFactory).

## User Endpoints

We are going to create endpoints for users to register, login, and be able to follow each other.

- **POST** `/users`: register new user

  - JSON payload:

    - **username**: string
    - **email**: string
    - **password**: string

  - Responds with user object and auth token

- **POST** `/users/auth`: login

  - JSON payload:

    - **email**: string
    - **password**: string

  - Responds with user object and auth token

- **POST** `/users/:username/follow`: follow a user

  - No payload and no response needed

- **DELETE** `/users/:username/follow`: unfollow a user

  - No payload and no response needed

Register and login responses should be of the following type:

```ts
type AuthResponse = {
  user: {
    id: number;
    username: string;
    email: string;
  };
  token: string;
};
```

### Migration

Generate a new migration file by running:

```shell
pnpm db new createUser
```

In the newly added file such content appears:

```ts
// src/db/migrations/*timestamp*_createUser.ts

import { change } from "../dbScript";

change(async (db) => {
  await db.createTable("user", (t) => ({}));
});
```

Add user columns and timestamps:

```ts
// src/db/migrations/*timestamp*_createUser.ts

import { change } from "../dbScript";

change(async (db) => {
  await db.createTable("user", (t) => ({
    id: t.identity().primaryKey(),
    username: t.string().unique(),
    email: t.string().unique(),
    password: t.string(),
    ...t.timestamps(),
  }));
});
```

`t.string()` is for `varchar(255)`, you can change the limit by passing a number argument: `t.string(500)`.

Apply the migration by running:

```shell
pnpm db migrate
```

This will create a new table in the database. If case you need to roll it back, run:

```shell
pnpm db rollback
```

### Table Class

Migration script was configured to generate table files by itself.

Check `src/db/tables/user.table.ts` - it should have the following content:

```ts
// src/modules/tables/user.ts

import { BaseTable } from "../baseTable";

export class UserTable extends BaseTable {
  readonly table = "user";
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    username: t.string().unique(),
    email: t.string().unique(),
    password: t.string(),
    ...t.timestamps(),
  }));
}
```

Note the `...t.timestamps()`: it adds timestamp columns `createdAt` and `updatedAt` with default `now()`.
When updating a record using ORM, `updatedAt` will be automatically set to a current timestamp.

`src/db/tables` is only a temporary destination, feel free to move files from here to where it feels better.

I prefer to structure app by modules, and moving this file to `src/modules/user/user.table.ts`.

There is an entry in `src/db/db.ts` for `UserTable`, it was also added automatically by running the migration.

The columns of tables can serve as a validation schema.
We can define that the `username` column is of `string` type, set a minimum and maximum length to it,
and the table definition becomes our source of knowledge for how to validate data.
To define it once and use in various places.

Note that `t.string()` has a default limit 255, it is set on a database level, and also will be checked with a validation on the app level.
Adding `.max(30)` overrides the validation limit, but not the database limit for this column.

```ts
// src/modules/user/user.table.ts

import { BaseTable } from "../../lib/baseTable";

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
```

Consider the `email` column:

```ts
t.string() // this is a column type
  .unique() // mark the column as `unique`, this is used by migration and by test factory
  .email(); // validates email when using `UserTable.inputSchema()`
```

Now that we have table class, and it is registered in [db.ts](./src/db/db.ts), we can write queries like `db.user.count()`, `db.user.select(...)`, and many others.

Define a test factory that we will use very soon for writing tests:

```ts
// src/lib/test/testFactory.ts

import { ormFactory } from "orchid-orm-test-factory";
import { db } from "../../db/db";

export const testFactory = ormFactory(db);
```

### Tests For Registration

Let's write tests for the first endpoint `POST /users`:

```ts
// src/modules/user/user.router.test.ts

import { testRequest } from "../../lib/test/testRequest";
import { testFactory } from "../../lib/test/testFactory";
import { db } from "../../db/db";
import { useTestDatabase } from "../../lib/test/useTestDatabase";

describe("user router", () => {
  useTestDatabase();

  describe("POST /users", () => {
    // pick params to use for this request
    const params = testFactory.user.pick({
      username: true,
      email: true,
      password: true,
    });

    it("should register a new user, save it with hashed password, return a user and a token", async () => {
      // build an object with randomly generated data
      const data = params.build();

      // perform a POST request to the /users endpoint with the data
      const res = await testRequest.post("/users", data);

      // ensure that response has a correct data
      const json = res.json();

      expect(json).toMatchObject({
        user: {
          username: data.username,
          email: data.email,
        },
        token: expect.any(String),
      });

      // check that the user was saved to the database with the correct fields
      const savedUser = await db.user.findBy({ username: data.username });
      expect(savedUser).toMatchObject({
        username: data.username,
        email: data.email,
      });

      // ensure that we don't store plain text passwords to the database
      expect(savedUser.password).not.toBe(data.password);

      expect(verifyToken(json.token)).toMatchObject({ id: savedUser.id });

      expect(await comparePassword(data.password, savedUser.password)).toBe(
        true,
      );
    });

    it("should return error when username is taken", async () => {
      // build new randomly generated params
      const data = params.build();
      // create a new user with this specific username
      await testFactory.user.create({ username: data.username });

      // perform request
      const res = await testRequest.post("/users", data);

      // expect error because a user with such username was created before the request
      expect(res.json()).toMatchObject({
        message: "Username is already taken",
      });
    });

    // similar to username test
    it("should return error when email is taken", async () => {
      const data = params.build();
      await testFactory.user.create({ email: data.email });

      const res = await testRequest.post("/users", data);

      expect(res.json()).toMatchObject({
        message: "Email is already taken",
      });
    });
  });
});
```

`testRequest` is a custom helper around `app.inject` from fastify to perform a fake request without the app running ([source file](./src/lib/test/testRequest.ts)).

`trpc` also has nice utilities for testing.
`express` doesn't have such tools and can be tested with real requests, it's recommended to use `axios` for this purpose.

### Implementing Registration

On real projects, the auth will be more sophisticated, but for demo purposes, let's do a simple token-based auth.

Add `JWT_SECRET` to the `.env.local` file and `config.ts`:

```ts
// src/config.ts

const env = z.object({
  // ...snip
  JWT_SECRET: z.string(),
});
```

Here are utility functions for JSON web tokens:

```ts
// src/lib/jwt.ts

import { JwtPayload, sign, verify } from "jsonwebtoken";
import { config } from "../config";

export const createToken = ({ id }: { id: number }): string => {
  return sign({ id }, config.env.JWT_SECRET);
};

export const verifyToken = (token: string): string | JwtPayload => {
  return verify(token, config.env.JWT_SECRET);
};
```

Utility functions for hashing and comparing passwords:

```ts
// src/lib/password.ts

import { hash, verify } from "argon2";

export function encryptPassword(password: string): Promise<string> {
  return hash(password);
}

export function comparePassword(
  password: string,
  hashed: string,
): Promise<boolean> {
  return verify(hashed, password).catch(() => false);
}
```

Now that we have `verifyToken` and `comparePassword`, we can use them in the test to check the token and the password:

```ts
it("should register a new user, save it with hashed password, return a user and a token", async () => {
  // ...snip

  expect(verifyToken(json.token)).toMatchObject({ id: savedUser.id });

  expect(await comparePassword(data.password, savedUser.password)).toBe(true);
});
```

To validate requests and responses data, let's create `user.dto.ts` file (dto stands for Data Transfer Object) with validation schemas:

```ts
// src/modules/user/user.dto.ts

import { z } from "zod";
import { UserTable } from "./user.table";

// input data to register user
export const userRegisterDTO = UserTable.inputSchema().pick({
  username: true,
  email: true,
  password: true,
});

// input data to login
export const userLoginDTO = UserTable.inputSchema().pick({
  email: true,
  password: true,
});

// response data of register and login endpoints
export const authDTO = z.object({
  user: UserTable.outputSchema().pick({
    id: true,
    username: true,
    email: true,
  }),
  token: z.string(),
});

// parameters to follow a user by username
export const usernameDTO = UserTable.inputSchema().pick({
  username: true,
});

// will be used later in `articleDTO` for the article author object
export const userDTO = UserTable.outputSchema()
  .pick({
    username: true,
  })
  .and(
    z.object({
      following: z.boolean(),
    }),
  );
```

Now we can write the registration route itself:

```ts
// src/modules/user/user.router.ts

import { db } from "../../db/db";
import { encryptPassword } from "../../lib/password";
import { createToken } from "../../lib/jwt";
import { ApiError } from "../../lib/errors";
import { userRegisterDTO, authDTO } from "./user.dto";
import { FastifyApp } from "../../app";

export function userRouter(app: FastifyApp) {
  app.post("/users", {
    schema: {
      body: userRegisterDTO,
      response: {
        200: authDTO,
      },
    },
    async handler(req) {
      try {
        const user = await db.user.select("id", "email", "username").create({
          ...req.body,
          password: await encryptPassword(req.body.password),
        });

        return {
          user,
          token: createToken({ id: user.id }),
        };
      } catch (err) {
        if (err instanceof db.user.error && err.isUnique) {
          if (err.columns.username) {
            throw new ApiError("Username is already taken");
          }
          if (err.columns.email) {
            throw new ApiError("Email is already taken");
          }
        }
        throw err;
      }
    },
  });
}
```

Consider the code for creating a user:

```ts
const user = await db.user.select("username", "email").create({
  ...req.body,
  password: await encryptPassword(req.body.password),
});
```

`select` before `create` changes `RETURNING` SQL statement, if we use `create` without `select` it will return a full record.

It is safe to use `...req.body` because `body` was validated and all unknown keys were stripped out of it.

Inside of error handler, first, we check `err instanceof db.user.error` to know if this error belongs to the user table,
then we check `err.isUnique` to ensure this is a unique violation error.
And then we check `err.columns.username` and `err.columns.email` to determine which column has failed uniqueness to throw the corresponding error.

Wiring up the router to fastify:

```ts
// src/app.ts

import { userRouter } from "./modules/user/user.router";

// ...snip

userRouter(app);
```

### Tests For Login Route

```ts
// src/modules/user/user.router.test.ts

describe("user router", () => {
  // ...snip

  describe("POST /users/auth", () => {
    it("should authorize user, return user object and auth token", async () => {
      const password = "password";
      const user = await testFactory.user.create({
        password: await encryptPassword(password),
      });

      const res = await testRequest.post("/users/auth", {
        email: user.email,
        password,
      });

      const json = res.json();
      expect(json).toMatchObject({
        user: {
          username: user.username,
          email: user.email,
        },
        token: expect.any(String),
      });

      expect(verifyToken(json.token)).toMatchObject({ id: user.id });
    });

    it("should return error when email is not registered", async () => {
      const res = await testRequest.post("/users/auth", {
        email: "not-registered@test.com",
        password: "password",
      });

      expect(res.json()).toMatchObject({
        message: "Email or password is invalid",
      });
    });

    it("should return error when password is invalid", async () => {
      const user = await testFactory.user.create();

      const res = await testRequest.post("/users/auth", {
        email: user.email,
        password: "invalid password",
      });

      expect(res.json()).toMatchObject({
        message: "Email or password is invalid",
      });
    });
  });
});
```

### Implementing Login

```ts
// src/modules/user/user.router.ts

export function userRouter(app: FastifyApp) {
  // ...snip

  app.post("/users/auth", {
    schema: {
      body: userLoginDTO,
      response: {
        200: authDTO,
      },
    },
    async handler(req) {
      const user = await db.user
        .select("id", "email", "username", "password")
        .findByOptional({
          email: req.body.email,
        });

      if (!user || !(await comparePassword(req.body.password, user.password))) {
        throw new ApiError("Email or password is invalid");
      }

      return {
        // omit is a utility defined in lib/utils.ts
        user: omit(user, "password"),
        token: createToken({ id: user.id }),
      };
    },
  });
}
```

In the user query note that we use `findByOptional` method, which returns `undefined` when not found.

There is a similar `findBy` method that would throw a `NotFoundError` when not found, but here we want to check it manually.

## Follow And Unfollow

Add a migration:

```sh
pnpm db new createUserFollow
```

```ts
// src/db/migrations/*timestamp*_createUserFollow.ts

import { change } from "../dbScript";

change(async (db) => {
  await db.createTable("userFollow", (t) => ({
    followingId: t.integer().foreignKey("user", "id"),
    followerId: t.integer().foreignKey("user", "id"),
    ...t.primaryKey(["followingId", "followerId"]),
  }));
});
```

This table has `followingId` for the user who is being followed, and the `followerId` for the one who follows.
Both these columns have `foreignKey` which connects it with an `id` of `user` to ensure that the value always points to an existing user record.

With such syntax `...t.primaryKey([column1, column2])` we define a composite primary key.
Internally Postgres will add a multi-column unique index and ensure that all of these columns are not null.

Apply it with `pnpm db migrate`, and `src/db/tables/userFollow.table.ts` will appear.

Move it to `src/modules/user` directory and modify:

```ts
// src/modules/user/userFollow.table.ts

import { BaseTable } from "../../db/baseTable";
import { UserTable } from "./user.table";

export class UserFollowTable extends BaseTable {
  readonly table = "userFollow";
  columns = this.setColumns((t) => ({
    // in the migration we have a string argument for the foreign table
    // in the model it can be a string as well, or as a callback with table class
    followingId: t.integer().foreignKey(() => UserTable, "id"),
    followerId: t.integer().foreignKey(() => UserTable, "id"),
    ...t.primaryKey(["followingId", "followerId"]),
  }));
}
```

Make sure the table file is linked in [db.ts](./src/db/db.ts).

Adding `followers` and `followings` relations to the user table:

```ts
// src/modules/user/user.table.ts

import { BaseTable } from "../../db/baseTable";
import { UserFollowTable } from "./userFollow.table";

export class UserTable extends BaseTable {
  // ...snip

  relations = {
    follows: this.hasMany(() => UserFollowTable, {
      columns: ["id"],
      references: ["followingId"],
    }),

    followings: this.hasMany(() => UserFollowTable, {
      columns: ["id"],
      references: ["followerId"],
    }),
  };
}
```

Tests for the follow/unfollow endpoints:

```ts
// src/modules/user/user.router.test.ts

describe("POST /users/:username/follow", () => {
  it("should follow a user", async () => {
    // create a user to perform the request from
    const currentUser = await testFactory.user.create();
    // create a user to follow
    const userToFollow = await testFactory.user.create();

    // perform request as a provided user
    await testRequest
      .as(currentUser)
      .post(`/users/${userToFollow.username}/follow`);

    // check that the userFollow record exists in the database
    const follows = await db.userFollow.where({
      followingId: userToFollow.id,
    });
    expect(follows).toEqual([
      {
        followerId: currentUser.id,
        followingId: userToFollow.id,
      },
    ]);
  });

  it("should return not found error when no user found by username", async () => {
    const currentUser = await testFactory.user.create();

    const res = await testRequest.as(currentUser).post(`/users/lalala/follow`);

    expect(res.json()).toEqual({
      message: "Record is not found",
    });
  });
});

describe("DELETE /users/:username/follow", () => {
  it("should unfollow a user", async () => {
    const currentUser = await testFactory.user.create();
    const userToFollow = await testFactory.user.create({
      follows: { create: [{ followerId: currentUser.id }] },
    });

    await testRequest
      .as(currentUser)
      .delete(`/users/${userToFollow.username}/follow`);

    const exists = await db.userFollow
      .where({
        followingId: userToFollow.id,
      })
      .exists();
    expect(exists).toEqual(false);
  });

  it("should return not found error when no user found by username", async () => {
    const currentUser = await testFactory.user.create();

    const res = await testRequest
      .as(currentUser)
      .delete(`/users/lalala/follow`);

    expect(res.json()).toEqual({
      message: "Record is not found",
    });
  });
});
```

Follow user router:

```ts
// src/modules/user/user.router.ts

export function userRouter(app: FastifyApp) {
  // ...snip

  app.post("/users/:username/follow", {
    schema: {
      params: usernameDTO,
    },
    async handler(req) {
      const userId = getCurrentUserId(req);

      await db.user
        .findBy({
          username: req.params.username,
        })
        .follows.create({
          followerId: userId,
        });
    },
  });
}
```

`getCurrentUserId` is a function to get the user id from the `JWT` token, the source is in [src/modules/user/user.service.ts](./src/modules/user/user.service.ts).

After defining the `follows` relation in the user table, `db.user` receives a `follows` property which allows doing different queries, and the code above shows the use of such chained `create` method.

If there is a need to do multiple queries it will wrap them in a transaction to prevent unexpected race conditions.

`Orchid ORM` strives to perform as few queries as possible to gain the maximum performance, and in this case, it does a single `INSERT ... SELECT ...` query, so it inserts `userFollow` from selecting the `user` record to use user id.

The `findBy` method will throw `NotFoundError` in case the record is not found, we can handle it in a global error handler (see [src/lib/errorHandler.ts](./src/lib/errorHandler.ts)):

```ts
if (error instanceof NotFoundError) {
  return res.status(404).send({
    message: "Record is not found",
  });
}
```

Unfollow user router:

```ts
// src/modules/user/user.router.ts

export function userRouter(app: FastifyApp) {
  // ...snip

  app.delete("/users/:username/follow", {
    schema: {
      params: usernameDTO,
    },
    async handler(req) {
      const userId = getCurrentUserId(req);

      const user = await db.user.findBy({
        username: req.params.username,
      });

      await db.user
        .follows(user)
        .where({
          followerId: userId,
        })
        .delete();
    },
  });
}
```

Here we perform two queries: find a user by a username, it will throw `NotFoundError` when no user found,
and the second query deletes all user follows.

`db.user.follows(user)` means to query user follows for a given user object.

## Articles Functionality

- **GET** `/articles`: get a list of articles

  - URI params:
    - **author**: filter articles by the username of the author
    - **tag**: filter articles by tag
    - **feed**: list articles only from authors which the current user is following
    - **favorite**: list only articles favorited by the current user
    - **limit**: limit articles
    - **offset**: offset articles
  - Responds with article data

- **POST** `/articles`: create a new article

  - JSON payload:
    - **slug**: string
    - **title**: string
    - **body**: string
    - **tags**: array of strings
  - Responds with article data

- **PATCH** `/articles/:slug`: update article

  - JSON payload:
    - **slug**?: string
    - **title**?: string
    - **body**?: string
    - **tags**?: array of strings
  - Responds with article data

- **POST** `/articles/:slug/favorite`

  - JSON payload:
    - **favorite**: true to make favorite, false to un-favorite the article
  - No response is needed

- **DELETE** `/articles/:slug`: delete article
  - No response is needed

The type of article response is:

```ts
type ArticleResponse = {
  slug: string;
  title: string;
  body: string;
  // how much users have favorited this article
  favoritesCount: number;
  // whether requesting user has favorited this article
  favorited: boolean;
  tags: string[];
  author: {
    username: string;
    // following means if the user who performs the request is following this user
    following: boolean;
  };

  // Postgres is returning dates in such format: `2022-11-04 10:53:02.129306 +00:00`
  // but this format is not supported by all browsers
  // As a bonus, both transferring and parsing date as an epoch number is more efficient, so let's use numbers for dates:
  createdAt: number;
  udpatedAt: number;
};
```

## Article Related Tables

Create migration files:

```sh
pnpm db new createArticle
pnpm db new createTag
pnpm db new createArticleTag
pnpm db new createArticleFavorite
```

Article table migration:

```ts
// src/db/migrations/*timestamp*_createArticle.ts
import { change } from "../dbScript";

change(async (db) => {
  await db.createTable("article", (t) => ({
    id: t.identity().primaryKey(),
    userId: t.integer().foreignKey("user", "id").index(),
    slug: t.text().unique(),
    title: t.text(),
    body: t.text(),
    favoritesCount: t.integer(),
    ...t.timestamps(),
  }));
});
```

Tag table migration:

```ts
// src/db/migrations/*timestamp*_createTag.ts
import { change } from "../dbScript";

change(async (db) => {
  await db.createTable("tag", (t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
    ...t.timestamps(),
  }));
});
```

Article tag join table migration:

```ts
// src/db/migrations/*timestamp*_createArticleTag.ts
import { change } from "../dbScript";

change(async (db) => {
  await db.createTable("articleTag", (t) => ({
    articleId: t.integer().foreignKey("article", "id"),
    tagId: t.integer().foreignKey("tag", "id"),
    ...t.primaryKey(["tagId", "articleId"]),
  }));
});
```

Article favorite join table migration:

```ts
// src/db/migrations/*timestamp*_createArticleFavorite.ts
import { change } from "../dbScript";

change(async (db) => {
  await db.createTable("articleFavorite", (t) => ({
    userId: t.integer().foreignKey("user", "id"),
    articleId: t.integer().foreignKey("article", "id"),
    ...t.primaryKey(["userId", "articleId"]),
  }));
});
```

Run migrations with `pnpm db migrate`.

Move the tables from `src/modules/tables` to `src/modules/...` directories, and modify them to have relations.

Tag table:

```ts
// src/module/tag/tag.table.ts
import { BaseTable } from "../../lib/baseTable";
import { ArticleTagTable } from "./articleTag.table";

export class TagTable extends BaseTable {
  readonly table = "tag";
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    // added min and max validations
    name: t.string().min(3).max(20),
    ...t.timestamps(),
  }));

  relations = {
    articleTags: this.hasMany(() => ArticleTagTable, {
      columns: ["id"],
      references: ["tagId"],
    }),
  };
}
```

The tag table has no relations in the example above, but only because they're not needed in future queries.
`Orchid ORM` is designed to deal with circular dependencies without problems,
so `TagTable` can use `ArticleTable` in the relation, and `ArticleTable` can have `TagTable` in the relation at the same time.

Article tag table:

```ts
// src/modules/article/articleTag.table.ts
import { BaseTable } from "../../lib/baseTable";
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
```

Article favorite table:

```ts
// src/modules/article/articleFavorite.table.ts
import { BaseTable } from "../../lib/baseTable";

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
```

Article table:

```ts
// src/modules/article/article.table.ts
import { BaseTable } from "../../lib/baseTable";
import { UserTable } from "../user/user.table";
import { ArticleTagTable } from "./articleTag.table";
import { TagTable } from "../tag/tag.table";
import { ArticleFavoriteTable } from "./articleFavorite.table";

export class ArticleTable extends BaseTable {
  readonly table = "article";
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    userId: t.integer().foreignKey("user", "id").index(),
    // it is important to set `min` and `max` for text fields
    // to make sure that the user won't submit empty strings or billion chars long strings:
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

    articleFavorites: this.hasMany(() => ArticleFavoriteTable, {
      columns: ["id"],
      references: ["articleId"],
    }),
  };
}
```

Make sure all tables are linked in `db.ts`.

## List Articles

Tests for the `GET /articles` endpoint:

```ts
// src/modules/article/article.router.test

import { testFactory } from "../../lib/test/testFactory";
import { testRequest } from "../../lib/test/testRequest";
import { itShouldRequireAuth } from "../../lib/test/testUtils";

describe("article router", () => {
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
});
```

Note that all nested create code of the `testFactory.user` and `testFactory.article` is also applicable to the `db.user` and `db.article`.

`itShouldRequireAuth` is a utility for tests to save some lines of code when testing protected routes.

```ts
// src/lib/test/testUtils.ts
export const itShouldRequireAuth = (
  req: () => Promise<{ statusCode: number; json(): unknown }>,
) => {
  it("should require authorization", async () => {
    const res = await req();
    expectUnauthorized(res);
  });
};

export function expectUnauthorized(res: {
  statusCode: number;
  json(): unknown;
}) {
  expect(res.statusCode).toBe(401);
  expect(res.json()).toEqual({
    message: "Unauthorized",
  });
}
```

Define the `articleDTO` schema, it will be used for response in `GET /articles`, `PATCH /articles/:id`, `POST /articles`,
so better to have it separately:

```ts
// src/modules/article/article.dto.ts

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
```

Article router code:

```ts
import { getOptionalCurrentUserId } from "../user/user.service";
import { z } from "zod";
import { UnauthorizedError } from "../../lib/errors";
import { articleDTO } from "./article.dto";
import { db } from "../../db/db";
import { FastifyApp } from "../../app";

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

      let query = db.article
        .select(
          "slug",
          "title",
          "body",
          "favoritesCount",
          "createdAt",
          "updatedAt",
          {
            // `pluck` method collects a column into an array
            // order is ASC by default
            tags: (q) => q.tags.order("name").pluck("name"),
            favorited: (q) =>
              currentUserId
                ? // if currentUserId is defined, return exists query
                  q.favorites.where({ userId: currentUserId }).exists()
                : // if no currentUserId, return raw 'false' SQL of boolean type
                  q.sql`false`.type((t) => t.boolean()),
            author: (q) =>
              q.author.select("username", {
                // we load the following similar to the favorited above
                following: currentUserId
                  ? (q) =>
                      q.follows.where({ followerId: currentUserId }).exists()
                  : q.sql`false`.type((t) => t.boolean()),
              }),
          },
        )
        .order({
          createdAt: "DESC",
        })
        // limit has default 20 in the params schema above
        .limit(req.query.limit)
        // offset parameter is optional, and it is fine to pass `undefined` to the .offset method
        .offset(req.query.offset);

      // filtering articles by author, tag, and other relations by using `whereExists`
      if (req.query.author) {
        query = query.whereExists("author", (q) =>
          q.where({ username: req.query.author }),
        );
      }

      if (req.query.tag) {
        query = query.whereExists("tags", (q) =>
          q.where({ name: req.query.tag }),
        );
      }

      if (req.query.feed ?? req.query.favorite) {
        if (!currentUserId) throw new UnauthorizedError();

        if (req.query.feed) {
          query = query.whereExists("author", (q) =>
            // `whereExists` can be nested to filter by the relation of the relation
            q.whereExists("follows", (q) =>
              q.where({ followerId: currentUserId }),
            ),
          );
        }

        if (req.query.favorite) {
          query = query.whereExists("favorites", (q) =>
            q.where({ userId: currentUserId }),
          );
        }
      }

      // query is Promise-like and will be awaited automatically
      return query;
    },
  });
}
```

Connect this router to the server:

```ts
// src/app.ts

import { articleRouter } from "./modules/article/article.router";

// ...snip

articleRouter(app);
```

## Refactoring Code By Using Repo

Currently, the code for listing articles looks messy: too many things are happening,
too many query details to read the code quickly and clearly.

Here I want to tell about one special feature of the `Orchid ORM` which doesn't exist in other node.js ORMs.

Let's start from the article's `author` field: querying author includes some nuances specific to the user table,
better to keep such queries encapsulated inside the related feature folder.

Create a new file `user.repo.ts` with the content:

```ts
// src/modules/user/user.repo.ts

import { createRepo } from "orchid-orm";
import { db } from "../../db/db";

export const userRepo = createRepo(db.user, {
  queryMethods: {
    selectDTO(q, currentUserId: number | undefined) {
      return q.select("username", {
        following: currentUserId
          ? (q) => q.follows.where({ followerId: currentUserId }).exists()
          : q.sql`false`.type((t) => t.boolean()),
      });
    },
  },
});
```

And now we can simplify querying the `author` object in the articles` router:

```ts
// src/article/article.router.ts

import { userRepo } from "../user/user.repo";

app.get("/articles", {
  // ...snip
  async handler(req) {
    let query = db.article.select(
      // ...snip
      {
        // ...snip
        author: (q) => userRepo(q.author).selectDTO(currentUserId),
      },
    );

    // ...snip
  },
});
```

Note that in the `user.repo.ts` the `selectDTO` has two arguments: first is a user query, and second is `currentUserId`.

The first argument is injected automatically, so in the router, we are only passing the rest of the arguments.
An editor can be confused by this and print a warning, but TypeScript understands it well,
if you put a string instead of `currentUserId` TS will show an error.

Later we will load the same article fields in other endpoints,
and it makes sense for both readability and re-usability to move the common selection of articles into `articleRepo.selectDTO`:

```ts
// src/modules/article/article.repo.ts

import { createRepo } from "orchid-orm";
import { db } from "../../db/db";
import { userRepo } from "../user/user.repo";

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
          favorited: currentUserId
            ? (q) => q.favorites.where({ userId: currentUserId }).exists()
            : q.sql`false`.type((t) => t.boolean()),
          author: (q) => userRepo(q.author).selectDTO(currentUserId),
        },
      );
    },
  },
});
```

When using the repo in a subquery, as we did for the `author` field, need to wrap a subquery into a repo like `userRepo(q.user).selectDTO(...)`.

But if the repo is not inside the subquery, you can use the repo object directly to build queries:

```ts
// src/article/article.router.ts

import { userRepo } from "../user/user.repo";

app.get("/articles", {
  // ...snip
  async handler(req) {
    const currentUserId = getOptionalCurrentUserId(req);

    let query = articleRepo
      .selectDTO(currentUserId)
      .order({
        createdAt: "DESC",
      })
      .limit(req.query.limit)
      .offset(req.query.offset);

    // ...snip
  },
});
```

Let's move all article filtering logic into repo methods:

```ts
// src/modules/article/article.repo.ts

import { createRepo } from "orchid-orm";
import { db } from "../../db/db";
import { userRepo } from "../user/user.repo";

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
          favorited: currentUserId
            ? (q) => q.favorites.where({ userId: currentUserId }).exists()
            : q.sql`false`.type((t) => t.boolean()),
          author: (q) => userRepo(q.author).selectDTO(currentUserId),
        },
      );
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
});
```

And now the article router can look so fabulous:

```ts
// src/article/article.router.ts

app.get("/articles", {
  // ...snip
  async handler(req) {
    const currentUserId = getOptionalCurrentUserId(req);

    let query = articleRepo
      .selectDTO(currentUserId)
      .order({
        createdAt: "DESC",
      })
      .limit(req.query.limit)
      .offset(req.query.offset);

    if (req.query.author) {
      query = query.filterByAuthorUsername(req.query.author);
    }

    if (req.query.tag) {
      query = query.filterByTag(req.query.tag);
    }

    if (req.query.feed || req.query.favorite) {
      if (!currentUserId) throw new UnauthorizedError();

      if (req.query.feed) {
        query = query.filterForUserFeed(currentUserId);
      }

      if (req.query.favorite) {
        query = query.filterFavorite(currentUserId);
      }
    }

    return query;
  },
});
```

With the help of repositories, the router code became more than twice shorter,
each repo method can be reused individually in other routers or other repositories,
the code became easy to read and grasp.

## Create An Article

Here is the test for creating an article:

```ts
// src/modules/article/article.router.test.ts

describe("article router", () => {
  // ...snip

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
});
```

Implementation of the router:

```ts
// src/modules/article/article.dto.ts

export const articleCreateDTO = ArticleTable.inputSchema()
  .pick({
    slug: true,
    title: true,
    body: true,
  })
  .extend({
    tags: tagListDTO,
  });
```

```ts
// src/modules/article/article.router.ts

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
```

This example demonstrates the use of nested `create` with nested `connectOrCreate`:
it will try to find a tag by name and will create a tag only if not found.

## Update Article

One specific thing which is needed to be tested properly is tags:
when the user is updating article tags, the app should create new tag records in case they didn't exist before,
it should delete tags that aren't used by any article, and connect the article to all tags properly.

So if in the future the app will have a tags endpoint that lists all tags, there won't be duplicates.

Tests for the endpoint:

```ts
describe("article router", () => {
  // ...snip

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
});
```

Implementation:

```ts
// src/modules/article/article.dto.ts

export const articleUpdateDTO = articleCreateDTO
  .extend({
    favorite: z.boolean(),
  })
  .partial();

export const articleSlugDTO = ArticleTable.inputSchema().pick({ slug: true });
```

```ts
// src/modules/article/article.router.ts

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

      const { tags, favorite, ...params } = req.body;

      await articleRepo
        .find(article.id)
        .update(params)
        // updateTags is a repo method, see below
        .updateTags(article.tags, tags);

      return await articleRepo.selectDTO(currentUserId).find(article.id);
    });
  },
});
```

The logic for updating tags is complex enough, so it is encapsulated into the article repo.

```ts
// src/modules/article/article.repo.ts

import { createRepo } from "orchid-orm";
import { db } from "../../db/db";

export const articleRepo = createRepo(db.article, {
  queryMethods: {
    // ...snip
  },
  queryOneWithWhereMethods: {
    async updateTags(q) {
      // TODO
    },
  },
});
```

All previous repo methods were placed under `queryMethods`, but here we place it under the `queryOneWithWhereMethods`.
The difference is in the type of the `q` parameter.

It is forbidden to create related records from the query which returns multiple records, for example:

```ts
// will result in a TS error
db.article.where({ id: { in: [1, 2, 3] } }).update({
  articleTags: {
    create: { ...someData },
  },
});
```

This code not only creates new `articleTags` but also connects them to the article.
If we select 3 articles and create `articleTags` for the query it wouldn't make much sense because a single `articleTag` can be connected to a single `article` only, but cannot connect to many.

That's why the type of `q` have to indicate that it is returning a single record.

Also, the `update` query must be applied only after we pass search conditions, to make sure we won't update all records in the database by mistake.

```ts
// will result in TS error
db.article.update({ ...data });
```

That's why the type of `q` have to indicate it has some search statements.
So we placed a new query method into `queryOneWithWhereMethods` where `q` is promised to have search conditions and to search for a single record.

Here is the `updateTags` implementation:

```ts
// src/modules/article/article.repo.ts

import { createRepo } from "orchid-orm";
import { db } from "../../db";
import { tagRepo } from "./tag.repo";

export const articleRepo = createRepo(db.article, {
  queryMethods: {
    // ...snip
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
```

This method doesn't return a query object, so it cannot be chained.
This is a limitation for the case when you want to await a query inside the method of repo.

`deleteUnused` is not complex and could be inlined, but it feels good to move the code to places where it feels like home.
It is not a concern of the article to know what an unused tag is, it is a concern of a tag, so it belongs to the tag repo:

```ts
// src/modules/tag/tag.repo.ts

import { createRepo } from "orchid-orm";
import { db } from "../../db/db";

export const tagRepo = createRepo(db.tag, {
  queryMethods: {
    deleteUnused(q) {
      return q.whereNotExists("articleTags").delete();
    },
  },
});
```

## Mark And Unmark The Article As A Favorite

Tests:

```ts
// src/modules/article/article.router.test.ts

describe("article router", () => {
  // ...snip

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
});
```

Define `.selectFavorite` to use in this test and the router later:

It is not possible to use one method from another due to some TS limitations, so the way to do it is to define a standalone function.

```ts
// src/modules/article/article.repo.ts

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
    // ...snip
  },
  // ...snip
});
```

Controller code:

```ts
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
```

## Delete An Article

Tests for the future endpoint:

```ts
// src/modules/article/article.router.test.ts

describe("article router", () => {
  // ...snip

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
```

Router code:

```ts
// src/modules/article/article.router.ts

export const deleteArticleRoute = routeHandler(
  {
    params: articleSlugDTO,
  },
  async (req) => {
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
);
```
