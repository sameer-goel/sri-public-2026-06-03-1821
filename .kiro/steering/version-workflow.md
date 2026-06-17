# Version Workflow - Om Sacred Space

## Golden Rule

**The active version lives in the repository root.** Everything frozen lives in `archive/`.
Never edit anything inside `archive/` - those are snapshots for rollback.

## Active Version

The active development version is the **root directory** (`index.html`, `styles.css`,
`sound-healing.html`, `book.html`, `retreat.html`, `shop.html`, `images/`, etc.).
All edits, new features, and bug fixes go here.

## Backing Up & Moving On (the norm)

When the user is happy with the current version and wants to back it up before evolving it:

1. Copy the current root site into `archive/vN/` (the next free version number).
   - Include the site files: html, css, js, audio, and `images/`.
   - Do **not** copy `.git/`, `.github/`, `.kiro/`, `.vscode/`, `archive/`, or the root `README.md`.
2. Create a compressed snapshot `archive/vN-backup.zip` of that folder.
3. Keep developing in the **root** directory (it is already the new active version -
   no copy-up step needed; root simply continues as the live version).
4. Update this steering file's version number references if needed.
5. Update the root `README.md` version log.

## File Editing Checklist

Before writing or modifying any file, verify:
- [ ] The file path is in the **repository root** (the active version)
- [ ] You are NOT touching anything under `archive/`
- [ ] Frozen snapshots and standalone experiments stay in `archive/`

## Testing

The user tests by opening the root `index.html` in a browser. No build step needed.

## Archive Contents

`archive/` holds frozen version folders (`v1/`, `v2/`, `v3/`, …), their `vN-backup.zip`
snapshots, and standalone experiments kept for reference.
