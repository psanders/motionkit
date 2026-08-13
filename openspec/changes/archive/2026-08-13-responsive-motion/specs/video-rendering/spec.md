## RENAMED Requirements

- FROM: `### Requirement: Browser-frame decoration renders using the active brand's tokens`
- TO: `### Requirement: Frame decoration renders using the active brand's tokens`

## MODIFIED Requirements

### Requirement: Frame decoration renders using the active brand's tokens

A scene declaring `frame: "browser"` or `frame: "phone"` SHALL render its visual content wrapped in the corresponding chrome frame, styled per the active brand's matching frame tokens (`browserFrameStyle` or `phoneFrameStyle`).

#### Scenario: Browser frame is visible

- **WHEN** a scene declares `frame: "browser"`
- **THEN** the rendered output shows that scene's visual content wrapped in a browser-chrome frame styled per the active brand

#### Scenario: Phone frame is visible

- **WHEN** a scene declares `frame: "phone"`
- **THEN** the rendered output shows that scene's visual content wrapped in a phone-chrome frame styled per the active brand

### Requirement: Format-aware composition dimensions

Each supported output format SHALL render at its own composition dimensions: `16:9` at 1920x1080, `9:16` at 1080x1920, `1:1` at 1080x1080.

#### Scenario: 16:9 specification renders at 1920x1080

- **WHEN** a specification's `format` is `16:9`
- **THEN** the rendered video's frame size is 1920x1080

#### Scenario: 9:16 specification renders at 1080x1920

- **WHEN** a specification's `format` is `9:16`
- **THEN** the rendered video's frame size is 1080x1920

#### Scenario: 1:1 specification renders at 1080x1080

- **WHEN** a specification's `format` is `1:1`
- **THEN** the rendered video's frame size is 1080x1080

## ADDED Requirements

### Requirement: Scene motion renders as a crop/pan/zoom rather than a static crop

A scene declaring `motion` SHALL render its source content scaled to cover the target composition, then panned or zoomed over the scene's duration per the declared motion type, rather than a fixed, unmoving crop.

#### Scenario: Horizontal pan reveals different parts of the source over time

- **WHEN** a scene declares `motion: { type: "horizontal_pan" }`
- **THEN** the rendered output's visible crop window moves horizontally across the source over the scene's duration, in the resolved direction

#### Scenario: Vertical pan reveals different parts of the source over time

- **WHEN** a scene declares `motion: { type: "vertical_pan" }`
- **THEN** the rendered output's visible crop window moves vertically across the source over the scene's duration, in the resolved direction

#### Scenario: Zoom increases scale over time

- **WHEN** a scene declares `motion: { type: "zoom" }`
- **THEN** the rendered output's scale increases over the scene's duration, centered on the focal point when one is given

#### Scenario: Static motion with a focal point biases the crop

- **WHEN** a scene declares `motion: { type: "static", focalPoint: { x: 0.2, y: 0.8 } }`
- **THEN** the rendered output's crop is centered on that focal point rather than the geometric center, without changing over time

#### Scenario: No motion declared keeps the existing centered crop

- **WHEN** a scene declares no `motion`
- **THEN** the rendered output uses a fixed, centered cover-crop, unchanged from prior behavior

#### Scenario: Motion renders correctly within a frame decoration

- **WHEN** a scene declares both `motion` and `frame`
- **THEN** the rendered output shows the motion applied to the content inside the frame decoration
