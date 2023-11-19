import { ormFactory } from "orchid-orm-test-factory";
import { db } from "../../db/db";

export const testFactory = ormFactory(db);
