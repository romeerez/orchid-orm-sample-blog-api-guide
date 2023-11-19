import { FastifyApp } from "../../app";
import { z } from "zod";

export function helloRouter(app: FastifyApp) {
  app.get("/", {
    schema: {
      response: {
        200: z.object({
          message: z.string(),
        }),
      },
    },
    handler() {
      return {
        message: "hello world",
      };
    },
  });
}
