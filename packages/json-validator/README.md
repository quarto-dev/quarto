# json-validator

`json-validator` is a validation library for JSON objects that emphasizes good error messages.
It is particularly suitable for validating objects and documents serialized in disk.
It can be used to validate, for example, YAML files (which are loaded as JSON objects).

## Schemas

This library uses a schema format that is similar but not identical to [JSON Schema](https://json-schema.org/).

A full description of the differences is TBF but, notably, `json-validator` does not support JSON Schema's `oneOf` schema.
`oneOf` is not _monotonic_: it requires logical negation.
Generalized negation introduces fundamental difficulties for good error message generation.
(Not all of `json-validator`'s schemas are monotonic; forbidding particular keys in objects is a very useful feature, and
`json-validator` allows that.)
