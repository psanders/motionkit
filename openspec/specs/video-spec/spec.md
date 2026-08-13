# video-spec Specification

## Purpose

Defines the structured, versioned Video Specification document that represents a video as data rather than code — the contract between the creative/AI layer and the MotionKit rendering engine.

## Requirements

### Requirement: Video Specification document structure

A Video Specification SHALL be a document with a `version`, an output `format`, an `fps`, and an ordered, non-empty list of `scenes`.

#### Scenario: Well-formed document is accepted

- **WHEN** a document provides `version`, `format`, `fps`, and at least one scene
- **THEN** it is recognized as a valid Video Specification shape

#### Scenario: Missing required field is rejected

- **WHEN** a document omits `format`, `fps`, or `scenes`
- **THEN** it is rejected as malformed

### Requirement: A-roll and B-roll scene types

The Video Specification SHALL support two scene types, `a_roll` and `b_roll`, each referencing a source asset and a duration in seconds.

#### Scenario: A-roll scene is accepted

- **WHEN** a scene has `type: "a_roll"`, an `asset` path, and a positive `duration`
- **THEN** it is accepted as a valid scene

#### Scenario: B-roll scene is accepted

- **WHEN** a scene has `type: "b_roll"`, an `asset` path, and a positive `duration`
- **THEN** it is accepted as a valid scene

#### Scenario: Unknown scene type is rejected

- **WHEN** a scene's `type` is neither `a_roll` nor `b_roll`
- **THEN** it is rejected as malformed

### Requirement: A-roll audio continues under B-roll visuals

A B-roll scene SHALL be able to express that the preceding A-roll's audio continues to play under its visuals, independent of the B-roll asset's own audio.

#### Scenario: B-roll defaults to continuing A-roll audio

- **WHEN** a B-roll scene does not specify an `audio` field
- **THEN** the Video Specification treats it as continuing the audio of the nearest preceding A-roll scene

#### Scenario: B-roll can be explicitly muted

- **WHEN** a B-roll scene sets `audio: "muted"`
- **THEN** the Video Specification records that no audio plays during that scene's screen time

### Requirement: Scene-level transition

A scene (other than the first) SHALL be able to declare a transition used when entering that scene, selecting one of the supported transition types, with an optional explicit duration.

#### Scenario: Fade transition is accepted

- **WHEN** a non-first scene declares `transition: { type: "fade" }`
- **THEN** it is accepted as a valid transition declaration

#### Scenario: Slide-left transition is accepted

- **WHEN** a non-first scene declares `transition: { type: "slide-left" }`
- **THEN** it is accepted as a valid transition declaration

#### Scenario: Slide-right transition is accepted

- **WHEN** a non-first scene declares `transition: { type: "slide-right" }`
- **THEN** it is accepted as a valid transition declaration

#### Scenario: Zoom transition is accepted

- **WHEN** a non-first scene declares `transition: { type: "zoom" }`
- **THEN** it is accepted as a valid transition declaration

#### Scenario: Unrecognized transition type is rejected

- **WHEN** a scene declares a `transition.type` other than `fade`, `slide-left`, `slide-right`, or `zoom`
- **THEN** it is rejected as an unsupported transition

#### Scenario: Transition duration is optional

- **WHEN** a scene declares a transition without an explicit duration
- **THEN** it is accepted, deferring the actual duration to the active brand's default at render time

### Requirement: Supported output formats

The Video Specification SHALL support three output formats: `16:9`, `9:16`, and `1:1`.

#### Scenario: Supported format is accepted

- **WHEN** `format` is `16:9`, `9:16`, or `1:1`
- **THEN** it is accepted

#### Scenario: Unsupported format is rejected

- **WHEN** `format` is any value other than `16:9`, `9:16`, or `1:1`
- **THEN** it is rejected as unsupported

### Requirement: Video Specification references a brand

A Video Specification SHALL be able to declare an optional top-level `brand` id; when omitted, it SHALL default to `"default"`.

#### Scenario: Explicit brand id is accepted

- **WHEN** a document declares `brand: "acme"`
- **THEN** it is accepted as a valid brand reference

#### Scenario: Omitted brand defaults to "default"

- **WHEN** a document does not declare `brand`
- **THEN** it is treated as referencing the `"default"` brand

### Requirement: Scene caption overlay

A scene SHALL be able to declare an optional `caption` (text) that renders as a styled overlay for that scene's duration.

#### Scenario: Caption text is accepted

- **WHEN** a scene declares `caption: "Some text"`
- **THEN** it is accepted as a valid caption declaration

#### Scenario: Caption is optional

- **WHEN** a scene does not declare `caption`
- **THEN** no caption overlay is expected for that scene

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

### Requirement: Scene logo overlay

A scene SHALL be able to declare an optional `logo` overlay that shows the active brand's logo during that scene, using the brand's default placement unless a position override is given.

#### Scenario: Logo overlay is accepted with default placement

- **WHEN** a scene declares `logo: true`
- **THEN** it is accepted as a valid logo declaration using the active brand's default logo placement

#### Scenario: Logo overlay is accepted with a position override

- **WHEN** a scene declares `logo: { position: "top_left" }`
- **THEN** it is accepted as a valid logo declaration using the given position

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

### Requirement: Video Specification overlays

A Video Specification SHALL be able to declare an optional top-level `overlays` array, sibling to `scenes`, each entry anchored to a specific scene by index rather than an absolute time range.

#### Scenario: Overlays array is accepted

- **WHEN** a document declares a non-empty `overlays` array
- **THEN** it is accepted as valid, independent of the `scenes` array's own content

#### Scenario: Overlays are optional

- **WHEN** a document declares no `overlays`
- **THEN** it is accepted as a valid Video Specification

### Requirement: PIP overlay type

An overlay entry SHALL be able to declare `type: "pip"` — a video bubble anchored to one scene via `sceneIndex`, referencing an `asset`, with optional `position`, `shape`, and `size`, and a required `audio` mode.

#### Scenario: A well-formed PIP overlay is accepted

- **WHEN** an overlay declares `type: "pip"`, a `sceneIndex`, an `asset` path, and `audio: "own"` or `audio: "muted"`
- **THEN** it is accepted as a valid overlay

#### Scenario: PIP audio mode is required

- **WHEN** a PIP overlay omits `audio`
- **THEN** it is rejected as malformed

#### Scenario: PIP position defaults when omitted

- **WHEN** a PIP overlay declares no `position`
- **THEN** it is accepted, deferring to the active brand's default PIP placement at render time

#### Scenario: PIP position can be overridden

- **WHEN** a PIP overlay declares `position: "top_left"`
- **THEN** it is accepted as a valid overlay using the given position

#### Scenario: PIP shape defaults to circle

- **WHEN** a PIP overlay declares no `shape`
- **THEN** it is accepted, defaulting to `"circle"`

#### Scenario: PIP shape can be set to rounded_square

- **WHEN** a PIP overlay declares `shape: "rounded_square"`
- **THEN** it is accepted as a valid overlay using that shape

#### Scenario: PIP size defaults to md

- **WHEN** a PIP overlay declares no `size`
- **THEN** it is accepted, defaulting to `"md"`

#### Scenario: PIP size can be overridden

- **WHEN** a PIP overlay declares `size: "lg"` or `size: "sm"`
- **THEN** it is accepted as a valid overlay using that size

#### Scenario: Multiple PIP overlays may target the same scene

- **WHEN** two or more overlays declare the same `sceneIndex`
- **THEN** all are accepted as valid overlays

### Requirement: Scene source offset and trim range

A scene (`a_roll` or `b_roll`) SHALL be able to declare optional `sourceStartSeconds` and `sourceEndSeconds` fields, each a non-negative number, specifying an offset range within the scene's `asset` file to play from instead of always starting at 0. `duration` remains the sole driver of how long the scene occupies the rendered timeline; the source offset fields only shift where in the source file playback begins (and optionally bound where it may end).

#### Scenario: Source start offset is accepted

- **WHEN** a scene declares `sourceStartSeconds: 12.5`
- **THEN** it is accepted as a valid scene, playing from 12.5 seconds into its `asset` file

#### Scenario: Source start and end offsets are accepted together

- **WHEN** a scene declares `sourceStartSeconds: 12.5` and `sourceEndSeconds: 20`
- **THEN** it is accepted as a valid scene

#### Scenario: Source offset fields are optional

- **WHEN** a scene declares neither `sourceStartSeconds` nor `sourceEndSeconds`
- **THEN** it is accepted, playing from the start of its `asset` file exactly as before this capability existed

#### Scenario: Negative source offset is rejected

- **WHEN** a scene declares `sourceStartSeconds` or `sourceEndSeconds` as a negative number
- **THEN** it is rejected as malformed

#### Scenario: Source end offset not after source start offset is rejected

- **WHEN** a scene declares both `sourceStartSeconds` and `sourceEndSeconds`, and `sourceEndSeconds` is not greater than `sourceStartSeconds`
- **THEN** it is rejected as an invalid source range

### Requirement: PIP overlay source offset and trim range

A `pip` overlay SHALL be able to declare the same optional `sourceStartSeconds` and `sourceEndSeconds` fields as a scene, with identical semantics, applied to the overlay's own `asset` file.

#### Scenario: Overlay source start offset is accepted

- **WHEN** a PIP overlay declares `sourceStartSeconds: 5`
- **THEN** it is accepted as a valid overlay, playing from 5 seconds into its `asset` file

#### Scenario: Overlay source offset fields are optional

- **WHEN** a PIP overlay declares neither `sourceStartSeconds` nor `sourceEndSeconds`
- **THEN** it is accepted, playing from the start of its `asset` file exactly as before this capability existed

#### Scenario: Overlay source end offset not after source start offset is rejected

- **WHEN** a PIP overlay declares both `sourceStartSeconds` and `sourceEndSeconds`, and `sourceEndSeconds` is not greater than `sourceStartSeconds`
- **THEN** it is rejected as an invalid source range
