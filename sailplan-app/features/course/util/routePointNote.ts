import { z } from 'zod';

export const ROUTE_POINT_NOTE_MAX_LENGTH = 200;

export const routePointNoteSchema = z.string().max(
  ROUTE_POINT_NOTE_MAX_LENGTH,
  `Note must be ${ROUTE_POINT_NOTE_MAX_LENGTH} characters or fewer`,
);

export function normaliseRoutePointNote(value?: string | null): string | null {
  const note = value?.trim() ?? '';
  return note.length === 0 ? null : routePointNoteSchema.parse(note);
}

export function getRoutePointNoteCounter(value: string): number | null {
  const remaining = ROUTE_POINT_NOTE_MAX_LENGTH - value.length;
  return remaining <= 30 ? remaining : null;
}
