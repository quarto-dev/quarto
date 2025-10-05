import { test } from 'node:test';
import assert from 'node:assert';
import {
  asMappedString,
  mappedSubstring,
  mappedConcat,
  mappedString,
  mappedTrim,
  mappedTrimStart,
  mappedTrimEnd,
  join,
  mappedLines,
  mappedReplace,
  breakOnDelimiter,
  mappedNormalizeNewlines,
  skipRegexp,
  skipRegexpAll,
  mappedIndexToLineCol,
  type MappedString,
  type EitherString
} from "../src/index";
import { rangedSubstring, rangedLines } from "../src/index";
import { lines, normalizeNewlines, indexToLineCol } from "../src/index";

test('asMappedString creates a mapped string from a regular string', () => {
  const str = "hello world";
  const mapped = asMappedString(str);
  
  assert.strictEqual(mapped.value, str);
  assert.strictEqual(mapped.fileName, undefined);
  
  // Test mapping functionality
  const mapResult = mapped.map(6);
  assert.notStrictEqual(mapResult, undefined);
  assert.strictEqual(mapResult!.index, 6);
  assert.strictEqual(mapResult!.originalString, mapped);
});

test('asMappedString with filename', () => {
  const str = "hello world";
  const fileName = "test.txt";
  const mapped = asMappedString(str, fileName);
  
  assert.strictEqual(mapped.value, str);
  assert.strictEqual(mapped.fileName, fileName);
});

test('asMappedString returns existing MappedString unchanged', () => {
  const str = "hello world";
  const mapped = asMappedString(str, "test.txt");
  const remapped = asMappedString(mapped);
  
  assert.strictEqual(remapped, mapped);
});

test('mappedSubstring creates substring with correct mapping', () => {
  const original = "hello world";
  const mapped = asMappedString(original);
  const sub = mappedSubstring(mapped, 6, 11);
  
  assert.strictEqual(sub.value, "world");
  
  // Test that mapping works correctly
  const mapResult = sub.map(0);
  assert.notStrictEqual(mapResult, undefined);
  assert.strictEqual(mapResult!.index, 6);
});

test('mappedSubstring with string input', () => {
  const original = "hello world";
  const sub = mappedSubstring(original, 6);
  
  assert.strictEqual(sub.value, "world");
  
  const mapResult = sub.map(0);
  assert.notStrictEqual(mapResult, undefined);
  assert.strictEqual(mapResult!.index, 6);
});

test('mappedConcat joins multiple strings', () => {
  const strings = ["hello", " ", "world"];
  const result = mappedConcat(strings);
  
  assert.strictEqual(result.value, "hello world");
  
  // Test mapping of different parts
  const helloMap = result.map(0);
  const spaceMap = result.map(5);
  const worldMap = result.map(6);
  
  assert.notStrictEqual(helloMap, undefined);
  assert.notStrictEqual(spaceMap, undefined);
  assert.notStrictEqual(worldMap, undefined);
});

test('mappedConcat with empty array', () => {
  const result = mappedConcat([]);
  assert.strictEqual(result.value, "");
  assert.strictEqual(result.map(0), undefined);
});

test('mappedString creates string from pieces', () => {
  const source = "hello beautiful world";
  const pieces = [
    { start: 0, end: 5 },    // "hello"
    " ",                      // literal string
    { start: 16, end: 21 }   // "world"
  ];
  
  const result = mappedString(source, pieces);
  assert.strictEqual(result.value, "hello world");
  
  // Test that mapping works for each piece
  const helloMap = result.map(0);
  const worldMap = result.map(6);
  
  assert.notStrictEqual(helloMap, undefined);
  assert.notStrictEqual(worldMap, undefined);
  assert.strictEqual(helloMap!.index, 0);
  assert.strictEqual(worldMap!.index, 16);
});

test('mappedTrim removes whitespace', () => {
  const source = "  hello world  ";
  const mapped = asMappedString(source);
  const trimmed = mappedTrim(mapped);
  
  assert.strictEqual(trimmed.value, "hello world");
  
  const mapResult = trimmed.map(0);
  assert.notStrictEqual(mapResult, undefined);
  assert.strictEqual(mapResult!.index, 2); // Should map to original position
});

test('mappedTrimStart removes leading whitespace', () => {
  const source = "  hello world  ";
  const mapped = asMappedString(source);
  const trimmed = mappedTrimStart(mapped);
  
  assert.strictEqual(trimmed.value, "hello world  ");
});

test('mappedTrimEnd removes trailing whitespace', () => {
  const source = "  hello world  ";
  const mapped = asMappedString(source);
  const trimmed = mappedTrimEnd(mapped);
  
  assert.strictEqual(trimmed.value, "  hello world");
});

test('join works like Array.join', () => {
  const strings = ["hello", "beautiful", "world"];
  const result = join(strings, " ");
  
  assert.strictEqual(result.value, "hello beautiful world");
});

test('mappedLines splits into lines', () => {
  const source = "line1\nline2\nline3";
  const mapped = asMappedString(source);
  const lines = mappedLines(mapped);
  
  assert.strictEqual(lines.length, 3);
  assert.strictEqual(lines[0].value, "line1");
  assert.strictEqual(lines[1].value, "line2");
  assert.strictEqual(lines[2].value, "line3");
});

test('mappedReplace replaces string', () => {
  const source = "hello world";
  const mapped = asMappedString(source);
  const replaced = mappedReplace(mapped, "world", "universe");
  
  assert.strictEqual(replaced.value, "hello universe");
});

test('mappedReplace with regex', () => {
  const source = "hello world world";
  const mapped = asMappedString(source);
  const replaced = mappedReplace(mapped, /world/g, "universe");
  
  assert.strictEqual(replaced.value, "hello universe universe");
});

test('breakOnDelimiter splits string keeping delimiters', () => {
  const source = "a,b,c";
  const mapped = asMappedString(source);
  const parts = breakOnDelimiter(mapped, ",");
  
  assert.strictEqual(parts.length, 2);
  assert.strictEqual(parts[0].value, "a,");
  assert.strictEqual(parts[1].value, "b,");
});

test('mappedNormalizeNewlines handles different line endings', () => {
  const source = "line1\r\nline2\nline3\r\nline4";
  const mapped = asMappedString(source);
  const normalized = mappedNormalizeNewlines(mapped);
  
  assert.strictEqual(normalized.value, "line1\nline2\nline3\nline4");
});

test('skipRegexp removes first match', () => {
  const source = "hello world world";
  const mapped = asMappedString(source);
  const result = skipRegexp(mapped, /world/);
  
  assert.strictEqual(result.value, "hello  world");
});

test('skipRegexpAll removes all matches', () => {
  const source = "hello world world";
  const mapped = asMappedString(source);
  const result = skipRegexpAll(mapped, /world/g);
  
  assert.strictEqual(result.value, "hello  ");
});

test('mappedIndexToLineCol converts index to line/column', () => {
  const source = "line1\nline2\nline3";
  const mapped = asMappedString(source);
  const converter = mappedIndexToLineCol(mapped);
  
  const pos1 = converter(0);   // Start of first line
  const pos2 = converter(6);   // Start of second line
  const pos3 = converter(12);  // Start of third line
  
  assert.strictEqual(pos1.line, 0);
  assert.strictEqual(pos1.column, 0);
  assert.strictEqual(pos2.line, 1);
  assert.strictEqual(pos2.column, 0);
  assert.strictEqual(pos3.line, 2);
  assert.strictEqual(pos3.column, 0);
});

test('rangedSubstring creates substring with range info', () => {
  const source = "hello world";
  const ranged = rangedSubstring(source, 6, 11);
  
  assert.strictEqual(ranged.substring, "world");
  assert.strictEqual(ranged.range.start, 6);
  assert.strictEqual(ranged.range.end, 11);
});

test('rangedLines splits text into lines with ranges', () => {
  const source = "line1\nline2\nline3";
  const lines = rangedLines(source);
  
  assert.strictEqual(lines.length, 3);
  assert.strictEqual(lines[0].substring, "line1");
  assert.strictEqual(lines[0].range.start, 0);
  assert.strictEqual(lines[0].range.end, 5);
  assert.strictEqual(lines[1].substring, "line2");
  assert.strictEqual(lines[1].range.start, 6);
  assert.strictEqual(lines[1].range.end, 11);
});

test('text utility functions work correctly', () => {
  const source = "line1\nline2\nline3";
  
  const textLines = lines(source);
  assert.strictEqual(textLines.length, 3);
  assert.strictEqual(textLines[0], "line1");
  
  const normalized = normalizeNewlines("line1\r\nline2");
  assert.strictEqual(normalized, "line1\nline2");
  
  const converter = indexToLineCol(source);
  const pos = converter(6);
  assert.strictEqual(pos.line, 1);
  assert.strictEqual(pos.column, 0);
});

test('map function handles out-of-bounds access', () => {
  const mapped = asMappedString("hello");
  
  assert.strictEqual(mapped.map(-1), undefined);
  assert.strictEqual(mapped.map(10), undefined);
});

test('map function with closest parameter', () => {
  const mapped = asMappedString("hello");
  
  const result1 = mapped.map(-1, true);
  assert.notStrictEqual(result1, undefined);
  assert.strictEqual(result1!.index, 0);
  
  const result2 = mapped.map(10, true);
  assert.notStrictEqual(result2, undefined);
  assert.strictEqual(result2!.index, 4);
});

test('complex mapping chain preserves original references', () => {
  const original = "hello beautiful world";
  const mapped1 = asMappedString(original, "test.txt");
  const sub1 = mappedSubstring(mapped1, 6, 15); // "beautiful"
  const sub2 = mappedSubstring(sub1, 0, 4); // "beau"
  
  assert.strictEqual(sub2.value, "beau");
  
  const mapResult = sub2.map(0);
  assert.notStrictEqual(mapResult, undefined);
  assert.strictEqual(mapResult!.index, 6);
  assert.strictEqual(mapResult!.originalString.value, original);
  assert.strictEqual(mapResult!.originalString.fileName, "test.txt");
});
