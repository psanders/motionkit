## MODIFIED Requirements

### Requirement: Referenced assets must exist

Validation SHALL check that every scene's `asset` path, and every overlay's `asset` path, resolves to a file that exists on disk.

#### Scenario: Missing asset is reported

- **WHEN** a scene references an asset path that does not exist on disk
- **THEN** validation returns a failure identifying the missing path and the scene that references it

#### Scenario: Missing asset suggests alternatives

- **WHEN** a referenced asset is missing and other files exist in the same directory
- **THEN** the failure includes those file names as suggestions

#### Scenario: Missing overlay asset is reported

- **WHEN** an overlay references an asset path that does not exist on disk
- **THEN** validation returns a failure identifying the missing path and the overlay that references it

## ADDED Requirements

### Requirement: Overlay sceneIndex must reference an existing scene

Validation SHALL check that every overlay's `sceneIndex` is a valid index into the specification's `scenes` array.

#### Scenario: Out-of-range sceneIndex is rejected

- **WHEN** an overlay declares a `sceneIndex` that is negative or beyond the last scene's index
- **THEN** validation returns a failure identifying the offending overlay and the invalid index

#### Scenario: In-range sceneIndex passes

- **WHEN** an overlay declares a `sceneIndex` that resolves to an existing scene
- **THEN** no `sceneIndex`-related violation is reported for that overlay

### Requirement: Overlay position must be valid when given

Validation SHALL check that a PIP overlay's `position`, when given, is one of the currently supported placements (`top_left`, `top_right`, `bottom_left`, `bottom_right`, `center`).

#### Scenario: Unsupported overlay position is rejected

- **WHEN** an overlay declares a `position` that is not one of the supported placements
- **THEN** validation returns a failure listing the supported placements
