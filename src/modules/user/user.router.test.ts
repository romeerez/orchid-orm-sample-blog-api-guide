import { testRequest } from "../../lib/test/testRequest";
import { testFactory } from "../../lib/test/testFactory";
import { db } from "../../db/db";
import { useTestDatabase } from "../../lib/test/useTestDatabase";
import { verifyToken } from "../../lib/jwt";
import { comparePassword, encryptPassword } from "../../lib/password";

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

      const res = await testRequest
        .as(currentUser)
        .post(`/users/lalala/follow`);

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
});
