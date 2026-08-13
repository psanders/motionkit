## ADDED Requirements

### Requirement: Source trim range must be internally consistent

Validation SHALL check that, when a scene or PIP overlay declares both `sourceStartSeconds` and `sourceEndSeconds`, `sourceEndSeconds` is strictly greater than `sourceStartSeconds`.

#### Scenario: Source end not after source start is rejected

- **WHEN** a scene or PIP overlay declares `sourceEndSeconds` that is less than or equal to its `sourceStartSeconds`
- **THEN** validation returns a failure identifying the offending scene or overlay and the invalid range

#### Scenario: Only a start offset passes this check

- **WHEN** a scene or PIP overlay declares `sourceStartSeconds` without `sourceEndSeconds`
- **THEN** no source-range-consistency violation is reported for it

### Requirement: Source trim range must fit the asset's real duration

When rendering a specification whose scene or PIP overlay declares a `sourceStartSeconds` or `sourceEndSeconds`, the requested source range SHALL be checked against the referenced asset's real (measured) duration; a range that starts beyond the asset's end, or that is too short to cover the scene's or overlay's `duration`, SHALL be reported as a structured failure rather than allowed to render. This check requires probing the actual asset file, so — unlike the specification-only checks above — it runs when rendering, not during the specification-only `validate()` pass.

#### Scenario: Source start beyond the asset's real duration is rejected

- **WHEN** a scene's or overlay's `sourceStartSeconds` is at or beyond its asset's real duration
- **THEN** rendering is refused and a structured failure identifies the offending scene or overlay

#### Scenario: Source range too short for the declared duration is rejected

- **WHEN** the span between `sourceStartSeconds` (or 0, if omitted) and `sourceEndSeconds` (or the asset's real end, if omitted) is shorter than the scene's or overlay's `duration`
- **THEN** rendering is refused and a structured failure identifies the offending scene or overlay

#### Scenario: Source range that fits the asset passes

- **WHEN** a scene's or overlay's source range starts within the asset and covers at least its `duration` before the asset ends
- **THEN** no source-range-duration violation is reported for it
