# Corresponding Source and Release Checklist

electrobun-pdf is licensed under the GNU AGPL-3.0-or-later. A distributor must
provide recipients the Corresponding Source required by that license. This
file is release engineering guidance, not a substitute for the license text.

## Public source location

The project source is at <https://github.com/GijungKim/electrobun-pdf>. A
binary release must identify an immutable tag and full commit ID from that
repository that exactly match the sources used to build it. Do not point only
to a moving branch such as `main`.

## Prepare one release

From a clean clone with the release commit checked out:

```bash
git status --short
git rev-parse HEAD
git tag --points-at HEAD
bun install --frozen-lockfile
bun run notices
bun run typecheck
bun test
bun run build:stable
```

Create the source archive from the exact annotated release tag, not from the
working tree. Replace the example tag before running these commands:

```bash
tag=v1.0.0
commit=$(git rev-list -n 1 "$tag")
test "$(git rev-parse HEAD)" = "$commit"
git archive --format=tar.gz --prefix="electrobun-pdf-${tag}/" \
  --output="artifacts/electrobun-pdf-${tag}-source.tar.gz" "$tag"
shasum -a 256 artifacts/*
```

Publish the full commit ID, tag, source archive, checksum, binary artifacts,
`LICENSE`, `NOTICE`, and `THIRD_PARTY_NOTICES.md` together. Verify that the
archive contains `bun.lock`, `package.json`, `electrobun.config.ts`, the
`scripts/` directory, and all tracked buildable source. The lockfile and build
scripts are part of the material needed to reproduce the release and must not
be replaced by files from another revision.

## Third-party corresponding source

The project archive covers the application source, but it is not by itself a
complete source offer for every bundled binary. The installed `mupdf@1.27.0`
npm package contains prebuilt JavaScript and WebAssembly under
AGPL-3.0-or-later. Its exact source mapping has been verified from the npm
registry's immutable version metadata, rather than inferred from the version:

- npm metadata: <https://registry.npmjs.org/mupdf/1.27.0>
- npm tarball: <https://registry.npmjs.org/mupdf/-/mupdf-1.27.0.tgz>
- npm `gitHead` and exact upstream commit:
  [`7956afdc373785865f651fcb76f3112ab1208ba0`](https://github.com/ArtifexSoftware/mupdf/commit/7956afdc373785865f651fcb76f3112ab1208ba0)
- npm tarball SHA-1 (also the registry `dist.shasum`):
  `9a1c7c01e2f5b95694ee89e09ce57940b01304d2`
- npm tarball SHA-512 (the decoded `dist.integrity` and `bun.lock` SRI):
  `bc43d463065ebb93608852f3e1edb447b569da9358eecce2ac612f4f11f2410a50b3a69be037867689f04fab07d49646e448721d2ae88d9ad99f6ff479eeaa65`
- shipped `dist/mupdf-wasm.wasm` SHA-256:
  `2763c796603eddcae4202e4c47d1d60868271870530316f180daf4cf86740255`

At that commit, `platform/wasm/package.json` is byte-identical to the package
metadata inside the npm tarball (SHA-256
`366f8e6fe476df1e21a21b3915b335335658f793b4b0a7e878bf0335f4f1a77d`).
Its `prepack` script runs `tools/build.sh` and `tools/compress.sh`; the build
script pins Emscripten SDK 4.0.8 and produces `mupdf-wasm.wasm` from the MuPDF
tree. No npm-publish workflow exists in the upstream `.github/workflows`
directory at this revision; the registry `gitHead`, package match, and
checked-in `prepack` build path are the provenance evidence.

Do **not** substitute upstream tag `1.27.0`: that tag resolves to parent commit
`d3b7556577b790e9761868c314ad6fd9b6dd86a9`. The npm `gitHead` is tagged
`1.27.1` and changes MuPDF's core `version.h` to 1.27.1 while leaving
`platform/wasm/package.json` at 1.27.0. This mismatch is why the immutable npm
`gitHead`, not a same-named tag, is used.

The prepared expanded source archive includes the detached `gitHead` checkout,
all recursively initialized third-party submodules, and the WASM build scripts:

- `artifacts/mupdf-1.27.0-npm-gitHead-7956afdc373785865f651fcb76f3112ab1208ba0-source.tar.gz`
- SHA-256:
  `1dbdc0b8ae5940dea6cde3bf4f09e0ca2a071d16df5a42dd7f67b3901c8d88b4`
- revision inventory and evidence:
  `artifacts/mupdf-1.27.0-SOURCE-PROVENANCE.txt` (SHA-256
  `d6461088fc0b6a7bea2a47f64e8c3b8432eb941405eb31815510a4b9c90fb695`)

Publish that source archive and provenance inventory alongside every release
that ships this npm artifact. The locally preserved registry tarball is
`artifacts/mupdf-1.27.0-npm-package.tgz` (SHA-256
`e4b78969319ed148f3110c5cf0158beb851ce72ecf30ef9d0019fe3a41004d78`).
GitHub-generated source archives do not recursively include submodule content
and are not a replacement for the expanded archive above.

Apply the same check to any replacement, modified, generated, or
platform-specific copyleft component found while inspecting the final
artifact. `THIRD_PARTY_NOTICES.md` is an attribution inventory, not a source
offer.

The package build copies `LICENSE`, `NOTICE`, this file, and
`THIRD_PARTY_NOTICES.md` into the application resources. Inspect each produced
archive or installer to confirm those files survived platform packaging. Also
inspect the actual artifact for platform SDKs, optional native binaries,
generated assets, and other components that the npm-derived notice inventory
may not cover.

## Reproduction notes

- Record the Bun version, operating system, architecture, and Electrobun/Hutch
  toolchain versions used for each platform build.
- Electrobun downloads its paired Hutch toolchain into `~/.hutch`; preserve the
  resolved toolchain version in release notes or build logs.
- `bun.lock` pins JavaScript package resolution. `bun install
  --frozen-lockfile` prevents an unnoticed lockfile rewrite.
- The repository does not currently promise byte-for-byte reproducible output.
  Timestamps, platform tooling, and downloaded toolchain components may affect
  artifacts. Reproducible here means that recipients receive the exact source,
  lockfile, and build instructions corresponding to the binary.

## Unsigned artifact caveats

The checked-in configuration does not configure trusted publisher signing or
notarization. A macOS toolchain may place an ad-hoc/linker signature on a local
binary, but that is not a Developer ID signature and does not establish a
publisher identity. macOS Gatekeeper and Windows reputation checks may warn
about or block untrusted downloads; Linux desktop environments may also
require users to mark downloaded files as executable. Do not describe an
artifact as publisher-signed or notarized without verifying that specific
artifact's signature and identity.

Signing, notarization, publishing, updater hosting, and release upload are
separate authorized operations; the build commands above do not perform them.
