import { sailTwaLimit } from '~/schema';

export type SailTwaLimit = typeof sailTwaLimit.$inferSelect;
export type SailTwaLimitInsert = typeof sailTwaLimit.$inferInsert;

export const TWS_VALUES = [5, 10, 15, 20, 25, 30] as const;
export type TwsValue = (typeof TWS_VALUES)[number];
