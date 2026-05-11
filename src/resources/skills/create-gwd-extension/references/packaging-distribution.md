<overview>
Packaging extensions for distribution via npm, git, or local paths. Creating GWD/pi packages.
</overview>

<package_manifest>
Add a `pi` manifest to `package.json`:

```json
{
  "name": "my-gwd-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```
</package_manifest>

<installing>
```bash
gwd install npm:@foo/bar@1.0.0
gwd install git:github.com/user/repo@v1
gwd install ./local/path

# Try without installing:
gwd -e npm:@foo/bar
```
</installing>

<convention_directories>
If no `pi` manifest exists, auto-discovers:
- `extensions/` → `.ts` and `.js` files
- `skills/` → `SKILL.md` folders
- `prompts/` → `.md` files
- `themes/` → `.json` files
</convention_directories>

<dependencies>
- List `@gwd/pi-ai`, `@gwd/pi-coding-agent`, `@gwd/pi-tui`, `@sinclair/typebox` in `peerDependencies` with `"*"` — they're bundled by the runtime.
- Other npm deps go in `dependencies`. The runtime runs `npm install` on package installation.
</dependencies>

<gallery_metadata>
```json
{
  "pi": {
    "video": "https://example.com/demo.mp4",
    "image": "https://example.com/screenshot.png"
  }
}
```
</gallery_metadata>
