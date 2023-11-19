import { testRequest } from "../../lib/testRequest";

describe("GET /", () => {
  it('should return "hello world"', async () => {
    const res = await testRequest.get("/");

    expect(res.json()).toEqual({ message: "hello world" });
  });
});
