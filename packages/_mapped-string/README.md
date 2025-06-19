tl;dr DO NOT EDIT THESE FILES!!

## packages/_*

The packages in `package/_*` (that is, with a leading _) are copies of their namesakes that lack underscores.
They exist to allow code reuse among bundlers that don't agree in how to resolve modules.

These packages have no build steps and are pure typescript.

The packages without underscore will have more typical package.json setups.

The files in `packages/_*/src/*.ts` will be identical to those in `packages/*/src/*.ts`, _except_ for the imports.ts file.

This file centralizes all the import syntax that must differ between the two package versions.

Ideally, we would keep the two package file versions as symbolic links of each other, but using symbolic links triggers a compilation bug in `vite build` where files end up being resolved from the wrong location. As a result, we are forced to maintain explicit copies
that need to be in sync with each other.
