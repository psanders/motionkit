## ADDED Requirements

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
