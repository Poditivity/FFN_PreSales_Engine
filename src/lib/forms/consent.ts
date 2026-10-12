// What every public form shows at its end, and what it keeps when the applicant
// agrees. The notice and the policy link are set by the team on
// the Settings page and read through the public_form_settings() function.

/**
 * The key the consent is stored under in a submission's answers. Answer keys are
 * question ids; this one starts with two underscores so it can never be one, and
 * exports and review screens skip it.
 */
export const CONSENT_KEY = "__consent";

export const isAnswerKey = (key: string) => !key.startsWith("__");

/** The consent line the checkbox carries. Not editable: the notice above it is. */
export const CONSENT_LABEL = "I agree to the privacy policy";

/** Shown when the team has not written a notice. Deliberately short and makes no promise beyond the form. */
export const DEFAULT_PRIVACY_NOTICE =
  "Founders First Network will store and use the details you give in this form to review your application and to contact you about it.";

export interface PublicFormSettings {
  privacyText: string;
  privacyUrl: string | null;
}

export const DEFAULT_PUBLIC_SETTINGS: PublicFormSettings = {
  privacyText: DEFAULT_PRIVACY_NOTICE,
  privacyUrl: null,
};

/** Turns the row public_form_settings() returns into settings the form can use, whatever is missing. */
export function normalizePublicSettings(row: unknown): PublicFormSettings {
  const r = (Array.isArray(row) ? row[0] : row) as
    | { privacy_policy_url?: unknown; privacy_policy_text?: unknown }
    | null
    | undefined;
  const text = typeof r?.privacy_policy_text === "string" ? r.privacy_policy_text.trim() : "";
  const url = typeof r?.privacy_policy_url === "string" ? r.privacy_policy_url.trim() : "";
  return {
    privacyText: text || DEFAULT_PRIVACY_NOTICE,
    // Only an https link is ever offered, so a stored value can never be a script.
    privacyUrl: /^https:\/\//i.test(url) ? url : null,
  };
}

export interface ConsentRecord {
  accepted: true;
  at: string;
  policy_url: string | null;
}

export function consentRecord(settings: PublicFormSettings, now: Date = new Date()): ConsentRecord {
  return { accepted: true, at: now.toISOString(), policy_url: settings.privacyUrl };
}
