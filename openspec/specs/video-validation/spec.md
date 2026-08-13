# video-validation Specification

## Purpose

Validates a Video Specification before rendering and reports problems as structured, machine-actionable errors so an AI agent driving MotionKit can understand and correct them without human intervention.

## Requirements

### Requirement: Structural validation

Validation SHALL check that a document conforms to the Video Specification shape (required fields present, correct types) before checking semantic rules.

#### Scenario: Malformed document fails structural validation

- **WHEN** a document is missing a required field or has a field of the wrong type
- **THEN** validation returns a failure result identifying the offending field, without attempting semantic checks

### Requirement: Referenced assets must exist

Validation SHALL check that every scene's `asset` path resolves to a file that exists on disk.

#### Scenario: Missing asset is reported

- **WHEN** a scene references an asset path that does not exist on disk
- **THEN** validation returns a failure identifying the missing path and the scene that references it

#### Scenario: Missing asset suggests alternatives

- **WHEN** a referenced asset is missing and other files exist in the same directory
- **THEN** the failure includes those file names as suggestions

### Requirement: Scene durations must be positive

Validation SHALL check that every scene's `duration` is a positive number.

#### Scenario: Zero or negative duration is rejected

- **WHEN** a scene's `duration` is zero or negative
- **THEN** validation returns a failure identifying the offending scene and its invalid duration

### Requirement: Format must be supported

Validation SHALL check that the specification's `format` is one of the currently supported formats.

#### Scenario: Unsupported format is rejected

- **WHEN** `format` is not `16:9` or `9:16`
- **THEN** validation returns a failure listing the supported formats

### Requirement: Transition type must be supported

Validation SHALL check that every scene's declared transition type is one currently supported: `fade`, `slide-left`, `slide-right`, or `zoom`.

#### Scenario: Unsupported transition is rejected

- **WHEN** a scene declares a transition type other than `fade`, `slide-left`, `slide-right`, or `zoom`
- **THEN** validation returns a failure listing the supported transition types

### Requirement: Structured, non-throwing error reporting

Validation SHALL report every rule violation as a structured error with a machine-readable code and a human-readable message, and SHALL NOT raise an exception for an expected input problem.

#### Scenario: Multiple violations are all reported

- **WHEN** a specification violates more than one rule (e.g. a missing asset and a negative duration)
- **THEN** validation returns all violations in a single structured result rather than stopping at the first

#### Scenario: Validation of malformed input does not throw

- **WHEN** validation is run against a specification with any of the above problems
- **THEN** it returns a failure result rather than throwing an exception

### Requirement: Valid specification passes

A specification satisfying every structural and semantic rule SHALL validate successfully with no reported errors.

#### Scenario: Fully valid specification passes

- **WHEN** a specification has correct structure, existing assets, positive durations, a supported format, and only supported transitions
- **THEN** validation returns a success result with an empty error list

### Requirement: Brand reference must resolve to a known brand

Validation SHALL check that a specification's `brand` id (explicit or defaulted to `"default"`) resolves to a registered brand.

#### Scenario: Unknown brand is reported

- **WHEN** a specification declares a brand id that has no matching registered brand
- **THEN** validation returns a failure identifying the unknown brand id

#### Scenario: Unknown brand suggests available brands

- **WHEN** a specification declares an unknown brand id
- **THEN** the failure includes the ids of registered brands as suggestions

### Requirement: Scene caption must be non-empty when declared

Validation SHALL check that a scene's `caption`, when declared, is a non-empty string.

#### Scenario: Empty caption is rejected

- **WHEN** a scene declares `caption: ""`
- **THEN** validation returns a failure identifying the offending scene

### Requirement: Scene frame must be a supported frame type

Validation SHALL check that a scene's `frame`, when declared, is one of the currently supported frame types (`browser`).

#### Scenario: Unsupported frame is rejected

- **WHEN** a scene declares a `frame` value other than `browser`
- **THEN** validation returns a failure listing the supported frame types

### Requirement: Scene logo position must be valid when given

Validation SHALL check that a scene's `logo` position override, when given, is one of the currently supported placements (`top_left`, `top_right`, `bottom_left`, `bottom_right`, `center`).

#### Scenario: Unsupported logo position is rejected

- **WHEN** a scene declares a `logo` position that is not one of the supported placements
- **THEN** validation returns a failure listing the supported placements
