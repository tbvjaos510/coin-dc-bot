import { describe, expect, it } from "vitest";
import { CoinPanAPI } from "./api";

describe("CoinPan API", () => {
  const api = new CoinPanAPI();

  it("should fetch posts", async () => {
    const posts = await api.getFreeBoardList(1);

    expect(posts).toBeInstanceOf(Array);
    expect(posts.length).toBeGreaterThan(0);
  });

  it("should fetch popular posts", async () => {
    const posts = await api.getFreeBoardPopularList();

    expect(posts).toBeInstanceOf(Array);
    expect(posts.length).toBe(30)
  });
});
