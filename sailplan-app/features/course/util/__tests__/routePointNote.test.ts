import { getRoutePointNoteCounter, normaliseRoutePointNote, routePointNoteSchema } from '../routePointNote';

describe('route point notes', () => {
  test('normalises whitespace-only notes to absent', () => {
    expect(normaliseRoutePointNote('  \n ')).toBeNull();
    expect(normaliseRoutePointNote('  Keep clear  ')).toBe('Keep clear');
  });

  test('rejects notes longer than 200 characters', () => {
    expect(routePointNoteSchema.safeParse('a'.repeat(200)).success).toBe(true);
    expect(routePointNoteSchema.safeParse('a'.repeat(201)).success).toBe(false);
  });

  test('shows remaining characters only for the final 30', () => {
    expect(getRoutePointNoteCounter('a'.repeat(169))).toBeNull();
    expect(getRoutePointNoteCounter('a'.repeat(170))).toBe(30);
    expect(getRoutePointNoteCounter('a'.repeat(199))).toBe(1);
  });
});
