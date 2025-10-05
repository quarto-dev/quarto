# @quarto/mapped-string

A TypeScript library that provides a string data structure with integrated source maps, enabling precise tracking of character positions through string transformations.

## Overview

`@quarto/mapped-string` solves a common problem in text processing: maintaining accurate source location information when performing string manipulations. This is particularly valuable for error reporting.

The library centers around the `MappedString` interface, which wraps a regular string with a `map` function that can translate any character index back to its position in the original source. Operations like `mappedSubstring`, `mappedReplace`, `mappedTrim`, and `skipRegexp` all preserve this mapping information, allowing complex string processing pipelines while maintaining perfect source location fidelity.

## Key Features

- **Source mapping preservation**: Every string operation maintains bidirectional mapping to original positions
- **Composable transformations**: Chain multiple string operations while preserving location information
- **Error location reporting**: Built-in support for precise error reporting with line/column information
- **String method equivalents**: Mapped versions of common string operations like `trim`, `replace`, `split`, and `substring`
- **TypeScript support**: Full type safety with comprehensive interfaces and type definitions

## Installation

```bash
npm install @quarto/mapped-string
```
