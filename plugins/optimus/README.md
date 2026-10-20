# optimus (plugin package)

This folder is the Claude Code plugin itself: `hooks/`, `src/`, the built bundles in `dist/`, the `kb` skill and the domain templates. Setup, usage and the command reference are in the repository README one level up; the design is in `docs/DESIGN.md`.

Uses mechanisms from billion-context / acp-kernel (https://github.com/ranxianglei/billion-context, https://github.com/ranxianglei/acp-kernel). Third-party terms: `THIRD_PARTY_NOTICES.md`.

Develop: `npm install`, then `npm test` (builds `dist/` first, then runs the suite) and `npm run check` for types. Claude Code loads the plugin from this folder in place when the repository is added as a directory marketplace, so a rebuild is the whole upgrade.
