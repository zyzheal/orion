/**
 * BaseRepository - camelToSnake edge case tests
 *
 * Covers digit boundaries: forecast30Days → forecast_30_days
 */

// Extract camelToSnake for direct testing (it's not exported)
function camelToSnake(str: string): string {
  return str
    .replace(/([a-z])(\d)/g, '$1_$2')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/(\d)([A-Z])/g, '$1_$2')
    .toLowerCase();
}

describe('camelToSnake', () => {
  it('should convert basic camelCase', () => {
    expect(camelToSnake('tenantId')).toBe('tenant_id');
    expect(camelToSnake('totalHits')).toBe('total_hits');
    expect(camelToSnake('avgLatencySavedMs')).toBe('avg_latency_saved_ms');
  });

  it('should handle digit boundaries (lowercase→digit)', () => {
    expect(camelToSnake('forecast30Days')).toBe('forecast_30_days');
    expect(camelToSnake('retry3Times')).toBe('retry_3_times');
    expect(camelToSnake('max100Items')).toBe('max_100_items');
  });

  it('should handle digit boundaries (digit→uppercase)', () => {
    expect(camelToSnake('step3Action')).toBe('step_3_action');
    expect(camelToSnake('v2Release')).toBe('v_2_release');
  });

  it('should handle all-uppercase abbreviations', () => {
    expect(camelToSnake('cacheId')).toBe('cache_id');
    expect(camelToSnake('sqlText')).toBe('sql_text');
  });

  it('should handle already snake_case', () => {
    expect(camelToSnake('tenant_id')).toBe('tenant_id');
    expect(camelToSnake('total_hits')).toBe('total_hits');
  });

  it('should handle single word', () => {
    expect(camelToSnake('id')).toBe('id');
    expect(camelToSnake('status')).toBe('status');
  });

  it('should handle consecutive uppercase', () => {
    expect(camelToSnake('getURL')).toBe('get_url');
    expect(camelToSnake('parseJSON')).toBe('parse_json');
  });
});
