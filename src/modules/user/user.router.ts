import { db } from "../../db/db";
import { comparePassword, encryptPassword } from "../../lib/password";
import { createToken } from "../../lib/jwt";
import { ApiError } from "../../lib/errors";
import {
  userRegisterDTO,
  authDTO,
  userLoginDTO,
  usernameDTO,
} from "./user.dto";
import { FastifyApp } from "../../app";
import { omit } from "../../lib/utils";
import { getCurrentUserId } from "./user.service";

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
