// Ambient declarations for dependencies that Electrobun pulls in as untyped
// TypeScript source. `skipLibCheck` does not cover these because they are `.ts`
// files, not `.d.ts`. Each `declare module` resolves the import to `any` so the
// app's typecheck is not blocked by a transitive dependency it does not use.
// Remove an entry if/when the upstream package ships its own types.
declare module "three";
