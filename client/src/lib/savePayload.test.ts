import { describe, expect, it } from "vitest";
import { HEAVY_ASSESSMENT_FIELDS, omitUnchanged } from "./savePayload";

const BIG = `data:application/pdf;base64,${"A".repeat(5000)}`;

describe("omitUnchanged", () => {
  it("drops a heavy field the server already has", () => {
    const out = omitUnchanged(
      { clinicalImpression: "edited", inbodyFileUrl: BIG },
      { inbodyFileUrl: BIG },
      HEAVY_ASSESSMENT_FIELDS,
    );
    expect(out).not.toHaveProperty("inbodyFileUrl");
    expect(out.clinicalImpression).toBe("edited");
  });

  it("keeps a heavy field that just changed — a fresh upload must persist", () => {
    const out = omitUnchanged(
      { inbodyFileUrl: BIG },
      { inbodyFileUrl: null },
      HEAVY_ASSESSMENT_FIELDS,
    );
    expect(out.inbodyFileUrl).toBe(BIG);
  });

  it("keeps a removal — clearing a file must reach the server", () => {
    const out = omitUnchanged(
      { vo2FileUrl: null },
      { vo2FileUrl: BIG },
      HEAVY_ASSESSMENT_FIELDS,
    );
    expect(out).toHaveProperty("vo2FileUrl");
    expect(out.vo2FileUrl).toBeNull();
  });

  it("handles the two heavy fields independently", () => {
    const out = omitUnchanged(
      { inbodyFileUrl: BIG, vo2FileUrl: "changed" },
      { inbodyFileUrl: BIG, vo2FileUrl: "original" },
      HEAVY_ASSESSMENT_FIELDS,
    );
    expect(out).not.toHaveProperty("inbodyFileUrl");
    expect(out.vo2FileUrl).toBe("changed");
  });

  it("sends everything when there is no baseline yet", () => {
    const data = { inbodyFileUrl: BIG, vo2FileUrl: BIG };
    expect(omitUnchanged(data, null, HEAVY_ASSESSMENT_FIELDS)).toEqual(data);
    expect(omitUnchanged(data, undefined, HEAVY_ASSESSMENT_FIELDS)).toEqual(data);
  });

  it("never touches keys outside the list", () => {
    const out = omitUnchanged(
      { clinicalImpression: "same", inbodyFileUrl: BIG },
      { clinicalImpression: "same", inbodyFileUrl: BIG },
      HEAVY_ASSESSMENT_FIELDS,
    );
    expect(out.clinicalImpression).toBe("same");
  });

  it("does not mutate its input", () => {
    const data = { inbodyFileUrl: BIG };
    omitUnchanged(data, { inbodyFileUrl: BIG }, HEAVY_ASSESSMENT_FIELDS);
    expect(data.inbodyFileUrl).toBe(BIG);
  });

  it("leaves a key absent from the payload absent", () => {
    const out = omitUnchanged({ clinicalImpression: "x" }, { inbodyFileUrl: BIG }, HEAVY_ASSESSMENT_FIELDS);
    expect(out).toEqual({ clinicalImpression: "x" });
  });
});
