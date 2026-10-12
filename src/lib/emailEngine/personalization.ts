import type { LeadStage } from "@/lib/leads/schema";

/**
 * Replaces {{token}} placeholders with real values. A token missing from
 * the map is left untouched (visible as literal "{{token}}") rather than
 * silently blanked — an admin typo in a template should be obvious, not
 * disappear into an empty gap in the sent email.
 */
export function renderTemplate(template: string, tokens: Record<string, string | null | undefined>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (!(key in tokens)) return match;
    const value = tokens[key];
    return value == null ? "" : value;
  });
}

export interface StageEmailRuleLike {
  stage: LeadStage;
  template_id: string;
  enabled: boolean;
}

/**
 * The stage -> rule -> template matching logic: returns the enabled rule
 * for a stage, or null when there isn't one — either because no rule was
 * ever created for that stage, or because it exists but is turned off.
 * Both cases mean the same thing to a caller: nothing sends.
 */
export function resolveStageEmailRule<T extends StageEmailRuleLike>(rules: T[], stage: LeadStage): T | null {
  return rules.find((r) => r.stage === stage && r.enabled) ?? null;
}
