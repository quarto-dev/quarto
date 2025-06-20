/*
 * index.ts
 *
 * Copyright (C) 2024 by Posit Software, PBC
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the “Software”), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export * from "./validator";
export {
  type ValidatedParseResult,
  type ValidatorErrorHandlerFunction,
  type YAMLSchemaT,
  type Schema,
  type ConcreteSchema,
  type SchemaType,
  type InstancePath,
  type SchemaPath,
  type ValidationError,
  type LocalizedError,
  type Completion,
  type FalseSchema,
  type TrueSchema,
  type SchemaAnnotations,
  type SchemaDocumentation,
  type BooleanSchema,
  type AnySchema,
  type NumberSchema,
  type StringSchema,
  type NullSchema,
  type EnumSchema,
  type AnyOfSchema,
  type AllOfSchema,
  type ArraySchema,
  type ObjectSchema,
  type RefSchema,
  type ValidationTraceNode,
  type SchemaCall,
  schemaType,
  schemaDispatch,
  schemaCall,
  schemaDocString,
  schemaDescription
} from "./types";

export * from "./schema";
export * from "./validator-queue";
export { initState, setInitializer } from "./state";
