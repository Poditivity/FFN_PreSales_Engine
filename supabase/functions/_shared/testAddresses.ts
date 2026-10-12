// Addresses that can never receive mail. Pure TypeScript so the mail core and
// Vitest share it.
//
// example.com/.net/.org and the .example, .test, .invalid and .localhost
// top-level domains are reserved for testing (RFC 2606, RFC 6761). The e2e
// suite creates admins and applicants on them against the live project, and
// every message sent to one bounces. Bounces count against the sending
// domain's reputation with every inbox provider, so these are never sent.

const RESERVED_DOMAINS = new Set(["example.com", "example.net", "example.org"]);
const RESERVED_TLDS = ["example", "test", "invalid", "localhost"];

export function isReservedTestAddress(address: string): boolean {
  const domain = String(address ?? "").trim().toLowerCase().split("@").pop() ?? "";
  if (RESERVED_DOMAINS.has(domain)) return true;
  const tld = domain.split(".").pop() ?? "";
  return RESERVED_TLDS.includes(tld);
}
