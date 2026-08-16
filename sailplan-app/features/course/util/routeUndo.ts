export interface RouteUndoAction {
  label: string;
  inverse: () => Promise<void>;
}

export class RouteUndo {
  private action: RouteUndoAction | null = null;

  offer(action: RouteUndoAction): void { this.action = action; }
  peek(): RouteUndoAction | null { return this.action; }
  dismiss(): void { this.action = null; }

  async undo(): Promise<void> {
    const action = this.action;
    this.action = null;
    await action?.inverse();
  }
}

export const routeUndo = new RouteUndo();
