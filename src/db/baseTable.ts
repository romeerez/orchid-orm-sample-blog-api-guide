import { createBaseTable } from "orchid-orm";
import { zodSchemaConfig } from "orchid-orm-schema-to-zod";

export const BaseTable = createBaseTable({
  // Set `snakeCase` to `true` if columns in your database are in snake_case.
  // snakeCase: true,

  schemaConfig: zodSchemaConfig,

  // Customize column types for all tables.
  columnTypes: (t) => ({
    ...t,
    // Set min and max validations for all text columns,
    // it is only checked when validating with Zod schemas derived from the table.
    text: (min = 0, max = Infinity) => t.text(min, max),
    // Parse timestamps to number.
    timestamp: (precision?: number) => t.timestamp(precision).asNumber(),
  }),
});
