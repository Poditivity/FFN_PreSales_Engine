"use client";

import { Card, Switch } from "@/components/ffn";
import { setTheme, useTheme } from "@/lib/theme";

export function AppearanceCard() {
  const theme = useTheme();
  const dark = theme === "dark";
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between" style={{ gap: "var(--space-3) var(--space-6)" }}>
        <div>
          <h3 className="ffn-card__title">Appearance</h3>
          <p className="ffn-card__sub" aria-live="polite">
            Applies to the whole application on this device. {dark ? "Dark mode is on." : "Light mode is on."}
          </p>
        </div>
        <Switch checked={dark} onChange={(e) => setTheme(e.target.checked ? "dark" : "light")} label="Use dark mode" />
      </div>
    </Card>
  );
}
