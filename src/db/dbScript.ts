import { rakeDb } from "rake-db";
import { appCodeUpdater } from "orchid-orm/codegen";
import { BaseTable } from "./baseTable";
import { config } from "../config";

const databases = [{ databaseURL: config.env.DATABASE_URL }];

const testDatabase = config.env.DATABASE_TEST_URL;
if (testDatabase) databases.push({ databaseURL: testDatabase });

export const change = rakeDb(databases, {
  baseTable: BaseTable,
  migrationsPath: "./migrations",
  appCodeUpdater: appCodeUpdater({
    tablePath: (tableName) => `./tables/${tableName}.table.ts`,
    ormPath: "./db.ts",
  }),
  // set to false to disable code updater
  useCodeUpdater: config.env.NODE_ENV === "development",
  import: (path) => import(path),
});
