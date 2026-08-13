## RENAMED Requirements

- FROM: `### Requirement: Scene browser-frame decoration`
- TO: `### Requirement: Scene frame decoration`

## MODIFIED Requirements

### Requirement: Scene frame decoration

A scene SHALL be able to declare an optional static `frame` decoration — `"browser"` or `"phone"` — that wraps its visual content in the corresponding chrome frame.

#### Scenario: Browser frame is accepted

- **WHEN** a scene declares `frame: "browser"`
- **THEN** it is accepted as a valid frame declaration

#### Scenario: Phone frame is accepted

- **WHEN** a scene declares `frame: "phone"`
- **THEN** it is accepted as a valid frame declaration

#### Scenario: Unrecognized frame value is rejected

- **WHEN** a scene declares a `frame` value other than `"browser"` or `"phone"`
- **THEN** it is rejected as an unsupported frame

### Requirement: Supported output formats

The Video Specification SHALL support three output formats: `16:9`, `9:16`, and `1:1`.

#### Scenario: Supported format is accepted

- **WHEN** `format` is `16:9`, `9:16`, or `1:1`
- **THEN** it is accepted

#### Scenario: Unsupported format is rejected

- **WHEN** `format` is any value other than `16:9`, `9:16`, or `1:1`
- **THEN** it is rejected as unsupported

## ADDED Requirements

### Requirement: Scene motion

A scene SHALL be able to declare an optional `motion` — semantic pan/zoom/crop intent (`type`, an optional `direction`, and an optional `focalPoint`) rather than pixel-level transforms. `motion` is independent of `frame`: a scene may declare motion with or without a frame decoration.

#### Scenario: Horizontal pan is accepted

- **WHEN** a scene declares `motion: { type: "horizontal_pan" }`
- **THEN** it is accepted as a valid motion declaration, defaulting `direction` to `"left_to_right"`

#### Scenario: Horizontal pan direction can be overridden

- **WHEN** a scene declares `motion: { type: "horizontal_pan", direction: "right_to_left" }`
- **THEN** it is accepted as a valid motion declaration using the given direction

#### Scenario: Vertical pan is accepted

- **WHEN** a scene declares `motion: { type: "vertical_pan" }`
- **THEN** it is accepted as a valid motion declaration, defaulting `direction` to `"top_to_bottom"`

#### Scenario: Vertical pan direction can be overridden

- **WHEN** a scene declares `motion: { type: "vertical_pan", direction: "bottom_to_top" }`
- **THEN** it is accepted as a valid motion declaration using the given direction

#### Scenario: Zoom is accepted

- **WHEN** a scene declares `motion: { type: "zoom" }`
- **THEN** it is accepted as a valid motion declaration

#### Scenario: Static motion with a focal point is accepted

- **WHEN** a scene declares `motion: { type: "static", focalPoint: { x: 0.5, y: 0.3 } }`
- **THEN** it is accepted as a valid motion declaration

#### Scenario: Focal point is optional

- **WHEN** a scene declares a `motion` without a `focalPoint`
- **THEN** it is accepted, deferring to a centered crop

#### Scenario: Unrecognized motion type is rejected

- **WHEN** a scene declares a `motion.type` other than `horizontal_pan`, `vertical_pan`, `zoom`, or `static`
- **THEN** it is rejected as an unsupported motion type

#### Scenario: Direction mismatched with motion type is rejected

- **WHEN** a scene declares `motion: { type: "zoom", direction: "left_to_right" }` or otherwise pairs a `direction` with a motion type that doesn't use it
- **THEN** it is rejected as an invalid motion declaration

#### Scenario: Motion is usable without a frame decoration

- **WHEN** a scene declares `motion` and does not declare `frame`
- **THEN** it is accepted as a valid scene
