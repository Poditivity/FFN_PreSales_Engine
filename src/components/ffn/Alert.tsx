import type { ReactNode } from "react";
import { cx } from "./cx";

export type AlertTone = "brand" | "success" | "warning" | "danger";

export interface AlertProps {
  tone?: AlertTone;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function Alert({ tone = "brand", title, action, className, children }: AlertProps) {
  return (
    <div
      className={cx("ffn-alert", `ffn-alert--${tone}`, className)}
      role={tone === "danger" ? "alert" : "status"}
    >
      <span className="ffn-alert__mark" aria-hidden="true" />
      <div className="ffn-grow">
        <p className="ffn-alert__title">{title}</p>
        {children && <p className="ffn-alert__body">{children}</p>}
      </div>
      {action}
    </div>
  );
}
