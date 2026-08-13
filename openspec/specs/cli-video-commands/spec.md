# cli-video-commands Specification

## Purpose

Gives a human or script a terminal entry point to validate and render a Video Specification directly, for local testing and debugging of the MotionKit engine without an MCP client attached.

## Requirements

### Requirement: `validate` command reports specification validity

The CLI SHALL provide a `validate` command that takes a Video Specification file path, runs validation, and reports the result via exit code and console output.

#### Scenario: Valid specification reports success

- **WHEN** `motionkit validate` is run against a valid specification file
- **THEN** it prints a success confirmation and exits with code 0

#### Scenario: Invalid specification reports structured errors

- **WHEN** `motionkit validate` is run against an invalid specification file
- **THEN** it prints the structured validation errors and exits with a non-zero code

### Requirement: `render` command produces a video file

The CLI SHALL provide a `render` command that takes a Video Specification file path, renders it, and reports the output file path on success.

#### Scenario: Valid specification renders successfully

- **WHEN** `motionkit render` is run against a valid specification file
- **THEN** it produces an MP4 file, prints its output path, and exits with code 0

### Requirement: `render` fails fast on an invalid specification

The `render` command SHALL NOT attempt to render a specification that fails validation.

#### Scenario: Invalid specification blocks rendering

- **WHEN** `motionkit render` is run against a specification that fails validation
- **THEN** no video file is produced, the structured validation errors are printed, and the command exits with a non-zero code

### Requirement: Render output path is controllable

The `render` command SHALL accept an optional output path; when omitted, it SHALL use and report a sensible default location.

#### Scenario: Explicit output path is honored

- **WHEN** `motionkit render` is run with an explicit output path
- **THEN** the rendered file is written to that path

#### Scenario: Default output path is used and reported

- **WHEN** `motionkit render` is run without an explicit output path
- **THEN** the rendered file is written to a default location and that location is printed
