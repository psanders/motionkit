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

The Video Specification SHALL support exactly two output formats in this phase: `16:9` and `9:16`.

#### Scenario: Supported format is accepted

- **WHEN** `format` is `16:9` or `9:16`
- **THEN** it is accepted

#### Scenario: Unsupported format is rejected

- **WHEN** `format` is any value other than `16:9` or `9:16`
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

### Requirement: Scene browser-frame decoration

A scene SHALL be able to declare an optional static `frame: "browser"` decoration that wraps its visual content in a browser-chrome frame.

#### Scenario: Browser frame is accepted

- **WHEN** a scene declares `frame: "browser"`
- **THEN** it is accepted as a valid frame declaration

#### Scenario: Unrecognized frame value is rejected

- **WHEN** a scene declares a `frame` value other than `"browser"`
- **THEN** it is rejected as an unsupported frame

### Requirement: Scene logo overlay

A scene SHALL be able to declare an optional `logo` overlay that shows the active brand's logo during that scene, using the brand's default placement unless a position override is given.

#### Scenario: Logo overlay is accepted with default placement

- **WHEN** a scene declares `logo: true`
- **THEN** it is accepted as a valid logo declaration using the active brand's default logo placement

#### Scenario: Logo overlay is accepted with a position override

- **WHEN** a scene declares `logo: { position: "top_left" }`
- **THEN** it is accepted as a valid logo declaration using the given position
