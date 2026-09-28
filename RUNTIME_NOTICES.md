# Desktop runtime notices

This file covers native desktop runtime components that are not installed from
the application's JavaScript dependency tree. JavaScript dependency notices
are in `THIRD_PARTY_NOTICES.md`.

The macOS arm64 build inspected for this notice contains Electrobun 2.0.1 and
Cottontail 0.5.0 (revision
`e5660061b8e64b5ea044799da8518780a9987391`). Hutch is a build tool and is not
included in the application bundle.

## Electrobun 2.0.1

Source: <https://github.com/blackboardsh/electrobun/tree/v2.0.1>

MIT License

Copyright (c) 2024 Blackboard Technologies inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Electrobun native update helpers

The runtime contains `bspatch` from zig-bsdiff 0.1.23 and `zig-zstd` from
zig-zstd 0.1.7. Both upstream projects declare the MIT license. The helpers
also use Zstandard; its BSD license is reproduced below.

Sources:

- <https://github.com/blackboardsh/zig-bsdiff>
- <https://github.com/blackboardsh/zig-zstd>
- <https://github.com/facebook/zstd>

### zig-bsdiff

MIT License

Copyright (c) 2024 Blackboard Technologies inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### zig-zstd

MIT License

Copyright (c) 2026 Blackboard Technologies inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### Zstandard

BSD License

For Zstandard software

Copyright (c) Meta Platforms, Inc. and affiliates. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

- Redistributions of source code must retain the above copyright notice,
  this list of conditions and the following disclaimer.
- Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.
- Neither the name Facebook, nor Meta, nor the names of its contributors may
  be used to endorse or promote products derived from this software without
  specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.

## Cottontail 0.5.0

Source: <https://github.com/blackboardsh/cottontail/tree/e5660061b8e64b5ea044799da8518780a9987391>

Cottontail's package metadata declares `MIT`; the pinned source revision does
not contain a separate top-level license text. The absence of that duplicate
file is not, by itself, evidence that redistribution is prohibited. Its source
does identify statically linked JavaScriptCore / WebKit code under LGPL-2 and
additional third-party libraries.

The exact Cottontail release archive and source revision remain publicly
obtainable:

- binary archive: <https://electrobun-artifacts.blackboard.sh/cottontail/builds/e5660061b8e64b5ea044799da8518780a9987391/macos-arm64/cottontail.tar.gz>
  (`SHA-256 65983ede8068663adacfe738ea6ae27615642a4af680e0d5d9831af345848ea6`);
- source: <https://github.com/blackboardsh/cottontail/tree/e5660061b8e64b5ea044799da8518780a9987391>;
- exact static JavaScriptCore SDK, including `.a` object archives:
  <https://electrobun-artifacts.blackboard.sh/jsc/builds/46a8b00303faeba2c09854e78511845e9ccbeb9a/macos-arm64/jsc.tar.gz>
  (`SHA-256 14863e380780bc33a46999420abaf0bed17a12bff8000ee7ba77090aae3f55a2`);
- JSC build scripts and patches:
  <https://github.com/blackboardsh/jsc/tree/46a8b00303faeba2c09854e78511845e9ccbeb9a>;
- WebKit source commit used by that SDK:
  <https://github.com/WebKit/WebKit/commit/27877cc2acd8a3cea8b3827ddb48d6c6c0177714>.

The upstream Cottontail archive includes ICU, picomatch, URLPattern, and YAML
license files. Electrobun PDF's separately distributed Cottontail 0.5.0 runtime
source packet adds the compiler-derived notice, the WebKit/JSC license corpus,
complete corresponding source, exact static JSC SDK objects, the non-LGPL
Cottontail program source, pinned build scripts and toolchain, and a tested
source-based relinking recipe. See `RUNTIME_RELINKING.md` and the packet's
`README.md`, `PROVENANCE.md`, and `SHA256SUMS`.

The relinking route compiles the Cottontail program and its JSC bindings from
source before linking them with the supplied JSC, WTF, bmalloc, embedder, and
ICU archives. The `.a` files are therefore not represented as all application
objects. The packet also includes the exact WebKit source and JSC build scripts
needed to replace those archives with a modified JavaScriptCore build.

In particular, consult:

- `src/compiler/LICENSE.md` in the pinned Cottontail source;
- `vendors/libuv/LICENSE` in the pinned Cottontail source;
- the exact JavaScriptCore SDK and WebKit commit named by Cottontail's
  `scripts/jsc-manifest.json`; and
- the license files for all libraries linked into that JavaScriptCore release.

The source packet preserves all per-file notices in the complete source trees;
its directly readable `notices/` directory contains the principal compiler,
JavaScriptCore, WTF, bmalloc, libuv, and zig-html-rewriter notices.

## libasar

The runtime contains `libasar.dylib`, sourced by Electrobun from zig-asar
0.2.7: <https://github.com/blackboardsh/zig-asar/tree/v0.2.7>. The bundled file
is byte-for-byte identical to the publisher's macOS arm64 v0.2.7 release asset
(`SHA-256 fdba75ce25691001671a08708b3335e9829e7ae43178c90fc8c0a8c69db13a04`).
The v0.2.7 tagged source identifies the project as MIT in both `package.json`
and the `README.md` License section. This conclusion rests on those explicit
upstream license declarations, not on the fact that Electrobun redistributes
the file. The release asset itself omits a separate license file.

MIT License

Copyright (c) Blackboard Technologies Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
