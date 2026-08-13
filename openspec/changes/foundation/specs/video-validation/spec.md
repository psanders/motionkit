## Purpose

Validates a Video Specification before rendering and reports problems as structured, machine-actionable errors so an AI agent driving MotionKit can understand and correct them without human intervention.

## ADDED Requirements

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

Validation SHALL check that every scene's declared transition type is one currently supported.

#### Scenario: Unsupported transition is rejected

- **WHEN** a scene declares a transition type other than `fade`
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
