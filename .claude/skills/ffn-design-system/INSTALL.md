# Installing the FFN design system into a repo

Three ways, in order of how much you want Claude Code to lean on it.

## 1. As a skill (recommended)

    cp -r ffn-design-system .claude/skills/ffn-design-system

Claude Code reads `SKILL.md` when the work touches FFN UI. It loads the brand
book and the component guidelines on demand rather than all at once.

Add one line to the repo's `CLAUDE.md` so it is never missed:

    UI work in this repo follows the FFN design system in
    .claude/skills/ffn-design-system. Read its SKILL.md before writing any
    component, and never invent a colour, spacing value, radius or stage label.

## 2. As repo source

    cp -r ffn-design-system/tokens src/design-system/tokens
    cp ffn-design-system/BRAND-BOOK.md docs/brand-book.md

Then in the app root:

    import './design-system/tokens/tokens.css'
    import './design-system/tokens/shadcn-theme.css'

Set `data-theme` on `<html>`. Load Poppins 400/500/600/700 and IBM Plex Mono
400/500/600 from Google Fonts.

## 3. Both

Do this one. The skill is what Claude Code reads; the tokens are what the app
compiles. They are the same values, so they cannot drift as long as you update
the design system artifact and re-export rather than editing the copy in the
repo.

## What is in here

    SKILL.md                     the rules, for Claude Code
    BRAND-BOOK.md                voice, visual foundations, iconography
    INSTALL.md                   this file
    tokens/tokens.json           every token with its usage note
    tokens/tokens.css            compiled custom properties, both themes
    tokens/shadcn-theme.css      shadcn/ui variable map
    components/bundle.js         reference implementation, 20 components
    components/bundle.css        the stylesheet, every value a token
    components/index.d.ts        props and types
    components/<Name>/README.md  guidelines per component
    components/<Name>/preview.html  a working example per component
    assets/logos/                the four approved FFN marks

## Keeping it current

The design system artifact is the source. When a token or a component changes
there, re-export and replace this whole folder. Do not patch the copy in the
repo: a token edited in one repo and not the other is how two FFN products stop
looking like one product.
