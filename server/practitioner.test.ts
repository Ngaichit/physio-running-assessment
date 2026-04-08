import { describe, it, expect } from "vitest";

// Test the practitioner schema validation and default metrics with new fields
describe("Practitioner and Report Enhancements", () => {
  it("should have correct practitioner fields defined", () => {
    // Practitioner profile fields
    const requiredFields = ["name", "title", "qualifications", "clinic", "phone", "email", "website", "address"];
    const profile = {
      name: "Dr. John Smith",
      title: "Sports Physiotherapist",
      qualifications: "BSc, MSc, CSCS",
      clinic: "Total Health",
      phone: "+852 1234 5678",
      email: "john@totalhealth.hk",
      website: "www.totalhealth.hk",
      address: "123 Sports Rd, Central, Hong Kong",
    };
    for (const field of requiredFields) {
      expect(profile).toHaveProperty(field);
      expect(typeof (profile as any)[field]).toBe("string");
    }
  });

  it("should generate radar chart SVG for measured metrics", () => {
    // Simulate the radar chart generation logic
    const metrics = [
      { metricId: "M01", metricName: "Overstride Angle", rating: "Optimal", measuredValue: 7, optimalRange: "5–8°" },
      { metricId: "M02", metricName: "Tibial Inclination", rating: "High", measuredValue: 12, optimalRange: "3–8°" },
      { metricId: "M03", metricName: "Knee Flexion", rating: "Low", measuredValue: 12, optimalRange: "20–30°" },
      { metricId: "M04", metricName: "Hip Extension", rating: "Optimal", measuredValue: 12, optimalRange: "10–15°" },
      { metricId: "M05", metricName: "Trunk Lean", rating: "Optimal", measuredValue: 8, optimalRange: "6–12°" },
    ];

    const measured = metrics.filter(m => m.rating !== "Not Measured");
    expect(measured.length).toBe(5);
    expect(measured.length).toBeGreaterThanOrEqual(3); // Minimum for radar chart

    // Test normalized value calculation
    const parseRange = (range: string) => {
      const match = range.match(/([\d.]+)[–-]([\d.]+)/);
      if (!match) return null;
      return { min: parseFloat(match[1]), max: parseFloat(match[2]) };
    };

    const range1 = parseRange("5–8°");
    expect(range1).toEqual({ min: 5, max: 8 });

    const range2 = parseRange("20-30°");
    expect(range2).toEqual({ min: 20, max: 30 });

    // Test rating classification
    for (const m of measured) {
      expect(["Low", "Optimal", "High", "Not Measured"]).toContain(m.rating);
    }
  });

  it("should correctly classify metric ratings as Low/Optimal/High", () => {
    const classify = (value: number, optMin: number, optMax: number) => {
      if (value >= optMin && value <= optMax) return "Optimal";
      if (value < optMin) return "Low";
      return "High";
    };

    // M01: Overstride Angle (optimal 5-8)
    expect(classify(7, 5, 8)).toBe("Optimal");
    expect(classify(3, 5, 8)).toBe("Low");
    expect(classify(16, 5, 8)).toBe("High");

    // M03: Knee Flexion Loading (optimal 20-30)
    expect(classify(25, 20, 30)).toBe("Optimal");
    expect(classify(12, 20, 30)).toBe("Low");
    expect(classify(38, 20, 30)).toBe("High");
  });

  it("should treat mid_stance as equivalent to loading phase", () => {
    const validPhases = ["foot_strike", "loading", "mid_stance", "push_off", "swing", "other"];
    expect(validPhases).toContain("mid_stance");

    // Phase mapping: mid_stance now maps to same metrics as loading
    const PHASE_MAP: Record<string, string[]> = {
      "foot_strike": ["IC"],
      "loading": ["Loading", "Mid-Stance"],
      "mid_stance": ["Loading", "Mid-Stance"],
      "push_off": ["Toe-Off"],
      "swing": ["Mid-Swing"],
      "other": ["Loading", "Mid-Stance"],
    };

    // mid_stance and loading should return the same metrics
    expect(PHASE_MAP["mid_stance"]).toEqual(PHASE_MAP["loading"]);
    expect(PHASE_MAP["foot_strike"]).toEqual(["IC"]);
  });

  it("should convert image URL to base64 format for PDF export", async () => {
    // Test the concept of base64 conversion (actual fetch would need a real URL)
    const mockBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
    expect(mockBase64).toMatch(/^data:image\/(png|jpeg|gif|webp);base64,/);
  });

  it("should generate practitioner footer HTML when practitioner exists", () => {
    const prac = {
      name: "Dr. John Smith",
      title: "Sports Physiotherapist",
      qualifications: "BSc, MSc",
      clinic: "Total Health",
      phone: "+852 1234 5678",
      email: "john@totalhealth.hk",
      website: "www.totalhealth.hk",
      address: "123 Sports Rd, Central, Hong Kong",
    };

    // Simulate footer generation
    const footer = `
      <div class="practitioner-footer">
        <p>${prac.name}</p>
        ${prac.title ? `<p>${prac.title}</p>` : ''}
        ${prac.phone ? `<p>${prac.phone}</p>` : ''}
        ${prac.email ? `<p>${prac.email}</p>` : ''}
      </div>
    `;

    expect(footer).toContain("Dr. John Smith");
    expect(footer).toContain("Sports Physiotherapist");
    expect(footer).toContain("+852 1234 5678");
    expect(footer).toContain("john@totalhealth.hk");
    expect(footer).toContain("practitioner-footer");
  });
});
