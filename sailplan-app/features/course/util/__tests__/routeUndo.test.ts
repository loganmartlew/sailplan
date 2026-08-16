import { RouteUndo } from '../routeUndo';

describe('RouteUndo', () => {
  test('reverses only the latest supported edit', async () => {
    const events: string[] = [];
    const undo = new RouteUndo();
    undo.offer({ label: 'first', inverse: async () => { events.push('first'); } });
    undo.offer({ label: 'second', inverse: async () => { events.push('second'); } });

    await undo.undo();
    await undo.undo();
    expect(events).toEqual(['second']);
  });

  test('dismissal retires the inverse', async () => {
    const inverse = jest.fn(async () => undefined);
    const undo = new RouteUndo();
    undo.offer({ label: 'edit', inverse });
    undo.dismiss();
    await undo.undo();
    expect(inverse).not.toHaveBeenCalled();
  });
});
