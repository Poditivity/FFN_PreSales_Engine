import type { ReactNode } from "react";
import { cx } from "./cx";

export interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  raised?: boolean;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}

export function Card({ title, subtitle, actions, footer, raised, flush, className, children }: CardProps) {
  return (
    <section className={cx("ffn-card", raised && "ffn-card--raised", className)}>
      {(title || actions) && (
        <header className="ffn-card__head">
          <div>
            <h3 className="ffn-card__title">{title}</h3>
            {subtitle && <p className="ffn-card__sub">{subtitle}</p>}
          </div>
          {actions && (
            <div className="ffn-row" style={{ gap: "var(--space-2)" }}>
              {actions}
            </div>
          )}
        </header>
      )}
      <div className={cx("ffn-card__body", flush && "ffn-card__body--flush")}>{children}</div>
      {footer && <footer className="ffn-card__foot">{footer}</footer>}
    </section>
  );
}
