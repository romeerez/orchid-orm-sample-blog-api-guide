import { JwtPayload, sign, verify } from "jsonwebtoken";
import { config } from "../config";

export const createToken = ({ id }: { id: number }): string => {
  return sign({ id }, config.env.JWT_SECRET);
};

export const verifyToken = (token: string): string | JwtPayload => {
  return verify(token, config.env.JWT_SECRET);
};
