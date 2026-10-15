/** Only the fixed generated fixture recipe, never user/input values. Binary
 * equality checks every byte and treats NULL/BLOB as invalid without GLOB's
 * per-character pattern evaluation. The full row count is checked separately. */
export function csvFixtureCheckSql(): string {
  return `SELECT count(*) AS n,sum(payload IS NOT '${'x'.repeat(4095)}') AS invalid FROM records`;
}
