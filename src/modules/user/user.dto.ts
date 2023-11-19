import { z } from "zod";
import { UserTable } from "./user.table";

// input data to register user
export const userRegisterDTO = UserTable.schema().pick({
  username: true,
  email: true,
  password: true,
});

// input data to login
export const userLoginDTO = UserTable.schema().pick({
  email: true,
  password: true,
});

// response data of register and login endpoints
export const authDTO = z.object({
  user: UserTable.schema().pick({
    id: true,
    username: true,
    email: true,
  }),
  token: z.string(),
});

// parameters to follow a user by username
export const usernameDTO = UserTable.schema().pick({
  username: true,
});

// will be used later in `articleDTO` for the article author object
export const userDTO = UserTable.schema()
  .pick({
    username: true,
  })
  .and(
    z.object({
      following: z.boolean(),
    }),
  );
