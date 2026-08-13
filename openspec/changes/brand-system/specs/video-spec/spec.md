## RENAMED Requirements

- FROM: `### Requirement: Scene-level fade transition`
- TO: `### Requirement: Scene-level transition`

## MODIFIED Requirements

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

## ADDED Requirements

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
