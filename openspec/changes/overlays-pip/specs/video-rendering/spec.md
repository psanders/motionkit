## ADDED Requirements

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
