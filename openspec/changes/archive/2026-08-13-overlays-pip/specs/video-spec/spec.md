## ADDED Requirements

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
