import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootPackage = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const queue = [...Object.keys(rootPackage.dependencies ?? {}), "electrobun"];
const packages = new Map();

const packageDirectory = (name) => join(projectRoot, "node_modules", ...name.split("/"));

while (queue.length > 0) {
  const name = queue.shift();
  if (packages.has(name)) continue;

  const directory = packageDirectory(name);
  const manifestPath = join(directory, "package.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Installed package metadata is missing for ${name}`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  packages.set(name, { directory, manifest });
  for (const dependency of [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}).filter(
      (peer) =>
        !peer.startsWith("@types/") &&
        manifest.peerDependenciesMeta?.[peer]?.optional !== true,
    ),
  ]) {
    if (!packages.has(dependency)) queue.push(dependency);
  }
}

const licenseNames = [
  "LICENSE", "LICENSE.md", "LICENSE.txt", "LICENSE.markdown",
  "LICENCE", "LICENCE.md", "LICENCE.txt", "COPYING", "COPYING.md",
  "COPYING.txt", "CopyrightNotice.txt",
];
const textGroups = new Map();
const inventory = [];

for (const [name, { directory, manifest }] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
  const files = licenseNames
    .map((file) => ({ file, path: join(directory, file) }))
    .filter(({ path }) => existsSync(path))
    .map(({ file, path }) => ({ file, text: readFileSync(path, "utf8").trim() }))
    .filter(({ text }) => text.length > 0);

  inventory.push(`- \`${name}@${manifest.version}\` — ${manifest.license ?? "not declared in installed metadata"}`);
  for (const { file, text } of files) {
    const hash = createHash("sha256").update(text).digest("hex");
    const group = textGroups.get(hash) ?? { packages: [], text };
    group.packages.push(`${name}@${manifest.version} (${file})`);
    textGroups.set(hash, group);
  }
}

const sections = [...textGroups.values()]
  .sort((a, b) => a.packages[0].localeCompare(b.packages[0]))
  .map(({ packages: names, text }) => `## ${names.join(", ")}\n\n\`\`\`text\n${text}\n\`\`\``)
  .join("\n\n");

const output = `# Third-Party Notices

This inventory was generated from the installed production dependency and required runtime peer-dependency closure in \`node_modules\`, plus Electrobun because it supplies the packaged desktop runtime. Versions and license expressions below come from each installed package's \`package.json\`; reproduced texts come verbatim from non-empty license or copyright files shipped in that package.

This is a best-effort npm-component inventory, not a legal conclusion or a claim that it exhaustively identifies every platform SDK, system library, generated asset, font, or optional platform-specific binary that a particular build may contain. Release maintainers must inspect each actual artifact and update this file after dependency or toolchain changes. The project license is in \`LICENSE\` and is not replaced by these notices.

Generated with \`bun run notices\`.

## Installed component inventory

${inventory.join("\n")}

## License texts shipped by installed packages

Some installed packages declare a license in metadata but ship no non-empty standalone license file. Those packages remain listed above; this generator does not substitute a guessed text.

${sections}
`;

writeFileSync(join(projectRoot, "THIRD_PARTY_NOTICES.md"), output);
console.log(`Wrote THIRD_PARTY_NOTICES.md for ${packages.size} installed packages and ${textGroups.size} distinct license texts.`);
