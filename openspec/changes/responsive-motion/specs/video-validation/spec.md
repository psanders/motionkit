## MODIFIED Requirements

### Requirement: Format must be supported

Validation SHALL check that the specification's `format` is one of the currently supported formats: `16:9`, `9:16`, or `1:1`.

#### Scenario: Unsupported format is rejected

- **WHEN** `format` is not `16:9`, `9:16`, or `1:1`
- **THEN** validation returns a failure listing the supported formats

### Requirement: Scene frame must be a supported frame type

Validation SHALL check that a scene's `frame`, when declared, is one of the currently supported frame types (`browser`, `phone`).

#### Scenario: Unsupported frame is rejected

- **WHEN** a scene declares a `frame` value other than `browser` or `phone`
- **THEN** validation returns a failure listing the supported frame types

## ADDED Requirements

### Requirement: Scene motion type must be supported

Validation SHALL check that a scene's `motion.type`, when declared, is one of the currently supported types (`horizontal_pan`, `vertical_pan`, `zoom`, `static`).

#### Scenario: Unsupported motion type is rejected

- **WHEN** a scene declares a `motion.type` other than `horizontal_pan`, `vertical_pan`, `zoom`, or `static`
- **THEN** validation returns a failure listing the supported motion types

### Requirement: Scene motion direction must match its motion type

Validation SHALL check that a scene's `motion.direction`, when declared, is valid for the declared `motion.type` (`left_to_right`/`right_to_left` for `horizontal_pan`; `top_to_bottom`/`bottom_to_top` for `vertical_pan`; not applicable to `zoom` or `static`).

#### Scenario: Direction mismatched with motion type is rejected

- **WHEN** a scene declares a `direction` incompatible with its `motion.type` (e.g. `direction: "left_to_right"` on a `zoom` motion)
- **THEN** validation returns a failure identifying the mismatch

### Requirement: Scene motion focal point must be within bounds

Validation SHALL check that a scene's `motion.focalPoint`, when declared, has `x` and `y` values each within `0` and `1` inclusive.

#### Scenario: Out-of-bounds focal point is rejected

- **WHEN** a scene declares a `motion.focalPoint` with `x` or `y` outside the `0`–`1` range
- **THEN** validation returns a failure identifying the offending scene and the out-of-bounds value
