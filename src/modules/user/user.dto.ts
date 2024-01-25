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
