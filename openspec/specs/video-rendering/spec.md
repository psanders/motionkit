# video-rendering Specification

## Purpose

Renders a validated Video Specification into a deterministic video file using Remotion as the underlying engine, with composition dimensions chosen per output format rather than one layout scaled into another.

## Requirements

### Requirement: Rendering produces a video file

Rendering a valid Video Specification SHALL produce a single MP4 file at a specified (or default) output path.

#### Scenario: Valid specification renders successfully

- **WHEN** a valid Video Specification and an output path are provided to the renderer
- **THEN** an MP4 file is written to that path

### Requirement: Rendered duration matches the specification

The total duration of the rendered video SHALL equal the sum of its scenes' declared durations.

#### Scenario: Total duration matches scene durations

- **WHEN** a specification has scenes with durations 7s, 9s, and 8s
- **THEN** the rendered video is 24 seconds long

### Requirement: Scenes render in timeline order

Scenes SHALL appear in the rendered video in the same order as declared in the specification.

#### Scenario: Scene order is preserved

- **WHEN** a specification declares an A-roll scene, then a B-roll scene, then an A-roll scene
- **THEN** the rendered video shows those visuals in that same order

### Requirement: A-roll audio continuity is honored during rendering

When a B-roll scene continues the preceding A-roll's audio, that audio SHALL be audible during the B-roll scene's screen time in the rendered output; when muted, no audio from either source SHALL play during that scene.

#### Scenario: Continued audio is audible under B-roll visuals

- **WHEN** a B-roll scene defaults to continuing the preceding A-roll's audio
- **THEN** the rendered output has that A-roll's audio track playing during the B-roll scene's screen time

#### Scenario: Muted B-roll has no audio

- **WHEN** a B-roll scene sets `audio: "muted"`
- **THEN** the rendered output has no audio during that scene's screen time

### Requirement: Fade transition renders visually

A scene declaring a `fade` transition SHALL be preceded by a visual fade in the rendered output rather than a hard cut.

#### Scenario: Fade-declared scene shows a fade

- **WHEN** a scene declares `transition: { type: "fade" }`
- **THEN** the rendered output transitions into that scene with a fade rather than an instantaneous cut

### Requirement: Format-aware composition dimensions

Each supported output format SHALL render at its own composition dimensions: `16:9` at 1920x1080, `9:16` at 1080x1920.

#### Scenario: 16:9 specification renders at 1920x1080

- **WHEN** a specification's `format` is `16:9`
- **THEN** the rendered video's frame size is 1920x1080

#### Scenario: 9:16 specification renders at 1080x1920

- **WHEN** a specification's `format` is `9:16`
- **THEN** the rendered video's frame size is 1080x1920

### Requirement: Rendering is deterministic

Rendering the same valid specification against unchanged asset files SHALL produce equivalent output every time, with no dependence on wall-clock time, randomness, or non-deterministic ordering.

#### Scenario: Repeated render of an unchanged specification matches

- **WHEN** the same valid specification is rendered twice against the same, unchanged asset files
- **THEN** the two rendered outputs are frame-for-frame equivalent

### Requirement: Rendering refuses an invalid specification

Rendering SHALL NOT run against a specification that fails validation; it SHALL surface the same structured validation errors instead of producing a partial or corrupt video file.

#### Scenario: Invalid specification is rejected before rendering

- **WHEN** rendering is requested for a specification that fails validation
- **THEN** no video file is produced and the structured validation errors are returned instead
