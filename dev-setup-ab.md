# Setup Agent Browser

One-time, per-machine setup: install the `agent-browser` CLI and its browser runtime. There is no configuration to record.

# Prerequisites

- Node.js (current LTS) and `npm` on PATH
- Network access to install the npm package and the bundled browser

# Actions

1. **Install the CLI globally.**
   ```bash
   npm i -g agent-browser
   ```
2. **Install the managed browser runtime.**
   ```bash
   agent-browser install
   ```
3. **Confirm health.**
   ```bash
   agent-browser doctor
   ```
   On failure: `agent-browser doctor --fix`, then re-run `doctor`.
4. **Mark setup complete.**
   ```bash
   flint shard setup ab --complete
   ```

# Verification

- `agent-browser --version` prints a version and `agent-browser doctor` exits `0`.
- `flint shard ab browser list` runs (it will report no open browsers on a fresh machine).
