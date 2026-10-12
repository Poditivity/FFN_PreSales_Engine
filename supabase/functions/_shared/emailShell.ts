// The branded HTML shell the team-facing emails share (the same markup the
// invite and new-submission emails use), and HTML escaping for what goes in it.

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function shell(inner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:'Segoe UI',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
  <tr><td align="center">
    <table width="100%" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(10,12,18,0.09);" cellpadding="0" cellspacing="0">
      <tr><td style="background:#0a0c12;padding:20px 28px;">
        <span style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8098ff;font-weight:600;font-family:'Segoe UI',Arial,sans-serif;">Founders First Network</span>
      </td></tr>
      <tr><td style="padding:32px 28px 28px;">${inner}</td></tr>
      <tr><td style="padding:14px 28px;background:#f6f7f9;border-top:1px solid #e3e6ec;">
        <p style="margin:0;font-size:11px;color:#616978;text-align:center;">Founders First Network</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
