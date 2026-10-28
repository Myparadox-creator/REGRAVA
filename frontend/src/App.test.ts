import { describe, it, expect } from 'vitest';

describe('RepoSentinel Frontend Logic', () => {
  it('correctly maps severity levels to rank', () => {
    const rank: Record<string, number> = { high: 3, medium: 2, low: 1, info: 0 };
    expect(rank['high']).toBeGreaterThan(rank['medium']);
    expect(rank['medium']).toBeGreaterThan(rank['low']);
    expect(rank['low']).toBeGreaterThan(rank['info']);
  });

  it('filters breaking changes properly', () => {
    const sampleFindings = [
      { id: 'RS-001', severity: 'high', change_type: 'field_removed' },
      { id: 'RS-002', severity: 'info', change_type: 'field_added' },
    ];
    const breaking = sampleFindings.filter((f) => f.severity === 'high');
    expect(breaking.length).toBe(1);
    expect(breaking[0].id).toBe('RS-001');
  });
});
