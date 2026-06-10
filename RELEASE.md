# 0.1.0

- Initial shard scaffold
- Platform-aware helper scripts: Chrome binary/profile-root auto-detection for macOS, Linux, and Windows (`ab-chrome-bin` / `ab-chrome-root` now optional overrides); profile cloning via rsync (macOS/Linux) or robocopy (Windows); platform-correct Chrome-running detection
- `open saved --name <x>` gives each named identity its own profile dir (no more shared-state collision with `ab-saved-path`)
- `open real --clone <name|path>` (and `login real --clone`) targets alternate clones made with `clone --name`
- `stop` with no name closes the single warm session or lists the candidates — it no longer guesses a session that was never opened
- Removed dead config keys `ab-keep-warm` and `ab-default-session`; dogfood sessions default to the slugified domain
- Real-mode CDP-port security note and per-platform keystore notes (Keychain / keyring / DPAPI) in knw-ab-modes
- Cosmetic: profile sizes in `profiles`, profile dir shown in `open` output, stale "Remaining" list after `stop` fixed
