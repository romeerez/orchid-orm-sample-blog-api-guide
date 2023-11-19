import { z } from "zod";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const env = z
  .object({
    PORT: z.number().default(3000),
    NODE_ENV: z
      .union([
        z.literal("development"),
        z.literal("production"),
        z.literal("test"),
      ])
      .default("development"),
    DATABASE_URL: z.string(),
    DATABASE_TEST_URL: z.string().optional(),
    JWT_SECRET: z.string(),
  })
  .parse(process.env);

const logger = {
  development: {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,req.hostname,req.remotePort,req.remoteAddress",
      },
    },
  },
  production: true,
  test: false,
}[env.NODE_ENV];

export const config = {
  env,
  currentDatabaseUrl:
    env.NODE_ENV === "test" ? env.DATABASE_TEST_URL : env.DATABASE_URL,
  logger,
};
