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

### Requirement: Transition renders visually

A scene declaring a transition SHALL render that transition's visual effect (`fade`, `slide-left`, `slide-right`, or `zoom`) rather than a hard cut, using the active brand's default transition duration when the scene doesn't specify one.

#### Scenario: Fade-declared scene shows a fade

- **WHEN** a scene declares `transition: { type: "fade" }`
- **THEN** the rendered output transitions into that scene with a fade rather than an instantaneous cut

#### Scenario: Slide-left-declared scene slides in

- **WHEN** a scene declares `transition: { type: "slide-left" }`
- **THEN** the rendered output transitions into that scene by sliding in from the right rather than an instantaneous cut

#### Scenario: Slide-right-declared scene slides in

- **WHEN** a scene declares `transition: { type: "slide-right" }`
- **THEN** the rendered output transitions into that scene by sliding in from the left rather than an instantaneous cut

#### Scenario: Zoom-declared scene shows a zoom

- **WHEN** a scene declares `transition: { type: "zoom" }`
- **THEN** the rendered output transitions into that scene with a zoom effect rather than an instantaneous cut

#### Scenario: Transition uses the brand's default duration when unspecified

- **WHEN** a scene declares a transition without an explicit duration
- **THEN** the rendered transition's duration matches the active brand's default transition duration

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

### Requirement: Captions render using the active brand's caption style

A scene's `caption`, when declared, SHALL render as a text overlay for that scene's screen time, styled per the active brand's caption tokens.

#### Scenario: Caption is visible during its scene

- **WHEN** a scene declares a `caption`
- **THEN** the rendered output shows that text overlay for the scene's screen time, styled per the active brand

### Requirement: Frame decoration renders using the active brand's tokens

A scene declaring `frame: "browser"` or `frame: "phone"` SHALL render its visual content wrapped in the corresponding chrome frame, styled per the active brand's matching frame tokens (`browserFrameStyle` or `phoneFrameStyle`).

#### Scenario: Browser frame is visible

- **WHEN** a scene declares `frame: "browser"`
- **THEN** the rendered output shows that scene's visual content wrapped in a browser-chrome frame styled per the active brand

#### Scenario: Phone frame is visible

- **WHEN** a scene declares `frame: "phone"`
- **THEN** the rendered output shows that scene's visual content wrapped in a phone-chrome frame styled per the active brand

### Requirement: Logo overlay renders using the active brand's logo

A scene declaring `logo` SHALL render the active brand's logo asset over that scene, at the brand's default placement unless a position override is given.

#### Scenario: Logo renders at the brand's default placement

- **WHEN** a scene declares `logo: true`
- **THEN** the rendered output shows the active brand's logo over that scene at the brand's default placement

#### Scenario: Logo renders at an overridden placement

- **WHEN** a scene declares `logo: { position: "top_left" }`
- **THEN** the rendered output shows the active brand's logo over that scene at the top-left placement

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

### Requirement: PIP overlay renders as a shape-clipped bubble on top of its scene

An overlay declaring `type: "pip"` SHALL render as a shape-clipped video bubble on top of its target scene's existing composed layers (visual, frame decoration, caption, logo), sized and positioned per the resolved brand's `pipStyle` tokens and the overlay's own `position`/`shape`/`size`.

#### Scenario: PIP bubble is visible during its scene

- **WHEN** an overlay declares `type: "pip"` with a `sceneIndex` pointing at a scene
- **THEN** the rendered output shows that overlay's video as a bubble during that scene's screen time, on top of the scene's other layers

#### Scenario: PIP renders at the brand's default placement when no position is given

- **WHEN** a PIP overlay declares no `position`
- **THEN** the rendered output places the bubble at the active brand's `pipStyle.defaultPosition`

#### Scenario: PIP renders at an overridden placement

- **WHEN** a PIP overlay declares `position: "top_left"`
- **THEN** the rendered output places the bubble at the top-left corner

#### Scenario: PIP renders in the declared shape

- **WHEN** a PIP overlay declares `shape: "rounded_square"`
- **THEN** the rendered output clips the bubble to a rounded square rather than the default circle

#### Scenario: PIP renders at the declared size

- **WHEN** a PIP overlay declares `size: "lg"`
- **THEN** the rendered output sizes the bubble per the active brand's `pipStyle.size.lg` value

#### Scenario: Multiple PIP overlays on the same scene all render

- **WHEN** two overlays declare the same `sceneIndex`
- **THEN** the rendered output shows both bubbles during that scene's screen time

### Requirement: PIP audio plays independently when set to "own"

A PIP overlay declaring `audio: "own"` SHALL have its own asset's audio play for its target scene's full duration, independent of whatever audio that scene's existing A-roll-continuity logic already produces.

#### Scenario: Own-audio PIP is audible during its scene

- **WHEN** a PIP overlay declares `audio: "own"`
- **THEN** the rendered output has that overlay's own audio track playing during its target scene's screen time

#### Scenario: Muted PIP contributes no audio

- **WHEN** a PIP overlay declares `audio: "muted"`
- **THEN** the rendered output's audio during that scene is unaffected by the overlay
