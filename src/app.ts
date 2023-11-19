import fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import { config } from "./config";
import { errorHandler } from "./lib/errorHandler";
import { helloRouter } from "./modules/hello/hello.router";

export const app = fastify({
  logger: config.logger,
}).withTypeProvider<ZodTypeProvider>();

export type FastifyApp = typeof app;

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

helloRouter(app);
app.setErrorHandler(errorHandler);
