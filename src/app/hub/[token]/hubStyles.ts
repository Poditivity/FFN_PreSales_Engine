// Applicant hub styles, shared by the page an applicant opens and the preview
// staff open from the admin (the same page with ?preview=1). Scoped under
// .ffn-hub so nothing leaks into the admin app.
//
// The look is quiet on purpose: generous space, one blue used sparingly, hairline
// dividers in place of boxes, a dark opening and a dark close. Every colour,
// space, radius and shadow is a design system token. Font sizes are the sizes of
// the type scale (11, 12, 13, 14, 16, 17, 20, 24, 28, 36, 48). The one motif
// taken from the brand is the shear: the leaning bars from the FFN mark, used
// once, in the hero.
export const HUB_CSS = `
.ffn-hub{background:var(--surface-page);color:var(--ink);font-family:var(--font-sans);-webkit-font-smoothing:antialiased}
.ffn-hub *{box-sizing:border-box}
.ffn-hub img{display:block;max-width:100%}
:where(.ffn-hub) a{color:inherit}
.ffn-hub a{text-decoration:none}
.ffn-hub [id]{scroll-margin-top:calc(var(--topbar-height) + var(--space-8))}
.ffn-hub button{font-family:inherit}
.ffn-hub a:focus-visible,.ffn-hub button:focus-visible,.ffn-hub summary:focus-visible,.ffn-hub [tabindex]:focus-visible{outline:2px solid var(--focus-ring);outline-offset:2px}
@media (prefers-reduced-motion:no-preference){html:has(.ffn-hub){scroll-behavior:smooth}}
@media (prefers-reduced-motion:reduce){.ffn-hub *{animation:none !important;transition:none !important}}

.hub-wrap{width:100%;max-width:var(--content-max);margin:0 auto;padding-inline:var(--space-6)}
@media (min-width:1024px){.hub-wrap{padding-inline:var(--space-10)}}

/* Preview marker: out of the way, and it must not change how the page reads. */
.hub-preview{position:fixed;left:var(--space-3);bottom:var(--space-3);z-index:500;background:var(--surface-inverse);color:var(--on-inverse);padding:var(--space-2) var(--space-4);border-radius:var(--radius-sm);font-size:12px;line-height:16px;font-weight:500;box-shadow:var(--shadow-md);pointer-events:none}

/* Buttons and small controls */
.hub-btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--space-2);height:var(--control-md);padding:0 var(--space-4);border:1px solid transparent;border-radius:var(--radius-sm);font-size:13px;line-height:18px;font-weight:500;white-space:nowrap;cursor:pointer;transition:background-color 120ms cubic-bezier(.2,0,0,1)}
.hub-btn--primary{background:var(--brand-solid);color:var(--on-brand)}
.hub-btn--primary:hover{background:var(--brand-solid-hover)}
.hub-btn--primary:active{background:var(--brand-solid-active)}
.hub-btn--sm{height:var(--control-sm);font-size:12px;line-height:16px}
.hub-btn--lg{height:var(--control-lg);padding:0 var(--space-5);font-size:14px;line-height:22px}
.hub-text-btn{display:inline-flex;align-items:center;gap:var(--space-1);padding:0;background:none;border:0;color:var(--brand);font-size:13px;line-height:20px;font-weight:500;cursor:pointer}
.hub-text-btn:hover{text-decoration:underline}
.hub-link{display:inline-flex;align-items:center;gap:var(--space-1);margin-top:var(--space-8);color:var(--brand);font-size:14px;line-height:22px;font-weight:500}
.hub-link:hover{text-decoration:underline}
.hub-more{display:inline-flex;align-items:center;gap:var(--space-2);margin-top:auto;padding-top:var(--space-5);color:var(--brand);font-size:13px;line-height:18px;font-weight:500}
.hub-more svg{transition:transform 200ms cubic-bezier(.2,0,0,1)}

/* Navigation */
.hub-nav{position:sticky;top:0;z-index:100;background:color-mix(in srgb,var(--surface) 88%,transparent);backdrop-filter:blur(12px) saturate(120%);-webkit-backdrop-filter:blur(12px) saturate(120%);border-bottom:1px solid transparent;transition:border-color 200ms cubic-bezier(.2,0,0,1)}
.hub-nav.is-scrolled{border-bottom-color:var(--border)}
.hub-nav-inner{display:flex;align-items:center;gap:var(--space-6);height:calc(var(--topbar-height) + var(--space-2))}
.hub-brand{display:block;flex:none}
.hub-nav-links{display:none;flex:1;justify-content:flex-end;gap:var(--space-6)}
.hub-nav-links a{padding:var(--space-2) 0;font-size:14px;line-height:22px;color:var(--ink-muted);transition:color 120ms cubic-bezier(.2,0,0,1)}
.hub-nav-links a:hover{color:var(--ink)}
.hub-nav-links a[aria-current="true"]{color:var(--ink);box-shadow:inset 0 calc(var(--space-0\\.5) * -1) 0 var(--brand)}
.hub-nav-end{display:flex;align-items:center;gap:var(--space-3);margin-left:auto}
.hub-menu-btn{display:inline-flex;align-items:center;gap:var(--space-1);height:var(--control-sm);padding:0 var(--space-3);background:var(--surface);border:1px solid var(--border-control);border-radius:var(--radius-sm);color:var(--ink);font-size:12px;line-height:16px;font-weight:500;cursor:pointer}
.hub-menu-btn:hover{background:var(--surface-hover)}
.hub-menu{position:absolute;left:0;right:0;top:100%;background:var(--surface);border-bottom:1px solid var(--border);box-shadow:var(--shadow-md);padding:var(--space-3) 0}
.hub-menu .hub-wrap{display:grid;grid-template-columns:repeat(auto-fill,minmax(calc(var(--space-16) * 3),1fr));gap:var(--space-1)}
.hub-menu a{padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);font-size:14px;line-height:22px;color:var(--ink-muted)}
.hub-menu a:hover{background:var(--surface-hover);color:var(--ink)}
.hub-menu a[aria-current="true"]{background:var(--surface-selected);color:var(--brand)}
@media (min-width:960px){
  .hub-nav-links{display:flex}
  .hub-nav-end{margin-left:0}
  .hub-menu-btn{display:none}
  .hub-menu{display:none}
}
@media (max-width:520px){.hub-nav-cta{display:none}}

/* Hero */
.hub-hero{position:relative;overflow:hidden;background:var(--surface-inverse);color:var(--on-inverse);padding-block:calc(var(--space-16) * 1.75) calc(var(--space-16) * 1.5)}
.hub-shear{position:absolute;top:0;bottom:0;right:0;width:46%;background:repeating-linear-gradient(90deg,var(--brand-solid) 0 var(--space-2),transparent var(--space-2) var(--space-12));transform:skewX(-18deg);transform-origin:top;opacity:.5;-webkit-mask-image:linear-gradient(to left,var(--ink),transparent);mask-image:linear-gradient(to left,var(--ink),transparent);pointer-events:none}
.hub-hero-inner{position:relative;z-index:1}
.hub-title{margin:var(--space-4) 0 0;max-width:calc(var(--space-16) * 12);font-size:36px;line-height:42px;font-weight:700;letter-spacing:-.02em;color:var(--on-inverse)}
.hub-hero-sub{margin:var(--space-5) 0 0;max-width:calc(var(--space-16) * 9);font-size:16px;line-height:26px;color:color-mix(in srgb,var(--on-inverse) 76%,transparent)}
.hub-hero-meta{margin:var(--space-6) 0 0;font-size:14px;line-height:22px;font-weight:500;color:color-mix(in srgb,var(--on-inverse) 88%,transparent)}
.hub-hero-note{margin:var(--space-8) 0 0;max-width:var(--prose-max);padding-left:var(--space-5);border-left:var(--space-0\\.5) solid color-mix(in srgb,var(--on-inverse) 32%,transparent)}
.hub-hero-note p{margin:0;font-size:14px;line-height:22px;color:color-mix(in srgb,var(--on-inverse) 82%,transparent)}
.hub-hero-note .hub-hero-note-label{margin-bottom:var(--space-1);font-size:12px;line-height:16px;font-weight:500;color:color-mix(in srgb,var(--on-inverse) 68%,transparent)}
@media (min-width:720px){.hub-title{font-size:48px;line-height:52px}}
@media (max-width:720px){.hub-hero{padding-block:calc(var(--space-16) * 1.25) var(--space-16)}.hub-shear{width:70%;opacity:.32}}

/* Sections */
.hub-section{padding-block:var(--space-12)}
.hub-section:nth-of-type(even){background:var(--surface);border-block:1px solid var(--border)}
@media (min-width:720px){.hub-section{padding-block:calc(var(--space-16) * 1.5)}}
.hub-head{display:flex;justify-content:space-between;align-items:flex-end;gap:var(--space-6);margin-bottom:var(--space-8)}
@media (min-width:720px){.hub-head{margin-bottom:calc(var(--space-16) * .75)}}
.hub-eyebrow{margin:0 0 var(--space-3);font-size:11px;line-height:14px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--brand)}
.hub-eyebrow--inverse{color:color-mix(in srgb,var(--on-inverse) 72%,transparent)}
.hub-h2{margin:0;font-size:24px;line-height:32px;font-weight:600;letter-spacing:-.01em}
.hub-h2--inverse{color:var(--on-inverse)}
@media (min-width:720px){.hub-h2{font-size:28px;line-height:34px;font-weight:700}}
.hub-lede{margin:var(--space-3) 0 0;max-width:var(--prose-max);font-size:16px;line-height:26px;color:var(--ink-muted)}
.hub-lede--inverse{color:color-mix(in srgb,var(--on-inverse) 76%,transparent)}

/* Card grids and the card itself */
.hub-grid{display:grid;gap:var(--space-5)}
.hub-grid--3{grid-template-columns:repeat(auto-fill,minmax(min(100%,calc(var(--space-16) * 4.5)),1fr))}
.hub-grid--2{grid-template-columns:repeat(auto-fill,minmax(min(100%,calc(var(--space-16) * 6)),1fr))}
.fd-card,.cs-card,.mn-card,.pg-card,.tm-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);color:var(--ink);text-align:left}
.hub-section:nth-of-type(even) :is(.fd-card,.cs-card,.mn-card,.pg-card,.tm-card){background:var(--surface-page)}
.fd-card,.cs-card{display:flex;flex-direction:column;width:100%;font:inherit;cursor:pointer;transition:border-color 120ms cubic-bezier(.2,0,0,1)}
.fd-card:hover,.cs-card:hover{border-color:var(--border-control)}
.fd-card:hover .hub-more svg,.cs-card:hover .hub-more svg{transform:translateX(var(--space-1))}

/* People */
.hub-portrait{display:inline-grid;place-items:center;flex:none;overflow:hidden;border-radius:var(--radius-full);background:var(--brand-100);color:var(--brand);font-weight:600}
.hub-portrait img{width:100%;height:100%;object-fit:cover}
.hub-portrait--md{width:var(--space-10);height:var(--space-10);font-size:14px}
.hub-portrait--lg{width:var(--space-16);height:var(--space-16);font-size:20px}
.hub-portrait--xl{width:calc(var(--space-16) * 1.5);height:calc(var(--space-16) * 1.5);font-size:28px}

.fd-card{padding:var(--space-6);gap:0;cursor:default}
.fd-card:hover{border-color:var(--border)}
.fd-company{display:flex;align-items:center;gap:var(--space-3);margin-top:var(--space-5);padding-top:var(--space-4);border-top:1px solid var(--border)}
.fd-logo{flex:none;height:var(--space-8);width:auto;max-width:calc(var(--space-16) * 1.5);object-fit:contain}
.fd-company-name{margin:0;font-size:14px;line-height:22px;font-weight:600}
.fd-foot{display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-3) var(--space-5);margin-top:auto;padding-top:var(--space-5)}
.fd-top{display:flex;align-items:center;gap:var(--space-4)}
.fd-id{min-width:0}
.fd-name{margin:0;font-size:17px;line-height:24px;font-weight:600}
.fd-startup{margin:0;font-size:13px;line-height:20px;color:var(--ink-muted)}
.fd-line{margin:var(--space-4) 0 0;font-size:14px;line-height:22px;color:var(--ink-muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}

.mn-card{display:flex;flex-direction:column;padding:var(--space-6)}
.mn-head{display:flex;align-items:center;gap:var(--space-4)}
.mn-id{min-width:0}
.mn-name{margin:0;font-size:16px;line-height:24px;font-weight:600;overflow-wrap:anywhere}
.mn-role{margin:0;font-size:13px;line-height:20px;color:var(--ink-muted)}
.mn-part{margin-top:var(--space-4)}
.mn-label{margin:0;font-size:12px;line-height:16px;font-weight:500;color:var(--ink-subtle)}
.mn-text{margin:var(--space-1) 0 0;font-size:14px;line-height:22px;white-space:pre-line}
.mn-link{margin-top:auto;padding-top:var(--space-5)}

/* Programs */
.pg-card{padding:var(--space-6)}
.pg-name{margin:0;font-size:17px;line-height:24px;font-weight:600}
.pg-text{margin:var(--space-2) 0 0;font-size:14px;line-height:22px;color:var(--ink-muted)}

/* Tags */
.hub-tags{display:flex;flex-wrap:wrap;gap:var(--space-2);margin:0;padding:0;list-style:none}
.hub-tags--tight{margin-top:var(--space-4)}
.hub-tags li{padding:var(--space-1) var(--space-3);background:var(--surface);border:1px solid var(--border-strong);border-radius:var(--radius-sm);font-size:13px;line-height:20px;color:var(--ink)}
.hub-section:nth-of-type(even) .hub-tags li{background:var(--surface-page)}

/* About FFN */
.ab-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,calc(var(--space-16) * 4)),1fr));gap:var(--space-8)}
.ab-col{padding-top:var(--space-5);border-top:1px solid var(--border-strong)}
.ab-num{color:var(--ink-subtle)}
.ab-label{margin:var(--space-3) 0 var(--space-2);font-size:17px;line-height:24px;font-weight:600}
.ab-text{margin:0;font-size:14px;line-height:22px;color:var(--ink-muted)}

/* Who it is for */
.wf{border-top:1px solid var(--border)}
.wf-row{display:grid;gap:var(--space-3);padding:var(--space-5) 0;border-bottom:1px solid var(--border)}
.wf-label{margin:0;font-size:13px;line-height:20px;font-weight:500;color:var(--ink-muted)}
@media (min-width:720px){.wf-row{grid-template-columns:calc(var(--space-16) * 3) 1fr;gap:var(--space-6)}}

/* What FFN helps with */
.hw-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,calc(var(--space-16) * 5)),1fr));gap:var(--space-4) var(--space-8);margin:0;padding:0;list-style:none}
.hw-list li{display:flex;align-items:flex-start;gap:var(--space-3);font-size:16px;line-height:24px}
.hw-tick{display:grid;place-items:center;flex:none;width:var(--space-5);height:var(--space-5);margin-top:var(--space-0\\.5);background:var(--brand-050);color:var(--brand);border-radius:var(--radius-xs)}

/* How FFN supports founders */
.hs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,calc(var(--space-16) * 4)),1fr));margin:0;padding:0;list-style:none;border-top:1px solid var(--border);border-left:1px solid var(--border)}
.hs-item{display:flex;flex-direction:column;gap:var(--space-5);padding:var(--space-6);border-right:1px solid var(--border);border-bottom:1px solid var(--border)}
.hs-num{color:var(--ink-subtle)}
.hs-text{font-size:16px;line-height:24px;font-weight:500}

/* Credibility */
.cr-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,calc(var(--space-16) * 3)),1fr));gap:var(--space-8) var(--space-6);margin:0;padding-top:var(--space-6);border-top:1px solid var(--border-strong)}
.cr-stat{display:flex;flex-direction:column;gap:var(--space-2)}
.cr-value{order:-1;margin:0;font-size:36px;line-height:42px;font-weight:700;letter-spacing:-.02em}
.cr-label{font-size:14px;line-height:22px;color:var(--ink-muted)}

/* Testimonials */
.tm-card{display:flex;flex-direction:column;justify-content:space-between;gap:var(--space-6);margin:0;padding:var(--space-6)}
.tm-quote{margin:0;font-size:17px;line-height:26px;font-weight:500}
.tm-quote::before{content:"\\201C"}
.tm-quote::after{content:"\\201D"}
.tm-by{display:flex;align-items:center;gap:var(--space-3)}
.tm-name{margin:0;font-size:14px;line-height:22px;font-weight:600}
.tm-role{display:flex;align-items:center;gap:var(--space-2);margin:0;font-size:13px;line-height:20px;color:var(--ink-muted)}
.tm-logo{flex:none;height:var(--space-5);width:auto;max-width:var(--space-16);object-fit:contain}
.tm-actions{margin-top:var(--space-1)}
.tm-actions{display:flex;flex-wrap:wrap;gap:var(--space-4)}
@media (min-width:720px){
  .tm-card{padding:var(--space-8)}
  .tm-card--lead{grid-column:1 / -1}
  .tm-card--lead .tm-quote{max-width:calc(var(--space-16) * 12);font-size:24px;line-height:34px;letter-spacing:-.01em}
}

/* Relevant links */
.ln-list{max-width:var(--prose-max);border-top:1px solid var(--border)}
.ln-row{display:flex;justify-content:space-between;align-items:center;gap:var(--space-4);padding:var(--space-4) 0;border-bottom:1px solid var(--border);font-size:16px;line-height:24px;font-weight:500;transition:color 120ms cubic-bezier(.2,0,0,1)}
.ln-row:hover{color:var(--brand)}
.ln-row svg{flex:none;color:var(--brand)}

/* Questions */
.faq{max-width:calc(var(--space-16) * 12);border-top:1px solid var(--border)}
.faq-item{border-bottom:1px solid var(--border)}
.faq-item summary{display:flex;justify-content:space-between;align-items:center;gap:var(--space-4);padding:var(--space-5) 0;font-size:16px;line-height:24px;font-weight:500;list-style:none;cursor:pointer}
.faq-item summary::-webkit-details-marker{display:none}
.faq-icon{flex:none;color:var(--brand);transition:transform 200ms cubic-bezier(.2,0,0,1)}
.faq-item[open] .faq-icon{transform:rotate(45deg)}
.faq-item p{margin:0;padding:0 0 var(--space-5);max-width:var(--prose-max);font-size:14px;line-height:22px;color:var(--ink-muted)}

/* Next step */
.hub-cta{background:var(--surface-inverse);color:var(--on-inverse);padding-block:var(--space-12)}
.hub-cta-inner{display:grid;gap:var(--space-8);align-items:center}
.cta-side{display:flex;flex-direction:column;align-items:flex-start;gap:var(--space-3)}
.hub-cta .hub-btn--primary{margin-top:var(--space-3);border-color:color-mix(in srgb,var(--on-inverse) 40%,transparent)}
@media (min-width:860px){.hub-cta{padding-block:calc(var(--space-16) * 1.5)}.hub-cta-inner{grid-template-columns:1fr auto;gap:var(--space-12)}}

/* Footer */
.hub-footer{background:var(--surface-inverse);color:var(--on-inverse);border-top:1px solid color-mix(in srgb,var(--on-inverse) 16%,transparent);padding-block:var(--space-6)}
.hub-footer-inner{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:var(--space-3) var(--space-6)}
.is-preview .hub-footer{padding-bottom:calc(var(--space-6) + var(--space-10))}
.hub-footer-brand{display:inline-flex;align-items:center;gap:var(--space-3);font-size:13px;line-height:18px;font-weight:500}
.hub-footer-note{font-size:12px;line-height:16px;color:color-mix(in srgb,var(--on-inverse) 68%,transparent)}

/* Loading and error */
.hub-state{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-4);padding:var(--space-6);text-align:center;background:var(--surface-page)}
.hub-state-title{margin:var(--space-4) 0 0;font-size:20px;line-height:28px;font-weight:600}
.hub-state-text{margin:0;font-size:14px;line-height:22px;color:var(--ink-muted)}

/* Case study reader */
.rd{margin-bottom:var(--space-8);background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-xl);overflow:hidden}
.rd:focus{outline:none}
.rd-bar{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:var(--space-3) var(--space-4);padding:var(--space-3) var(--space-4);border-bottom:1px solid var(--border);background:var(--surface)}
.rd-title{min-width:0;flex:1 1 calc(var(--space-16) * 3)}
.rd-name{margin:0;font-size:14px;line-height:22px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rd-sub{margin:0;font-size:12px;line-height:16px;color:var(--ink-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rd-tools{display:flex;align-items:center;gap:var(--space-1)}
.rd-count{padding:0 var(--space-2);color:var(--ink-muted);white-space:nowrap}
.rd-sep{width:1px;height:var(--space-4);margin:0 var(--space-1);background:var(--border-strong)}
.rd-btn{display:inline-grid;place-items:center;width:var(--control-sm);height:var(--control-sm);padding:0;background:none;border:1px solid transparent;border-radius:var(--radius-sm);color:var(--ink-muted);cursor:pointer;transition:background-color 120ms cubic-bezier(.2,0,0,1)}
.rd-btn:hover:not(:disabled){background:var(--surface-hover);color:var(--ink)}
.rd-btn:disabled{color:var(--ink-disabled);cursor:not-allowed}
.rd-body{background:var(--surface-sunken)}
.rd-scroll{height:min(80vh,calc(var(--space-16) * 12));overflow:auto;padding:var(--space-6) var(--space-4);display:flex;flex-direction:column;gap:var(--space-4);overscroll-behavior:contain}
.rd-page{flex:none;margin:0 auto;background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow-sm)}
.rd-page canvas{display:block}
.rd-frame{display:block;width:100%;height:min(80vh,calc(var(--space-16) * 12));border:0;background:var(--surface)}
.rd-state{min-height:calc(var(--space-16) * 5);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-3);padding:var(--space-8);text-align:center;font-size:14px;line-height:22px;color:var(--ink-muted)}
.rd-state p{margin:0}
.rd-state-title{font-size:16px;line-height:24px;font-weight:600;color:var(--ink)}
.rd-spinner{width:var(--space-6);height:var(--space-6);border:2px solid var(--border-strong);border-top-color:var(--brand);border-radius:var(--radius-full);animation:hub-spin 800ms linear infinite}
@keyframes hub-spin{to{transform:rotate(360deg)}}
.rd--full{position:fixed;inset:0;z-index:300;display:flex;flex-direction:column;margin:0;border:0;border-radius:0}
.rd--full .rd-body{flex:1;min-height:0;display:flex;flex-direction:column}
.rd--full .rd-scroll,.rd--full .rd-frame{flex:1;height:auto;min-height:0}
@media (max-width:720px){.rd-tools .rd-sep,.rd-tools .rd-btn[aria-label^="Zoom"]{display:none}}

/* Case study cards */
.cs-card{overflow:hidden;padding:0}
.cs-cover{position:relative;aspect-ratio:4 / 3;overflow:hidden;background:var(--surface-sunken);border-bottom:1px solid var(--border)}
.cs-cover canvas{position:absolute;top:0;left:0;display:block}
.cs-plain{position:absolute;inset:0;display:grid;place-items:center;color:var(--ink-subtle)}
.cs-cover--plain{background:var(--surface-inverse)}
.cs-cover--plain::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,var(--brand-solid) 0 var(--space-2),transparent var(--space-2) var(--space-12));transform:skewX(-18deg);opacity:.35;-webkit-mask-image:linear-gradient(to left,var(--ink),transparent);mask-image:linear-gradient(to left,var(--ink),transparent)}
.cs-cover--plain .cs-plain{color:var(--on-inverse)}
.cs-card[aria-current="true"]{border-color:var(--brand)}
.cs-meta{display:flex;flex-direction:column;flex:1;padding:var(--space-5) var(--space-6) var(--space-6)}
.cs-title{margin:0;font-size:16px;line-height:24px;font-weight:600}
.cs-founders{margin:var(--space-1) 0 0;font-size:13px;line-height:20px;color:var(--ink-muted)}
.cs-meta .hub-more{display:flex}
.cs-pages{margin-left:auto;color:var(--ink-subtle)}

/* Founder drawer */
.dr-root{position:fixed;inset:0;z-index:400}
.dr-scrim{position:absolute;inset:0;background:color-mix(in srgb,var(--surface-inverse) 56%,transparent);animation:hub-fade 200ms cubic-bezier(.2,0,0,1)}
.dr{position:absolute;top:0;right:0;bottom:0;display:flex;flex-direction:column;width:min(100%,calc(var(--space-16) * 8.5));background:var(--surface);box-shadow:var(--shadow-lg);animation:hub-slide 200ms cubic-bezier(.2,0,0,1)}
@keyframes hub-fade{from{opacity:0}}
@keyframes hub-slide{from{transform:translateX(var(--space-8));opacity:0}}
.dr-top{display:flex;justify-content:space-between;align-items:center;padding:var(--space-3) var(--space-4) var(--space-3) var(--space-6);border-bottom:1px solid var(--border)}
.dr-top .hub-eyebrow{margin:0}
.dr-scroll{flex:1;overflow:auto;padding:var(--space-6) var(--space-6) var(--space-12);display:flex;flex-direction:column;gap:var(--space-8);overscroll-behavior:contain}
.dr-id{display:flex;align-items:center;gap:var(--space-5)}
.dr-name{margin:0;font-size:24px;line-height:32px;font-weight:600;letter-spacing:-.01em}
.dr-startup{display:flex;align-items:center;gap:var(--space-2);margin:var(--space-1) 0 0;font-size:14px;line-height:22px;color:var(--ink-muted)}
.dr-logo{height:var(--space-5);width:auto;max-width:var(--space-16);object-fit:contain}
.dr-links{display:flex;flex-wrap:wrap;gap:var(--space-4);margin:var(--space-2) 0 0}
.dr-links a{display:inline-flex;align-items:center;gap:var(--space-1);font-size:13px;line-height:20px;font-weight:500;color:var(--brand)}
.dr-links a:hover{text-decoration:underline}
.dr-stages{display:flex;align-items:center;gap:var(--space-4);padding:var(--space-4) var(--space-5);background:var(--surface-page);border:1px solid var(--border);border-radius:var(--radius-lg)}
.dr-stage-label{margin:0;font-size:12px;line-height:16px;color:var(--ink-subtle)}
.dr-stage-value{margin:0;font-size:14px;line-height:22px;font-weight:600}
.dr-stage-arrow{flex:none;color:var(--ink-subtle)}
.dr-outcome{padding-left:var(--space-5);border-left:var(--space-0\\.5) solid var(--brand)}
.dr-outcome .hub-eyebrow{margin-bottom:var(--space-2)}
.dr-outcome-text{margin:0;font-size:20px;line-height:28px;font-weight:500;white-space:pre-line}
.dr-part{display:flex;flex-direction:column;gap:var(--space-2)}
.dr-part-label{margin:0;font-size:13px;line-height:18px;font-weight:500;color:var(--ink-muted)}
.dr-part-text{margin:0;font-size:14px;line-height:22px;white-space:pre-line}
.dr-list{margin:0;padding-left:var(--space-5);list-style:disc;display:flex;flex-direction:column;gap:var(--space-2);font-size:14px;line-height:22px}
.dr-list li{display:list-item}
.dr-quote{margin:0;padding-left:var(--space-5);border-left:var(--space-0\\.5) solid var(--border-strong)}
.dr-quote blockquote{margin:0;font-size:17px;line-height:26px;font-weight:500}
.dr-quote blockquote::before{content:"\\201C"}
.dr-quote blockquote::after{content:"\\201D"}
.dr-quote figcaption{margin-top:var(--space-2);font-size:12px;line-height:16px;color:var(--ink-muted)}
.dr-docs{display:flex;flex-direction:column;gap:var(--space-2)}
.dr-doc{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:var(--space-3);width:100%;padding:var(--space-3) var(--space-4);background:var(--surface);border:1px solid var(--border-control);border-radius:var(--radius-md);color:var(--ink);font-size:14px;line-height:22px;font-weight:500;text-align:left;cursor:pointer;transition:background-color 120ms cubic-bezier(.2,0,0,1)}
.dr-doc:hover{background:var(--surface-hover)}
.dr-doc svg:first-child{color:var(--ink-subtle)}
.dr-doc svg:last-child{color:var(--brand)}
@media (max-width:720px){.dr-id{flex-direction:column;align-items:flex-start}}

/* Custom and collection sections, added by staff in the hub template */
.cu-wrap{display:grid;gap:var(--space-8);align-items:start}
@media (min-width:860px){.cu-wrap--image{grid-template-columns:minmax(0,1fr) minmax(0,calc(var(--space-16) * 5));gap:var(--space-12)}}
.cu-body{max-width:var(--prose-max);font-size:16px;line-height:26px;color:var(--ink)}
.cu-body>:first-child{margin-top:0}
.cu-body>:last-child{margin-bottom:0}
.cu-body p,.cu-body ul,.cu-body ol,.cu-body blockquote{margin:0 0 var(--space-4)}
.cu-body h2{margin:var(--space-6) 0 var(--space-3);font-size:20px;line-height:28px;font-weight:600}
.cu-body h3{margin:var(--space-5) 0 var(--space-2);font-size:17px;line-height:24px;font-weight:600}
.cu-body ul,.cu-body ol{padding-left:var(--space-6)}
.cu-body ul{list-style:disc}
.cu-body ol{list-style:decimal}
.cu-body li{display:list-item}
.cu-body li{margin-bottom:var(--space-1)}
.cu-body blockquote{padding-left:var(--space-4);border-left:var(--space-0\.5) solid var(--border-strong);color:var(--ink-muted)}
.cu-body a{color:var(--brand);text-decoration:underline;text-underline-offset:2px}
.cu-image{width:100%;max-width:calc(var(--space-16) * 5);height:auto;max-height:calc(var(--space-16) * 5);justify-self:start;border-radius:var(--radius-lg);border:1px solid var(--border);object-fit:contain}
.cu-actions{margin-top:var(--space-6)}
.cl-card{display:flex;flex-direction:column;overflow:hidden;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);color:var(--ink);text-align:left}
.hub-section:nth-of-type(even) .cl-card{background:var(--surface-page)}
.cl-media{width:100%;aspect-ratio:16/9;object-fit:cover;border-bottom:1px solid var(--border)}
.cl-main{display:flex;flex-direction:column;flex:1;padding:var(--space-6)}
.cl-name{margin:0;font-size:17px;line-height:24px;font-weight:600}
.cl-text{margin:var(--space-2) 0 0;font-size:14px;line-height:22px;color:var(--ink-muted);white-space:pre-line}
`;
