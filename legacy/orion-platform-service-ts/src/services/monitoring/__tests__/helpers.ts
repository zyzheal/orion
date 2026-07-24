/**
 * Metric Storage Repository test helper
 */
export function createMockPool(rows: any[] = [], rowCount: number = rows.length) {
  const queryMock = jest.fn().mockResolvedValue({ rows, rowCount });
  return {
    query: queryMock,
  };
}
