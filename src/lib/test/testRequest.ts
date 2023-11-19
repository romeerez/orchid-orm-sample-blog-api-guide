import { app } from "../../app";
import { InjectOptions } from "fastify";

const req = app.inject.bind(app);

const requestWithPayload = (method: InjectOptions["method"]) => {
  return function (
    this: typeof req,
    url: string,
    payload?: InjectOptions["payload"],
    params?: Omit<InjectOptions, "method" | "url" | "payload">,
  ) {
    const chain = typeof this === "function" ? this() : this;
    Object.assign(
      (chain as unknown as Record<string, Record<string, unknown>>).option,
      {
        url,
        method,
        payload,
        ...params,
      },
    );

    return chain.end();
  };
};

export const testRequest = Object.assign(req, {
  get(
    this: typeof req,
    url: string,
    params?: Omit<InjectOptions, "method" | "url">,
  ) {
    const chain = typeof this === "function" ? this() : this;
    Object.assign(
      (chain as unknown as Record<string, Record<string, unknown>>).option,
      {
        url,
        method: "get",
        ...params,
      },
    );
    return chain.end();
  },
  post: requestWithPayload("post"),
  patch: requestWithPayload("patch"),
  put: requestWithPayload("put"),
  delete: requestWithPayload("delete"),
});
