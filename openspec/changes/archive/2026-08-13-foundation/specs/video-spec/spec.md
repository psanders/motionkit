## Purpose

Defines the structured, versioned Video Specification document that represents a video as data rather than code — the contract between the creative/AI layer and the MotionKit rendering engine.

## ADDED Requirements

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

### Requirement: Scene-level fade transition

A scene (other than the first) SHALL be able to declare a `fade` transition used when entering that scene.

#### Scenario: Fade transition is accepted

- **WHEN** a non-first scene declares `transition: { type: "fade" }`
- **THEN** it is accepted as a valid transition declaration

#### Scenario: Unrecognized transition type is rejected

- **WHEN** a scene declares a `transition.type` other than `fade`
- **THEN** it is rejected as an unsupported transition

### Requirement: Supported output formats

The Video Specification SHALL support exactly two output formats in this phase: `16:9` and `9:16`.

#### Scenario: Supported format is accepted

- **WHEN** `format` is `16:9` or `9:16`
- **THEN** it is accepted

#### Scenario: Unsupported format is rejected

- **WHEN** `format` is any value other than `16:9` or `9:16`
- **THEN** it is rejected as unsupported
