import { ZodError } from "zod";
import { NotFoundError } from "orchid-orm";
import { ApiError } from "./errors";
import { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export function errorHandler(
  error: FastifyError,
  req: FastifyRequest,
  res: FastifyReply,
) {
  if (error instanceof NotFoundError) {
    return res.status(404).send({
      message: "Record is not found",
    });
  } else if (error instanceof ZodError) {
    return res.status(422).send({
      message: "Validation failed",
      issues: error.issues,
    });
  } else if (error instanceof ApiError) {
    return res.status(error.statusCode).send({
      message: error.message,
    });
  } else {
    return res.status(500).send({
      message: "Something went wrong",
    });
  }
}
