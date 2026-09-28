#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != Darwin || "$(uname -m)" != arm64 ]]; then
  echo "This recipe targets macOS arm64." >&2
  exit 1
fi

packet_dir="$(cd "$(dirname "$0")" && pwd)"
jsc_archive="$packet_dir/objects/cottontail-jsc-macos-arm64.tar.gz"
if [[ "${1:-}" == "--jsc-archive" ]]; then
  [[ $# -eq 2 ]] || { echo "usage: $0 [--jsc-archive PATH]" >&2; exit 2; }
  jsc_archive="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
elif [[ $# -ne 0 ]]; then
  echo "usage: $0 [--jsc-archive PATH]" >&2
  exit 2
fi

for command in node tar shasum brew python3; do
  command -v "$command" >/dev/null || { echo "missing required command: $command" >&2; exit 1; }
done

node_major="$(node -p 'process.versions.node.split(".")[0]')"
[[ "$node_major" == 24 ]] || { echo "Node 24 is required (found $(node --version))." >&2; exit 1; }

work="$packet_dir/work"
rm -rf "$work"
mkdir -p "$work/cottontail"
tar -xzf "$packet_dir/sources/cottontail-e5660061b8e64b5ea044799da8518780a9987391.tar.gz" \
  --strip-components=1 -C "$work/cottontail"

expected_jsc=14863e380780bc33a46999420abaf0bed17a12bff8000ee7ba77090aae3f55a2
actual_jsc="$(shasum -a 256 "$jsc_archive" | awk '{print $1}')"
if [[ "$jsc_archive" == "$packet_dir/objects/cottontail-jsc-macos-arm64.tar.gz" && "$actual_jsc" != "$expected_jsc" ]]; then
  echo "exact JSC SDK checksum mismatch: $actual_jsc" >&2
  exit 1
fi

cd "$work/cottontail"
rm -rf vendors/zig vendors/zig-html-rewriter
mkdir -p vendors/zig vendors/zig-html-rewriter
tar -xJf "$packet_dir/toolchain/zig-aarch64-macos-0.16.0.tar.xz" \
  --strip-components=1 -C vendors/zig
printf '0.16.0\n' > vendors/zig/.zig-version
printf '0.16.0 darwin-arm64 b23d70deaa879b5c2d486ed3316f7eaa53e84acf6fc9cc747de152450d401489\n' \
  > vendors/zig/.zig-vendored
tar -xzf "$packet_dir/sources/zig-html-rewriter-a221646a3919c5fb51780437f08cc9e844bc2f5f.tar.gz" \
  --strip-components=1 -C vendors/zig-html-rewriter
printf 'a221646a3919c5fb51780437f08cc9e844bc2f5f 4682867f61620cb6617d0e302da15305dcf722329dc8a5a5517ea276f6c53585\n' \
  > vendors/zig-html-rewriter/.vendor-revision
COTTONTAIL_JSC_ARCHIVE="$jsc_archive" node scripts/setup-jsc.js
jsc_dir="vendors/jsc/jsc-WebKit-7624.4.5.14.1-46a8b00303fa/macos-arm64"
for archive in libJavaScriptCore.a libCottontailJSCEmbedder.a libWTF.a libbmalloc.a; do
  [[ -f "$jsc_dir/lib/$archive" ]] || { echo "JSC SDK is missing $archive" >&2; exit 1; }
done

# Cottontail 0.5.0 hard-codes /opt/homebrew for Brotli. Keep dependencies
# isolated when the formula is not linked there by extracting its bottle and
# changing only this disposable source tree.
if [[ ! -f /opt/homebrew/lib/libbrotlicommon.a ]]; then
  brew fetch --force brotli >/dev/null
  bottle="$(brew --cache brotli)"
  mkdir -p "$work/brotli"
  tar -xzf "$bottle" -C "$work/brotli"
  brotli_lib="$(dirname "$(find "$work/brotli" -name libbrotlicommon.a -print -quit)")"
  brotli_include="$(dirname "$(find "$work/brotli" -type d -path '*/include/brotli' -print -quit)")"
  [[ -n "$brotli_lib" && -n "$brotli_include" ]] || { echo "Brotli bottle layout not recognized" >&2; exit 1; }
  python3 - "$brotli_include" "$brotli_lib" <<'PY'
from pathlib import Path
import sys
p = Path("build.zig")
s = p.read_text()
s = s.replace('/opt/homebrew/include', sys.argv[1]).replace('/opt/homebrew/lib', sys.argv[2])
p.write_text(s)
PY
fi

# Zig 0.16.0's bundled libc++ uses INFINITY in a context rejected by the Xcode
# 27 headers. The release's Xcode 26.4 does not need this compatibility edit.
if [[ "$(xcodebuild -version | awk 'NR==1 {split($2,v,"."); print v[1]}')" -ge 27 ]]; then
  python3 - <<'PY'
from pathlib import Path
p = Path("vendors/zig/lib/libcxx/include/__random/clamp_to_integral.h")
s = p.read_text()
if "INFINITY" in s:
    p.write_text(s.replace("INFINITY", "__builtin_inff()"))
PY
fi

node scripts/build-release.js
test "$(./zig-out/bin/cottontail --version)" = 0.5.0
test "$(./zig-out/bin/cottontail -p '6 * 7')" = 42
codesign --verify --strict --verbose=2 ./zig-out/bin/cottontail
shasum -a 256 ./zig-out/bin/cottontail
