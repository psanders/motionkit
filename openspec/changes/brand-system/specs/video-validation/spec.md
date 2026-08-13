## MODIFIED Requirements

### Requirement: Transition type must be supported

Validation SHALL check that every scene's declared transition type is one currently supported: `fade`, `slide-left`, `slide-right`, or `zoom`.

#### Scenario: Unsupported transition is rejected

- **WHEN** a scene declares a transition type other than `fade`, `slide-left`, `slide-right`, or `zoom`
- **THEN** validation returns a failure listing the supported transition types

## ADDED Requirements

### Requirement: Brand reference must resolve to a known brand

Validation SHALL check that a specification's `brand` id (explicit or defaulted to `"default"`) resolves to a registered brand.

#### Scenario: Unknown brand is reported

- **WHEN** a specification declares a brand id that has no matching registered brand
- **THEN** validation returns a failure identifying the unknown brand id

#### Scenario: Unknown brand suggests available brands

- **WHEN** a specification declares an unknown brand id
- **THEN** the failure includes the ids of registered brands as suggestions

### Requirement: Scene caption must be non-empty when declared

Validation SHALL check that a scene's `caption`, when declared, is a non-empty string.

#### Scenario: Empty caption is rejected

- **WHEN** a scene declares `caption: ""`
- **THEN** validation returns a failure identifying the offending scene

### Requirement: Scene frame must be a supported frame type

Validation SHALL check that a scene's `frame`, when declared, is one of the currently supported frame types (`browser`).

#### Scenario: Unsupported frame is rejected

- **WHEN** a scene declares a `frame` value other than `browser`
- **THEN** validation returns a failure listing the supported frame types

### Requirement: Scene logo position must be valid when given

Validation SHALL check that a scene's `logo` position override, when given, is one of the currently supported placements (`top_left`, `top_right`, `bottom_left`, `bottom_right`, `center`).

#### Scenario: Unsupported logo position is rejected

- **WHEN** a scene declares a `logo` position that is not one of the supported placements
- **THEN** validation returns a failure listing the supported placements
