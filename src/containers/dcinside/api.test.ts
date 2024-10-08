import { describe, expect, it } from "vitest";
import { DcInsideApi } from "./api";

describe("DCInside API", () => {
  const api = new DcInsideApi();

  it("should fetch gallery list", async () => {
    const list = await api.getGalleryList("bitcoins_new1", 1);
    expect(list).toBeInstanceOf(Array);
    expect(list.length).toBeGreaterThan(0);
  });
});
