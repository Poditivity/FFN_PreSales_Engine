import { Users } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function EmptyState({ icon, title, action, className, children }: EmptyStateProps) {
  return (
    <div className={cx("ffn-empty", className)}>
      <span className="ffn-empty__mark">{icon ?? <Users size={20} strokeWidth={1.75} />}</span>
      <h3 className="ffn-empty__title">{title}</h3>
      {children && <p className="ffn-empty__body">{children}</p>}
      {action && <div style={{ marginTop: "var(--space-2)" }}>{action}</div>}
    </div>
  );
}
