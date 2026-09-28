# Cottontail 0.5.0 source and relinking guide

This guide accompanies the macOS arm64 runtime used by Electrobun PDF 1.0.0.
It describes the source-based route for replacing the statically linked
JavaScriptCore/WebKit libraries in Cottontail and producing a replacement
`cottontail` executable. It does not claim that the prebuilt JSC `.a` files are
all of the object code needed to relink the executable.

## Exact inputs

The release source packet assembled by
`scripts/assemble-runtime-source-packet.sh` contains:

- Cottontail source at
  `e5660061b8e64b5ea044799da8518780a9987391`, including its Zig sources,
  compiler-derived sources, SQLite amalgamation, vendored libuv, build scripts,
  release scripts, and notices;
- the Cottontail 0.5.0 macOS arm64 release archive;
- the exact JSC SDK consumed by that Cottontail revision, including
  `libJavaScriptCore.a`, `libWTF.a`, `libbmalloc.a`, the Cottontail JSC embedder
  archive, headers, ICU fallback archives, and manifests;
- the JSC build repository at
  `46a8b00303faeba2c09854e78511845e9ccbeb9a`, including its patches and build
  scripts;
- complete WebKit source at
  `27877cc2acd8a3cea8b3827ddb48d6c6c0177714`
  (`WebKit-7624.4.5.14.1`), including JavaScriptCore, WTF, bmalloc, per-file
  notices, and the LGPL license corpus;
- ICU 70.1 source, zig-html-rewriter source at
  `a221646a3919c5fb51780437f08cc9e844bc2f5f`, Brotli 1.2.0 source, OpenSSL
  3.6.3 source, and Zig 0.16.0 source and macOS arm64 toolchain.

`SHA256SUMS` in the packet authenticates every included file. The
`PROVENANCE.md` file records immutable upstream URLs and revisions.

## Relink using the exact published JSC objects

This is the shortest source-based relink route. Extract the packet, then run:

```sh
./rebuild-cottontail-macos.sh
```

The script extracts the exact Cottontail source and JSC SDK, vendors the pinned
Zig and zig-html-rewriter inputs, and invokes Cottontail's own
`scripts/build-release.js`. Cottontail's build compiles the non-LGPL program
sources (including its JSC bindings) and links them with the supplied JSC, WTF,
bmalloc, embedder, and ICU archives. The output is
`work/cottontail/zig-out/bin/cottontail`.

The original upstream workflow used Node 24.18.0, Xcode 26.4, Zig 0.16.0,
Homebrew Brotli 1.2.0, and OpenSSL 3.6.3. The recipe requires an arm64 Mac,
Node 24, Xcode command-line tools, and Homebrew. It does not alter the runtime's
deployment-target settings.

## Relink with a modified JavaScriptCore/WebKit

1. Extract `sources/WebKit-27877cc2....tar.gz` and modify it.
2. Extract `sources/jsc-build-46a8b003....tar.gz`.
3. Follow that repository's `README.md` and `.github/workflows/build-jsc.yml`,
   pointing its checkout step at the extracted WebKit tree or a commit carrying
   the changes. Preserve the published platform layout and embedder manifest.
4. Replace `objects/cottontail-jsc-macos-arm64.tar.gz` with the rebuilt SDK.
5. Run `./rebuild-cottontail-macos.sh --jsc-archive PATH`.

The packet supplies the complete WebKit source and JSC build scripts needed for
this route. A full modified-JSC build is expensive and was not run as part of
release preparation; the exact-SDK Cottontail relink route was run instead.

## Release-preparation verification record

The exact-SDK route was executed on macOS arm64 on 2026-09-28 with Node
24.13.1, Xcode 27.0, the packet's Zig 0.16.0 toolchain, Homebrew Brotli 1.2.0,
and locally installed OpenSSL 3.6.4. Cottontail's own release builder and binary
validator completed, strict ad-hoc signature verification passed, and the
result printed `0.5.0` and evaluated `6 * 7` as `42`. That verification build's
SHA-256 was
`0c675dd58459ffc11d95a302f8417fce5dd1f71465b1f4a339cf2f0ba80e002a`.

The published Cottontail binary embeds OpenSSL 3.6.3, whose exact source is in
the packet. The verification build used the newer locally installed 3.6.4 and
is proof of the relinking route, not a bit-for-bit reproduction. Likewise,
Xcode 27 emitted a macOS 27.0 minimum for the verification binary; the original
published runtime reports 26.5.2. The recipe does not override Cottontail's
deployment target. Use the upstream Xcode 26.4 environment when reproducing
the original release environment.

## Verification

For a rebuilt executable:

```sh
./work/cottontail/zig-out/bin/cottontail --version
./work/cottontail/zig-out/bin/cottontail -p '6 * 7'
codesign --verify --strict --verbose=2 \
  ./work/cottontail/zig-out/bin/cottontail
```

Expected functional output is `0.5.0` and `42`. A relinked executable is a new
build and is not expected to be byte-identical to the published binary. Sign
the final application with the release signing identity after replacing the
runtime.
