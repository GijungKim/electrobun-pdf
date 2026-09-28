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
complete source offer for every bundled binary. In particular, the installed
`mupdf@1.27.0` npm package contains prebuilt JavaScript and WebAssembly under
AGPL-3.0-or-later, and its installed metadata names an upstream repository but
does not identify the exact source commit used to produce that WebAssembly.

Before distributing a binary, the release maintainer must obtain and preserve
the exact corresponding MuPDF source revision, including the scripts and
configuration needed to build the shipped `mupdf-wasm.wasm`, and publish or
offer it alongside the application source as the AGPL requires. Record its
immutable source reference and checksum. Do not infer that source revision
from the npm version alone, and do not describe the application source archive
as complete Corresponding Source until this mapping has been verified.

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
