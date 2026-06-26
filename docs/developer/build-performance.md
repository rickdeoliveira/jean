# Build Performance (Local)

The default `[profile.release]` in `src-tauri/Cargo.toml` is tuned for distribution: `lto = true`, `codegen-units = 1`, `opt-level = "s"`, `strip = true`. That is correct for shipped binaries, but a clean local `tauri build` takes ~3 minutes on an M-series Mac.

For local iteration (testing release behavior without shipping it), use the `release-fast` profile and sccache.

## release-fast profile

Defined in `src-tauri/Cargo.toml`:

```toml
[profile.release-fast]
inherits = "release"
codegen-units = 16
lto = "thin"
opt-level = 2
strip = "debuginfo"
incremental = true
```

Run via:

```bash
bun run tauri:build:fast
```

This wraps `tauri build --bundles app,dmg --config '{"bundle":{"createUpdaterArtifacts":false}}' -- --profile release-fast`.

- `--bundles dmg` produces a `.dmg` installer. The `.app` is built as a required intermediate (lives in `src-tauri/target/release-fast/bundle/macos/Jean.app`) — DMG can't exist without it. Use `--bundles app` instead if you don't need the installer (saves ~10–30s of DMG packaging).
- `--config '{...}'` disables `createUpdaterArtifacts` for this build, so it doesn't fail on missing `TAURI_SIGNING_PRIVATE_KEY`. Updater bundles only matter for shipped releases.
- Everything after `--` is forwarded to `cargo build`. The Tauri CLI doesn't expose `--profile` natively.

Tradeoff: the resulting binary is ~10–20% larger and slightly slower than `[profile.release]`. Use it for local testing only — CI and release scripts (`tauri:build`, `tauri:build:macos`, `tauri:build:linux`, `tauri:build:windows`) keep using `[profile.release]`.

## sccache

`sccache` caches rustc output across cleans, branch switches, and dependency rebuilds. Big win on second+ build after `cargo clean`.

### Install

```bash
# macOS
brew install sccache

# Linux
cargo install sccache --locked
# or use your distro package
```

### Configure

Create `src-tauri/.cargo/config.toml` (gitignored — each dev configures locally because the binary path is machine-specific):

```toml
[build]
rustc-wrapper = "/opt/homebrew/bin/sccache"   # macOS Apple Silicon
# rustc-wrapper = "/usr/local/bin/sccache"    # macOS Intel / older Linux
# rustc-wrapper = "/home/<you>/.cargo/bin/sccache"  # Linux cargo-installed
```

Use `which sccache` to find your path.

### Verify

```bash
sccache --show-stats
```

After a build, look for non-zero "Compile requests executed" / "Cache hits". The cache lives at `~/Library/Caches/Mozilla.sccache` (macOS) or `~/.cache/sccache` (Linux).

## Why no mold/sold linker?

`mold` does not support macOS targets. `sold` (its macOS fork) is fragile to set up and the default `ld-prime` linker shipped with Xcode 15+ is already fast. Linker time is not the bottleneck on macOS for this codebase.

## Single-architecture macOS builds

`bun run tauri:build:macos` uses `--target universal-apple-darwin`, which compiles the entire crate twice (arm64 + x86_64) and `lipo`s the binaries. For local testing on an M-series Mac, omit the target — `bun run tauri:build:fast` builds host-only and roughly halves Rust compile time.

## Expected results

| Scenario                          | Before |   After |
| --------------------------------- | -----: | ------: |
| Cold build (`cargo clean` first)  | ~3m09s | ~60–90s |
| Incremental (touch one Rust file) | ~3m09s | ~20–45s |
| Sccache hit (after branch switch) | ~3m09s | ~30–60s |

Numbers are approximate and depend on Mac model, dependency state, and sccache warmth.
