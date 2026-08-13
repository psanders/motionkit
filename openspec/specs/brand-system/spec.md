# brand-system Specification

## Purpose

Defines Brand as a design-token document independent of any single Video Specification, and a registry that resolves a brand id to its parsed, validated document — so the same creative workflow and the same Video Specification structure can be visually tailored to different products by swapping which brand it references.

## Requirements

### Requirement: Brand document structure

A Brand SHALL be a document defining colors, a typography scale, a logo, a spacing scale, a border-radius scale, shadow presets, caption style, title style, lower-third style, browser-frame style, phone-frame style, CTA style, and a default transition duration.

#### Scenario: Well-formed brand document is accepted

- **WHEN** a brand document provides colors, typography, logo, spacing, border-radius, shadows, caption/title/lower-third/browser-frame/phone-frame/CTA styles, and a default transition duration
- **THEN** it is recognized as a valid Brand document

#### Scenario: Missing required token category is rejected

- **WHEN** a brand document omits one of its required token categories
- **THEN** it is rejected as malformed

### Requirement: Brands live one per file, referenced by id

Each Brand SHALL live in its own file, addressed by a brand id distinct from the file's contents, so a Video Specification can reference a brand without embedding its definition.

#### Scenario: Brand file is independently loadable

- **WHEN** a brand id is resolved
- **THEN** its document is loaded from that brand's own file, independent of any Video Specification

### Requirement: A built-in default brand ships with MotionKit

MotionKit SHALL ship with one built-in brand, id `"default"`, usable without any additional brand configuration.

#### Scenario: Default brand resolves out of the box

- **WHEN** the brand id `"default"` is resolved without any additional setup
- **THEN** a valid Brand document is returned

### Requirement: Brand registry resolves an id to a validated document

The brand registry SHALL resolve a brand id to its parsed and validated Brand document, or report that the id is unknown.

#### Scenario: Known brand id resolves successfully

- **WHEN** a registered brand id is resolved
- **THEN** the registry returns that brand's parsed, validated document

#### Scenario: Unknown brand id is reported

- **WHEN** an unregistered brand id is resolved
- **THEN** the registry reports that the id is unknown, rather than throwing an unhandled error
