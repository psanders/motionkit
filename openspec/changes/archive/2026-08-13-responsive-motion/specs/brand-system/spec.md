## MODIFIED Requirements

### Requirement: Brand document structure

A Brand SHALL be a document defining colors, a typography scale, a logo, a spacing scale, a border-radius scale, shadow presets, caption style, title style, lower-third style, browser-frame style, phone-frame style, CTA style, and a default transition duration.

#### Scenario: Well-formed brand document is accepted

- **WHEN** a brand document provides colors, typography, logo, spacing, border-radius, shadows, caption/title/lower-third/browser-frame/phone-frame/CTA styles, and a default transition duration
- **THEN** it is recognized as a valid Brand document

#### Scenario: Missing required token category is rejected

- **WHEN** a brand document omits one of its required token categories
- **THEN** it is rejected as malformed
