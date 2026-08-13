## RENAMED Requirements

- FROM: `### Requirement: Fade transition renders visually`
- TO: `### Requirement: Transition renders visually`

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Captions render using the active brand's caption style

A scene's `caption`, when declared, SHALL render as a text overlay for that scene's screen time, styled per the active brand's caption tokens.

#### Scenario: Caption is visible during its scene

- **WHEN** a scene declares a `caption`
- **THEN** the rendered output shows that text overlay for the scene's screen time, styled per the active brand

### Requirement: Browser-frame decoration renders using the active brand's tokens

A scene declaring `frame: "browser"` SHALL render its visual content wrapped in a browser-chrome frame styled per the active brand's browser-frame tokens.

#### Scenario: Browser frame is visible

- **WHEN** a scene declares `frame: "browser"`
- **THEN** the rendered output shows that scene's visual content wrapped in a browser-chrome frame styled per the active brand

### Requirement: Logo overlay renders using the active brand's logo

A scene declaring `logo` SHALL render the active brand's logo asset over that scene, at the brand's default placement unless a position override is given.

#### Scenario: Logo renders at the brand's default placement

- **WHEN** a scene declares `logo: true`
- **THEN** the rendered output shows the active brand's logo over that scene at the brand's default placement

#### Scenario: Logo renders at an overridden placement

- **WHEN** a scene declares `logo: { position: "top_left" }`
- **THEN** the rendered output shows the active brand's logo over that scene at the top-left placement
