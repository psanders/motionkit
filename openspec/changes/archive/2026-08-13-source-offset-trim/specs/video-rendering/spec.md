## ADDED Requirements

### Requirement: Scene and overlay visuals honor a declared source offset

A scene's or PIP overlay's visual content, when it declares `sourceStartSeconds` and/or `sourceEndSeconds`, SHALL play from that offset within its source `asset` file rather than from the start of the file, for the scene's or overlay's declared `duration`.

#### Scenario: Visual starts at the declared source offset

- **WHEN** a scene declares `sourceStartSeconds: 12.5`
- **THEN** the rendered output's visual for that scene begins at the frame corresponding to 12.5 seconds into the source `asset` file

#### Scenario: No source offset keeps existing playback-from-start behavior

- **WHEN** a scene or overlay declares no `sourceStartSeconds`
- **THEN** the rendered output's visual for it begins at the start of the source `asset` file, unchanged from prior behavior

#### Scenario: PIP overlay visual honors its own source offset

- **WHEN** a PIP overlay declares `sourceStartSeconds: 5`
- **THEN** the rendered output's bubble for that overlay begins at the frame corresponding to 5 seconds into the overlay's source `asset` file

### Requirement: Audio honors the same source offset as its visual counterpart

Audio derived from a trimmed asset — whether an A-roll's own audio, that audio continuing under a chained B-roll, or a PIP overlay's own audio — SHALL begin at the same source offset as that asset's visual, so image and sound stay in sync.

#### Scenario: A-roll audio starts at the same offset as its visual

- **WHEN** an A-roll scene declares `sourceStartSeconds: 12.5`
- **THEN** the rendered output's audio for that scene's span begins at the same 12.5-second offset into the source `asset` file as its visual

#### Scenario: Chained continuation audio still starts at the span's original offset

- **WHEN** a trimmed A-roll's audio continues under one or more following B-roll scenes
- **THEN** the rendered output's audio for the whole continued span still begins at the A-roll's declared source offset, unaffected by the B-roll scenes it plays under

#### Scenario: PIP own-audio starts at the same offset as its visual

- **WHEN** a PIP overlay with `audio: "own"` declares `sourceStartSeconds: 5`
- **THEN** the rendered output's audio for that overlay begins at the same 5-second offset into the overlay's source `asset` file as its visual

### Requirement: Rendering refuses a source range that doesn't fit the asset

Rendering SHALL refuse to run, and SHALL report a structured failure, when a scene's or PIP overlay's declared source range does not fit within the referenced asset's real duration.

#### Scenario: Out-of-bounds source range stops the render

- **WHEN** a scene's or overlay's `sourceStartSeconds`/`sourceEndSeconds` does not fit the asset's real, measured duration
- **THEN** no video file is produced and a structured failure identifies the offending scene or overlay, instead of producing frozen or dropped-audio output
