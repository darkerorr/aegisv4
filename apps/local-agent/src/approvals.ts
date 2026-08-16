import type { WorkToolAction } from "@aegis/types";

export interface PendingApproval {
  id: string;
  action: WorkToolAction;
  reason: string;
  createdAt: number;
}

export interface ApprovalRequest {
  id: string;
  promise: Promise<boolean>;
}

type Resolver = (approved: boolean) => void;

export class ApprovalManager {
  private pending = new Map<string, { approval: PendingApproval; resolve: Resolver }>();

  request(action: WorkToolAction, reason: string): ApprovalRequest {
    let resolve: Resolver = () => undefined;
    const promise = new Promise<boolean>((resolver) => { resolve = resolver; });
    const id = `ap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    this.pending.set(id, { approval: { id, action, reason, createdAt: Date.now() }, resolve });
    return { id, promise };
  }

  list(): PendingApproval[] {
    return [...this.pending.values()].map((entry) => entry.approval);
  }

  resolve(id: string, approved: boolean): boolean {
    const entry = this.pending.get(id);
    if (!entry) return false;
    this.pending.delete(id);
    entry.resolve(approved);
    return true;
  }

  count(): number {
    return this.pending.size;
  }
}
