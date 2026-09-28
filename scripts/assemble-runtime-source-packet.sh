#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-$repo_root/build/release-source/cottontail-0.5.0-runtime-source}"
case "$out" in
  /|""|.) echo "refusing unsafe output path: $out" >&2; exit 2 ;;
esac

for command in curl git gzip shasum tar zstd; do
  command -v "$command" >/dev/null || { echo "missing required command: $command" >&2; exit 1; }
done

work="$(mktemp -d "${TMPDIR:-/tmp}/cottontail-source-packet.XXXXXX")"
trap 'rm -rf "$work"' EXIT
if [[ "${RUNTIME_PACKET_RESUME:-0}" != 1 ]]; then
  rm -rf "$out" "$out.tar.zst" "$out.tar.zst.sha256"
fi
mkdir -p "$out"/{objects,sources,toolchain,notices}

download() {
  local url="$1" expected="$2" destination="$3"
  if [[ -f "$destination" && "$(shasum -a 256 "$destination" | awk '{print $1}')" == "$expected" ]]; then
    echo "Reusing verified $(basename "$destination")"
    return
  fi
  echo "Downloading $(basename "$destination")"
  curl -LfsS --retry 3 "$url" -o "$destination"
  echo "$expected  $destination" | shasum -a 256 -c -
}

archive_repo() {
  local name="$1" url="$2" ref="$3" expected="$4" prefix="$5"
  if [[ -f "$out/sources/$prefix.tar.gz" && "${RUNTIME_PACKET_RESUME:-0}" == 1 ]]; then
    echo "Reusing $prefix.tar.gz"
    mkdir -p "$work/$name"
    tar -xzf "$out/sources/$prefix.tar.gz" --strip-components=1 -C "$work/$name"
    return
  fi
  local checkout="$work/$name"
  local cached="${RUNTIME_PACKET_REPO_CACHE:-}/$name"
  if [[ -n "${RUNTIME_PACKET_REPO_CACHE:-}" && -d "$cached/.git" ]]; then
    checkout="$cached"
    ln -s "$cached" "$work/$name"
  else
    git init -q "$checkout"
    git -C "$checkout" remote add origin "$url"
    git -C "$checkout" fetch -q --depth 1 origin "$ref"
    git -C "$checkout" checkout -q --detach FETCH_HEAD
  fi
  local actual
  actual="$(git -C "$checkout" rev-parse HEAD)"
  [[ "$actual" == "$expected" ]] || { echo "$name revision mismatch: $actual" >&2; exit 1; }
  git -C "$checkout" archive --format=tar --prefix="$prefix/" HEAD | gzip -n > "$out/sources/$prefix.tar.gz"
}

archive_repo cottontail https://github.com/blackboardsh/cottontail.git \
  e5660061b8e64b5ea044799da8518780a9987391 e5660061b8e64b5ea044799da8518780a9987391 \
  cottontail-e5660061b8e64b5ea044799da8518780a9987391
archive_repo jsc-build https://github.com/blackboardsh/jsc.git \
  46a8b00303faeba2c09854e78511845e9ccbeb9a 46a8b00303faeba2c09854e78511845e9ccbeb9a \
  jsc-build-46a8b00303faeba2c09854e78511845e9ccbeb9a
archive_repo zig-html-rewriter https://github.com/blackboardsh/zig-html-rewriter.git \
  a221646a3919c5fb51780437f08cc9e844bc2f5f a221646a3919c5fb51780437f08cc9e844bc2f5f \
  zig-html-rewriter-a221646a3919c5fb51780437f08cc9e844bc2f5f
archive_repo zig-asar https://github.com/blackboardsh/zig-asar.git \
  de5b3c9018da6dd7462329847cead606d376b967 de5b3c9018da6dd7462329847cead606d376b967 \
  zig-asar-v0.2.7-de5b3c9018da6dd7462329847cead606d376b967

# Fetch the annotated WebKit tag and verify its peeled commit before archiving
# the complete tree. This is intentionally large.
archive_repo webkit https://github.com/WebKit/WebKit.git \
  refs/tags/WebKit-7624.4.5.14.1 27877cc2acd8a3cea8b3827ddb48d6c6c0177714 \
  WebKit-27877cc2acd8a3cea8b3827ddb48d6c6c0177714

download \
  https://electrobun-artifacts.blackboard.sh/cottontail/builds/e5660061b8e64b5ea044799da8518780a9987391/macos-arm64/cottontail.tar.gz \
  65983ede8068663adacfe738ea6ae27615642a4af680e0d5d9831af345848ea6 \
  "$out/objects/cottontail-v0.5.0-macos-arm64.tar.gz"
download \
  https://electrobun-artifacts.blackboard.sh/jsc/builds/46a8b00303faeba2c09854e78511845e9ccbeb9a/macos-arm64/jsc.tar.gz \
  14863e380780bc33a46999420abaf0bed17a12bff8000ee7ba77090aae3f55a2 \
  "$out/objects/cottontail-jsc-macos-arm64.tar.gz"
download \
  https://github.com/unicode-org/icu/releases/download/release-70-1/icu4c-70_1-src.tgz \
  8d205428c17bf13bb535300669ed28b338a157b1c01ae66d31d0d3e2d47c3fd5 \
  "$out/sources/icu4c-70_1-src.tgz"
download \
  https://github.com/google/brotli/archive/refs/tags/v1.2.0.tar.gz \
  816c96e8e8f193b40151dad7e8ff37b1221d019dbcb9c35cd3fadbfe6477dfec \
  "$out/sources/brotli-1.2.0.tar.gz"
download \
  https://github.com/openssl/openssl/releases/download/openssl-3.6.3/openssl-3.6.3.tar.gz \
  243a86649cf6f23eeb6a2ff2456e09e5d77dd9018a54d3d96b0c6bdd6ba6c7f1 \
  "$out/sources/openssl-3.6.3.tar.gz"
download \
  https://ziglang.org/download/0.16.0/zig-0.16.0.tar.xz \
  43186959edc87d5c7a1be7b7d2a25efffd22ce5807c7af99067f86f99641bfdf \
  "$out/sources/zig-0.16.0.tar.xz"
download \
  https://ziglang.org/download/0.16.0/zig-aarch64-macos-0.16.0.tar.xz \
  b23d70deaa879b5c2d486ed3316f7eaa53e84acf6fc9cc747de152450d401489 \
  "$out/toolchain/zig-aarch64-macos-0.16.0.tar.xz"

# Make the principal notices directly readable without extracting multi-GB
# source archives. The complete source trees retain all per-file notices.
cp "$work/cottontail/src/compiler/LICENSE.md" "$out/notices/COTTONTAIL-COMPILER-NOTICE.md"
cp "$work/cottontail/vendors/libuv/LICENSE" "$out/notices/libuv-LICENSE"
cp "$work/zig-html-rewriter/LICENSE" "$out/notices/zig-html-rewriter-LICENSE"
cp "$work/zig-asar/package.json" "$out/notices/zig-asar-package.json"
cp "$work/zig-asar/README.md" "$out/notices/zig-asar-README.md"
cp "$work/cottontail/package.json" "$out/notices/cottontail-package.json"
mkdir -p "$out/notices/WebKit/JavaScriptCore" "$out/notices/WebKit/WTF/wtf/dtoa" \
  "$out/notices/WebKit/WTF/wtf/fast_float" "$out/notices/WebKit/WTF/wtf/simdutf" \
  "$out/notices/WebKit/JavaScriptCore/disassembler/zydis"
cp "$work/webkit/Source/JavaScriptCore/COPYING.LIB" "$out/notices/WebKit/JavaScriptCore/"
cp "$work/webkit/Source/JavaScriptCore/disassembler/zydis/"LICENSE-*.txt \
  "$out/notices/WebKit/JavaScriptCore/disassembler/zydis/"
cp "$work/webkit/Source/WTF/"LICENSE-*.txt "$out/notices/WebKit/WTF/"
cp "$work/webkit/Source/WTF/wtf/dtoa/COPYING" "$out/notices/WebKit/WTF/wtf/dtoa/"
cp "$work/webkit/Source/WTF/wtf/dtoa/LICENSE" "$out/notices/WebKit/WTF/wtf/dtoa/"
cp "$work/webkit/Source/WTF/wtf/fast_float/LICENSE" "$out/notices/WebKit/WTF/wtf/fast_float/"
cp "$work/webkit/Source/WTF/wtf/simdutf/LICENSE-simdutf.txt" "$out/notices/WebKit/WTF/wtf/simdutf/"

mkdir -p "$work/cottontail-release" "$work/jsc-sdk" "$work/icu" "$work/brotli" "$work/openssl"
tar -xzf "$out/objects/cottontail-v0.5.0-macos-arm64.tar.gz" -C "$work/cottontail-release"
tar -xzf "$out/objects/cottontail-jsc-macos-arm64.tar.gz" -C "$work/jsc-sdk"
tar -xzf "$out/sources/icu4c-70_1-src.tgz" -C "$work/icu"
tar -xzf "$out/sources/brotli-1.2.0.tar.gz" -C "$work/brotli"
tar -xzf "$out/sources/openssl-3.6.3.tar.gz" -C "$work/openssl"
mkdir -p "$out/notices/Cottontail-release" "$out/notices/JSC-SDK" "$out/notices/ICU" \
  "$out/notices/Brotli" "$out/notices/OpenSSL"
find "$work/cottontail-release" -type f \( -iname 'LICENSE' -o -iname '*.LICENSE' \) \
  -exec cp {} "$out/notices/Cottontail-release/" \;
find "$work/jsc-sdk" -type f -iname 'LICENSE' -exec cp {} "$out/notices/JSC-SDK/" \;
cp "$(find "$work/icu" -type f -path '*/icu/LICENSE' -print -quit)" "$out/notices/ICU/LICENSE"
cp "$(find "$work/brotli" -type f -name LICENSE -print -quit)" "$out/notices/Brotli/LICENSE"
cp "$(find "$work/openssl" -type f -name LICENSE.txt -print -quit)" "$out/notices/OpenSSL/LICENSE.txt"

cp "$repo_root/RUNTIME_RELINKING.md" "$out/README.md"
cp "$repo_root/scripts/rebuild-cottontail-macos.sh" "$out/rebuild-cottontail-macos.sh"
cp "$repo_root/scripts/assemble-runtime-source-packet.sh" "$out/assemble-runtime-source-packet.sh"
chmod +x "$out/rebuild-cottontail-macos.sh"
chmod +x "$out/assemble-runtime-source-packet.sh"
cat > "$out/PROVENANCE.md" <<'EOF'
# Runtime packet provenance

- Cottontail: `e5660061b8e64b5ea044799da8518780a9987391` (`v0.5.0`)
- Cottontail JSC build: `46a8b00303faeba2c09854e78511845e9ccbeb9a`
- WebKit: `27877cc2acd8a3cea8b3827ddb48d6c6c0177714`
  (`WebKit-7624.4.5.14.1`)
- zig-html-rewriter: `a221646a3919c5fb51780437f08cc9e844bc2f5f`
- zig-asar: `de5b3c9018da6dd7462329847cead606d376b967` (`v0.2.7`)
- ICU: 70.1
- Brotli: 1.2.0
- OpenSSL: 3.6.3 (the version string embedded in the published Cottontail binary)
- Zig: 0.16.0

The Cottontail and JSC object archive URLs and expected hashes are pinned in
`scripts/assemble-runtime-source-packet.sh` in the Electrobun PDF source tree.
EOF

rm -rf "$out/work"
(cd "$out" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 shasum -a 256 > SHA256SUMS)
rm -f "$out.tar.zst" "$out.tar.zst.sha256"
tar -C "$(dirname "$out")" -cf - "$(basename "$out")" | zstd -19 -T0 -o "$out.tar.zst"
(cd "$(dirname "$out")" && shasum -a 256 "$(basename "$out").tar.zst" > "$(basename "$out").tar.zst.sha256")
echo "Created $out.tar.zst"
cat "$out.tar.zst.sha256"
