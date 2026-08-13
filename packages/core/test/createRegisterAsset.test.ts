/**
 * Copyright (C) 2026 by Pedro Sanders. MIT.
 *
 * Reference unit test for THE validated-function pattern. Because the
 * function takes its dependencies by injection, the test simply passes a
 * sinon-stubbed store — no real database, no module mocking.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createRegisterAsset, type AssetStore } from "../src/assets/createRegisterAsset.js";
import { ValidationError } from "../src/errors/ValidationError.js";

describe("createRegisterAsset", () => {
  const validInput = {
    name: "hero-broll",
    type: "video" as const,
    path: "/assets/hero-broll.mp4",
    tags: ["intro"]
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should register an asset", async () => {
      // Arrange
      const store: AssetStore = { save: sinon.stub().resolves(validInput) };

      // Act
      const registerAsset = createRegisterAsset({ store });
      const result = await registerAsset(validInput);

      // Assert
      expect(result).to.deep.equal(validInput);
      expect((store.save as sinon.SinonStub).calledOnce).to.equal(true);
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError when type is not a known asset type", async () => {
      // Arrange
      const store: AssetStore = { save: sinon.stub() };
      const registerAsset = createRegisterAsset({ store });

      // Act + Assert
      try {
        await registerAsset({ ...validInput, type: "gif" });
        expect.fail("expected ValidationError");
      } catch (err) {
        expect(err).to.be.instanceOf(ValidationError);
        expect((store.save as sinon.SinonStub).called).to.equal(false);
      }
    });
  });
});
