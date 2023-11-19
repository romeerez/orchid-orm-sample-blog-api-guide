import { app } from "./app";
import { config } from "./config";

app.listen({ port: config.env.PORT }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
