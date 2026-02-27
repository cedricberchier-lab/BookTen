import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", false && "hidden", "text-sm")).toBe("px-2 text-sm");
  });
});
