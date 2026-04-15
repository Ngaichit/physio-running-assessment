import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import { nanoid } from "nanoid";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  patient: router({
    list: protectedProcedure.query(({ ctx }) => db.getPatients(ctx.user.id)),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(({ ctx, input }) => db.getPatient(input.id, ctx.user.id)),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      dateOfBirth: z.string().optional(),
      gender: z.string().optional(),
      height: z.number().optional(),
      weight: z.number().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      notes: z.string().optional(),
    })).mutation(({ ctx, input }) => db.createPatient({ ...input, userId: ctx.user.id })),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      dateOfBirth: z.string().optional(),
      gender: z.string().optional(),
      height: z.number().optional(),
      weight: z.number().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      notes: z.string().optional(),
    })).mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return db.updatePatient(id, ctx.user.id, data);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ ctx, input }) => db.deletePatient(input.id, ctx.user.id)),
  }),

  assessment: router({
    list: protectedProcedure.input(z.object({ patientId: z.number() })).query(({ ctx, input }) => db.getAssessments(input.patientId, ctx.user.id)),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(({ ctx, input }) => db.getAssessment(input.id, ctx.user.id)),
    create: protectedProcedure.input(z.object({
      patientId: z.number(),
      assessmentDate: z.string(),
    })).mutation(({ ctx, input }) => db.createAssessment({ ...input, userId: ctx.user.id })),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      assessmentDate: z.string().optional(),
      status: z.enum(["draft", "in_progress", "completed"]).optional(),
      trainingFrequency: z.string().optional().nullable(),
      weeklyMileage: z.string().optional().nullable(),
      runningGoals: z.string().optional().nullable(),
      runningExperience: z.string().optional().nullable(),
      currentPace: z.string().optional().nullable(),
      preferredTerrain: z.string().optional().nullable(),
      shoeType: z.string().optional().nullable(),
      injuries: z.any().optional().nullable(),
      concerns: z.string().optional().nullable(),
      backgroundNotes: z.string().optional().nullable(),
      inbodyFileUrl: z.string().optional().nullable(),
      inbodyFileName: z.string().optional().nullable(),
      inbodyNotes: z.string().optional().nullable(),
      vo2FileUrl: z.string().optional().nullable(),
      vo2FileName: z.string().optional().nullable(),
      vo2Notes: z.string().optional().nullable(),
      clinicalImpression: z.string().optional().nullable(),
      thingsToImprove: z.string().optional().nullable(),
      managementPlan: z.string().optional().nullable(),
      runningCues: z.string().optional().nullable(),
      mobilityExercises: z.string().optional().nullable(),
      strengthExercises: z.string().optional().nullable(),
      runningProgramming: z.string().optional().nullable(),
      cadence: z.number().optional().nullable(),
      overstrideCategory: z.string().optional().nullable(),
      pushOffCategory: z.string().optional().nullable(),
      assessmentSpeed: z.string().optional().nullable(),
      assessmentIncline: z.string().optional().nullable(),
      assessmentFootwear: z.string().optional().nullable(),
      assessmentRecording: z.string().optional().nullable(),
      followUpMonths: z.number().optional().nullable(),
      aiGeneratedReport: z.string().optional().nullable(),
      reportJson: z.any().optional().nullable(),
      practitionerId: z.number().optional().nullable(),
    })).mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return db.updateAssessment(id, ctx.user.id, data);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ ctx, input }) => db.deleteAssessment(input.id, ctx.user.id)),
  }),

  screenshot: router({
    list: protectedProcedure.input(z.object({ assessmentId: z.number() })).query(({ input }) => db.getScreenshots(input.assessmentId)),
    create: protectedProcedure.input(z.object({
      assessmentId: z.number(),
      viewType: z.enum(["side_left", "side_right", "back"]),
      gaitPhase: z.enum(["foot_strike", "loading", "mid_stance", "push_off", "swing", "other"]),
      imageUrl: z.string(),
      thumbnailUrl: z.string().optional(),
      timestamp: z.number().optional(),
      description: z.string().optional(),
      legSide: z.string().optional(),
      sortOrder: z.number().optional(),
    })).mutation(({ input }) => db.createScreenshot(input)),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      description: z.string().optional(),
      gaitPhase: z.enum(["foot_strike", "loading", "push_off", "swing", "other"]).optional(),
      legSide: z.string().optional().nullable(),
      sortOrder: z.number().optional(),
    })).mutation(({ input }) => {
      const { id, ...data } = input;
      return db.updateScreenshot(id, data);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteScreenshot(input.id)),
  }),

  annotation: router({
    list: protectedProcedure.input(z.object({ screenshotId: z.number() })).query(({ input }) => db.getAnnotations(input.screenshotId)),
    create: protectedProcedure.input(z.object({
      screenshotId: z.number(),
      annotationType: z.enum(["line", "angle", "circle", "text"]),
      data: z.any(),
      color: z.string().optional(),
      label: z.string().optional(),
      metricName: z.string().optional(),
      measuredValue: z.number().optional(),
      useOuterAngle: z.boolean().optional(),
    })).mutation(({ input }) => db.createAnnotation(input)),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      data: z.any().optional(),
      color: z.string().optional(),
      label: z.string().optional(),
      metricName: z.string().optional(),
      measuredValue: z.number().optional(),
      useOuterAngle: z.boolean().optional(),
    })).mutation(({ input }) => {
      const { id, ...data } = input;
      return db.updateAnnotation(id, data);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteAnnotation(input.id)),
  }),

  metrics: router({
    list: protectedProcedure.query(({ ctx }) => db.getMetricsStandards(ctx.user.id)),
    create: protectedProcedure.input(z.object({
      metricId: z.string().optional(),
      metricName: z.string().min(1),
      metricCategory: z.string().min(1),
      view: z.string().optional(),
      phase: z.string().optional(),
      unit: z.string().optional(),
      description: z.string().optional(),
      whatToMeasure: z.string().optional(),
      linesToDraw: z.string().optional(),
      lowMin: z.number().optional(),
      lowMax: z.number().optional(),
      lowFinding: z.string().optional(),
      optimalMin: z.number().optional(),
      optimalMax: z.number().optional(),
      highMin: z.number().optional(),
      highMax: z.number().optional(),
      highFinding: z.string().optional(),
      lowLoadShift: z.string().optional(),
      highLoadShift: z.string().optional(),
      needsImprovementMin: z.number().optional(),
      needsImprovementMax: z.number().optional(),
      acceptableMin: z.number().optional(),
      acceptableMax: z.number().optional(),
      excellentMin: z.number().optional(),
      excellentMax: z.number().optional(),
      isHigherBetter: z.boolean().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
    })).mutation(({ ctx, input }) => db.createMetricsStandard({ ...input, userId: ctx.user.id })),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      metricId: z.string().optional().nullable(),
      metricName: z.string().optional(),
      metricCategory: z.string().optional(),
      view: z.string().optional().nullable(),
      phase: z.string().optional().nullable(),
      unit: z.string().optional(),
      description: z.string().optional(),
      whatToMeasure: z.string().optional().nullable(),
      linesToDraw: z.string().optional().nullable(),
      lowMin: z.number().optional().nullable(),
      lowMax: z.number().optional().nullable(),
      lowFinding: z.string().optional().nullable(),
      optimalMin: z.number().optional().nullable(),
      optimalMax: z.number().optional().nullable(),
      highMin: z.number().optional().nullable(),
      highMax: z.number().optional().nullable(),
      highFinding: z.string().optional().nullable(),
      lowLoadShift: z.string().optional().nullable(),
      highLoadShift: z.string().optional().nullable(),
      needsImprovementMin: z.number().optional().nullable(),
      needsImprovementMax: z.number().optional().nullable(),
      acceptableMin: z.number().optional().nullable(),
      acceptableMax: z.number().optional().nullable(),
      excellentMin: z.number().optional().nullable(),
      excellentMax: z.number().optional().nullable(),
      isHigherBetter: z.boolean().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
    })).mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return db.updateMetricsStandard(id, ctx.user.id, data);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ ctx, input }) => db.deleteMetricsStandard(input.id, ctx.user.id)),
    seedDefaults: protectedProcedure.input(z.object({ force: z.boolean().optional() }).optional()).mutation(async ({ ctx, input }) => {
      const existing = await db.getMetricsStandards(ctx.user.id);
      if (existing.length > 0 && !input?.force) return { seeded: false, message: "Standards already exist. Use force=true to reseed." };
      if (input?.force && existing.length > 0) {
        for (const m of existing) {
          await db.deleteMetricsStandard(m.id, ctx.user.id);
        }
      }
      const defaults = getDefaultMetrics();
      for (const m of defaults) {
        await db.createMetricsStandard({ ...m, userId: ctx.user.id });
      }
      return { seeded: true, message: `Seeded ${defaults.length} default metrics (10-metric format)` };
    }),
  }),

  dynamo: router({
    list: protectedProcedure.input(z.object({ assessmentId: z.number() })).query(({ input }) => db.getDynamoTests(input.assessmentId)),
    create: protectedProcedure.input(z.object({
      assessmentId: z.number(),
      joint: z.string().min(1),
      movement: z.string().min(1),
      position: z.string().optional(),
      leftValue: z.number().optional().nullable(),
      rightValue: z.number().optional().nullable(),
      unit: z.string().optional(),
      leftPeakForce: z.number().optional().nullable(),
      rightPeakForce: z.number().optional().nullable(),
      peakForceUnit: z.string().optional(),
      leftPeakRfd: z.number().optional().nullable(),
      rightPeakRfd: z.number().optional().nullable(),
      peakRfdUnit: z.string().optional(),
      leftTimeToPeak: z.number().optional().nullable(),
      rightTimeToPeak: z.number().optional().nullable(),
      leftReps: z.number().optional().nullable(),
      rightReps: z.number().optional().nullable(),
      notes: z.string().optional(),
      sortOrder: z.number().optional(),
    })).mutation(({ input }) => db.createDynamoTest(input)),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      joint: z.string().optional(),
      movement: z.string().optional(),
      position: z.string().optional().nullable(),
      leftValue: z.number().optional().nullable(),
      rightValue: z.number().optional().nullable(),
      unit: z.string().optional(),
      leftPeakForce: z.number().optional().nullable(),
      rightPeakForce: z.number().optional().nullable(),
      peakForceUnit: z.string().optional(),
      leftPeakRfd: z.number().optional().nullable(),
      rightPeakRfd: z.number().optional().nullable(),
      peakRfdUnit: z.string().optional(),
      leftTimeToPeak: z.number().optional().nullable(),
      rightTimeToPeak: z.number().optional().nullable(),
      leftReps: z.number().optional().nullable(),
      rightReps: z.number().optional().nullable(),
      notes: z.string().optional().nullable(),
      sortOrder: z.number().optional(),
    })).mutation(({ input }) => {
      const { id, ...data } = input;
      return db.updateDynamoTest(id, data);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteDynamoTest(input.id)),
  }),

  video: router({
    list: protectedProcedure.input(z.object({ assessmentId: z.number() })).query(({ input }) => db.getVideos(input.assessmentId)),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteVideo(input.id)),
  }),

  practitioner: router({
    list: protectedProcedure.query(({ ctx }) => db.getPractitioners(ctx.user.id)),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(({ ctx, input }) => db.getPractitioner(input.id, ctx.user.id)),
    getDefault: protectedProcedure.query(({ ctx }) => db.getDefaultPractitioner(ctx.user.id)),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      title: z.string().optional(),
      qualifications: z.string().optional(),
      clinic: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      website: z.string().optional(),
      address: z.string().optional(),
      isDefault: z.boolean().optional(),
    })).mutation(({ ctx, input }) => db.createPractitioner({ ...input, userId: ctx.user.id })),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      title: z.string().optional().nullable(),
      qualifications: z.string().optional().nullable(),
      clinic: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
      email: z.string().optional().nullable(),
      website: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      isDefault: z.boolean().optional(),
    })).mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return db.updatePractitioner(id, ctx.user.id, data);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ ctx, input }) => db.deletePractitioner(input.id, ctx.user.id)),
    setDefault: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ ctx, input }) => db.setDefaultPractitioner(input.id, ctx.user.id)),
  }),

  upload: router({
    getPresignedUrl: protectedProcedure.input(z.object({
      fileName: z.string(),
      contentType: z.string(),
      folder: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const folder = input.folder || "uploads";
      const ext = input.fileName.split(".").pop() || "bin";
      const key = `${folder}/${ctx.user.id}/${nanoid()}.${ext}`;
      return { key, uploadKey: key };
    }),
    uploadFile: protectedProcedure.input(z.object({
      key: z.string(),
      base64Data: z.string(),
      contentType: z.string(),
    })).mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64Data, "base64");
      const result = await storagePut(input.key, buffer, input.contentType);
      return result;
    }),
  }),

  pdf: router({
    toImages: protectedProcedure.input(z.object({
      url: z.string().url(),
      dpi: z.number().optional().default(150),
      maxPages: z.number().optional().default(10),
    })).mutation(async ({ input }) => {
      const { execSync } = await import('child_process');
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      const crypto = await import('crypto');

      const tmpDir = os.tmpdir();
      const id = crypto.randomBytes(8).toString('hex');
      const pdfPath = path.join(tmpDir, `pdf_${id}.pdf`);
      const outPrefix = path.join(tmpDir, `pdfimg_${id}`);

      try {
        // Download PDF
        const resp = await fetch(input.url);
        if (!resp.ok) throw new Error(`Failed to fetch PDF: ${resp.status}`);
        const buffer = Buffer.from(await resp.arrayBuffer());
        fs.writeFileSync(pdfPath, buffer);

        // Check if pdftoppm is available
        let hasPdftoppm = false;
        try { execSync('which pdftoppm', { stdio: 'pipe' }); hasPdftoppm = true; } catch {}

        const images: string[] = [];

        if (hasPdftoppm) {
          // Use pdftoppm for high-quality conversion
          execSync(`pdftoppm -jpeg -r ${input.dpi} -l ${input.maxPages} "${pdfPath}" "${outPrefix}"`, { timeout: 30000 });

          // Read generated JPEG files
          const files = fs.readdirSync(tmpDir)
            .filter((f: string) => f.startsWith(`pdfimg_${id}`) && f.endsWith('.jpg'))
            .sort();

          for (const file of files) {
            const filePath = path.join(tmpDir, file);
            const imgData = fs.readFileSync(filePath);
            images.push(`data:image/jpeg;base64,${imgData.toString('base64')}`);
            fs.unlinkSync(filePath);
          }
        } else {
          throw new Error('PDF conversion not available on this server (pdftoppm not found)');
        }

        // Clean up
        try { fs.unlinkSync(pdfPath); } catch {}

        return { images, pageCount: images.length };
      } catch (err: any) {
        // Clean up on error
        try { fs.unlinkSync(pdfPath); } catch {}
        throw new Error(`PDF conversion failed: ${err.message}`);
      }
    }),
  }),

  ai: router({
    analyzePose: protectedProcedure.input(z.object({
      screenshotId: z.number(),
      imageUrl: z.string(),
      viewType: z.enum(["side_left", "side_right", "back"]),
      gaitPhase: z.enum(["foot_strike", "loading", "mid_stance", "push_off", "swing", "other"]),
    })).mutation(async ({ ctx, input }) => {
      // Determine which metrics to detect based on view type and gait phase
      const allMetrics = getMetricsForView(input.viewType, input.gaitPhase);
      // Filter out category-based metrics (like M01 Overstride) — they use manual category picker, not AI angle detection
      const metricsToDetect = allMetrics.filter(m => m.measureType !== "category");
      if (metricsToDetect.length === 0) return { annotations: [], message: "No metrics to detect for this view/phase combination" };

      const prompt = buildPoseAnalysisPrompt(input.viewType, input.gaitPhase, metricsToDetect);

      try {
        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an expert biomechanics analyst specializing in running gait analysis. You analyze screenshots of runners to identify key body landmarks and measure biomechanical angles. You must return precise normalized coordinates (0-1 range, where 0,0 is top-left and 1,1 is bottom-right) for body landmarks visible in the image. Be as accurate as possible with landmark placement.`
            },
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: input.imageUrl, detail: "high" } },
                { type: "text", text: prompt }
              ]
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "pose_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  landmarks: {
                    type: "array",
                    description: "Detected body landmarks with normalized coordinates",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Landmark name e.g. knee, ankle, hip, shoulder" },
                        x: { type: "number", description: "Normalized x coordinate 0-1" },
                        y: { type: "number", description: "Normalized y coordinate 0-1" },
                        confidence: { type: "number", description: "Confidence 0-1" }
                      },
                      required: ["name", "x", "y", "confidence"],
                      additionalProperties: false
                    }
                  },
                  annotations: {
                    type: "array",
                    description: "Suggested angle/line annotations to draw",
                    items: {
                      type: "object",
                      properties: {
                        metricName: { type: "string", description: "Name matching a metric standard" },
                        type: { type: "string", description: "angle or line" },
                        points: {
                          type: "array",
                          description: "2 points for line, 3 points for angle (arm1, vertex, arm2). Each point has normalized x,y.",
                          items: {
                            type: "object",
                            properties: {
                              x: { type: "number" },
                              y: { type: "number" }
                            },
                            required: ["x", "y"],
                            additionalProperties: false
                          }
                        },
                        measuredAngle: { type: "number", description: "Measured angle in degrees (0 if line)" },
                        label: { type: "string", description: "Display label" },
                        color: { type: "string", description: "Hex color for the annotation" }
                      },
                      required: ["metricName", "type", "points", "measuredAngle", "label", "color"],
                      additionalProperties: false
                    }
                  },
                  notes: { type: "string", description: "Brief observation about the runner's form" }
                },
                required: ["landmarks", "annotations", "notes"],
                additionalProperties: false
              }
            }
          }
        });

        const content = result.choices[0]?.message?.content;
        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));

        // Save auto-detected annotations to database
        const savedAnnotations: any[] = [];
        for (const ann of parsed.annotations) {
          if (ann.points.length >= 2) {
            // Recalculate angle from points for accuracy
            let measuredValue = ann.measuredAngle;
            if (ann.type === "angle" && ann.points.length >= 3) {
              const [p1, vertex, p2] = ann.points;
              const v1 = { x: p1.x - vertex.x, y: p1.y - vertex.y };
              const v2 = { x: p2.x - vertex.x, y: p2.y - vertex.y };
              const dot = v1.x * v2.x + v1.y * v2.y;
              const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
              const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
              if (mag1 > 0 && mag2 > 0) {
                measuredValue = Math.round((Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * 180) / Math.PI * 10) / 10;
              }
            }

            const saved = await db.createAnnotation({
              screenshotId: input.screenshotId,
              annotationType: ann.type === "angle" ? "angle" : "line",
              data: { points: ann.points, subType: ann.type, autoDetected: true },
              color: ann.color || "#3b82f6",
              label: ann.type === "angle" ? `${Math.round(measuredValue)}°` : ann.label,
              metricName: ann.metricName,
              measuredValue: measuredValue || undefined,
            });
            savedAnnotations.push(saved);
          }
        }

        return {
          annotations: savedAnnotations,
          landmarks: parsed.landmarks,
          notes: parsed.notes,
          message: `Auto-detected ${savedAnnotations.length} annotations`,
        };
      } catch (err: any) {
        console.error("Pose analysis failed:", err);
        return { annotations: [], landmarks: [], notes: "", message: `Analysis failed: ${err.message}` };
      }
    }),

    generateReport: protectedProcedure.input(z.object({
      assessmentId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const assessment = await db.getAssessment(input.assessmentId, ctx.user.id);
      if (!assessment) throw new Error("Assessment not found");

      const patient = await db.getPatient(assessment.patientId, ctx.user.id);
      if (!patient) throw new Error("Patient not found");

      const screenshotsList = await db.getScreenshots(input.assessmentId);
      const annotationsList: any[] = [];
      for (const ss of screenshotsList) {
        const anns = await db.getAnnotations(ss.id);
        annotationsList.push({ screenshot: ss, annotations: anns });
      }

      // Fetch dynamo test data
      const dynamoTestData = await db.getDynamoTests(input.assessmentId);

      // Fetch metrics standards and build ratings
      const metricsStandards = await db.getMetricsStandards(ctx.user.id);
      const metricsRatings = buildMetricsRatings(annotationsList, metricsStandards, assessment);

      // Build left/right asymmetry comparison
      const asymmetryData = buildAsymmetryComparison(annotationsList, metricsStandards);

      const prompt = buildReportPrompt(patient, assessment, annotationsList, metricsRatings, asymmetryData, dynamoTestData);

      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert sports physiotherapist report writer. Generate a comprehensive, professional running assessment report based on a 10-metric running analysis system. The report should be well-structured, clinically accurate, and written in a clear, professional tone. Include specific findings, clinical reasoning, and actionable recommendations. Format the output as a JSON object with the following sections: background, impressionFromTesting (with subsections for each problem identified), management (with runningCues, mobilityExercises, strengthExercises, runningProgramming). Each section should have a 'title' and 'content' field.

IMPORTANT FORMATTING RULES:
1. All text fields must be plain text only — do NOT use markdown formatting, code blocks, backticks, asterisks for bold, or any special formatting characters.
2. For the 'problems' array (Key Findings), each finding string in the 'findings' array MUST be a SHORT chain-reasoning statement (one line, max 2-3 arrows) that identifies ONE specific biomechanical observation and traces it to ONE specific tissue-level consequence. Do NOT repeat the same reasoning chain across multiple findings. Each finding must point to a DIFFERENT consequence. Keep it concise. Example: "Overstride 15 deg -> Braking force increase -> Anterior tibial stress increase". Another example: "Contralateral pelvic drop 8 deg -> ITB tensile load increase". Use -> for causal arrows and increase/decrease labels.
3. For management sections (runningCues, gaitRelearning, mobilityExercises, strengthExercises, runningProgramming), write each recommendation on a separate line so they can be displayed as bullet points. Use newline characters to separate items. Do NOT number them or use bullet characters.
4. Write background and impressionFromTesting in natural prose paragraphs.`
          },
          { role: "user", content: prompt }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "running_report",
            strict: true,
            schema: {
              type: "object",
              properties: {
                background: { type: "string", description: "Runner background summary" },
                impressionFromTesting: { type: "string", description: "Detailed impression from all testing including VO2, InBody, and gait analysis" },
                problems: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      findings: { type: "array", items: { type: "string", description: "A concise chain-reasoning statement (max 2-3 arrows) pointing to ONE unique consequence. Each finding must identify a DIFFERENT consequence." } }
                    },
                    required: ["title", "description", "findings"],
                    additionalProperties: false
                  }
                },
                management: {
                  type: "object",
                  properties: {
                    runningCues: { type: "string" },
                    gaitRelearning: { type: "string" },
                    mobilityExercises: { type: "string" },
                    strengthExercises: { type: "string" },
                    runningProgramming: { type: "string" }
                  },
                  required: ["runningCues", "gaitRelearning", "mobilityExercises", "strengthExercises", "runningProgramming"],
                  additionalProperties: false
                },
                summary: { type: "string", description: "Brief overall summary" },
                asymmetryAnalysis: {
                  type: "string",
                  description: "Analysis of left vs right side asymmetries. Discuss which metrics show significant differences, clinical implications, and how asymmetries relate to injury risk or performance. If no asymmetry data available, state that bilateral comparison was not performed."
                },
                metricsRatings: {
                  type: "array",
                  description: "Rating for each measured metric based on 10-metric assessment standards",
                  items: {
                    type: "object",
                    properties: {
                      metricName: { type: "string" },
                      measuredValue: { type: "number" },
                      unit: { type: "string" },
                      rating: { type: "string", description: "One of: Low, Optimal, High, Not Measured" },
                      notes: { type: "string", description: "Brief clinical note including finding and load shift if applicable" }
                    },
                    required: ["metricName", "measuredValue", "unit", "rating", "notes"],
                    additionalProperties: false
                  }
                }
              },
              required: ["background", "impressionFromTesting", "problems", "management", "summary", "metricsRatings", "asymmetryAnalysis"],
              additionalProperties: false
            }
          }
        }
      });

      const reportContent = result.choices[0]?.message?.content;
      const reportText = typeof reportContent === "string" ? reportContent : JSON.stringify(reportContent);
      const parsedReport = JSON.parse(reportText);

      // Merge server-computed metricsRatings into the report (more accurate than AI-generated ones)
      if (metricsRatings.length > 0) {
        parsedReport.metricsRatings = metricsRatings.map((r: any) => {
          // Cross-reference asymmetry data to get L/R values for this metric
          const asym = asymmetryData.find((a: any) => a.metricName === r.metricName);
          return {
            metricId: r.metricId,
            metricName: r.metricName,
            measuredValue: r.measuredValue ?? 0,
            unit: r.unit,
            rating: r.rating,
            finding: r.finding,
            loadShift: r.loadShift,
            optimalRange: r.optimalRange,
            view: r.view,
            phase: r.phase,
            notes: parsedReport.metricsRatings?.find((ai: any) => ai.metricName === r.metricName)?.notes || "",
            leftValue: asym?.leftValue ?? null,
            rightValue: asym?.rightValue ?? null,
          };
        });
      }

      // Attach asymmetry data to report
      if (asymmetryData.length > 0) {
        parsedReport.asymmetryData = asymmetryData;
      }

      // Attach dynamo test data to report
      if (dynamoTestData.length > 0) {
        parsedReport.dynamoTests = dynamoTestData;
      }

      await db.updateAssessment(input.assessmentId, ctx.user.id, {
        aiGeneratedReport: JSON.stringify(parsedReport),
        reportJson: parsedReport,
      });

      return { report: parsedReport };
    }),
  }),
});

function buildMetricsRatings(annotatedScreenshots: any[], metricsStandards: any[], assessment?: any): Array<{ metricId: string; metricName: string; measuredValue: number | null; unit: string; rating: string; finding: string; loadShift: string; optimalRange: string; view: string; phase: string }> {
  const ratings: Array<{ metricId: string; metricName: string; measuredValue: number | null; unit: string; rating: string; finding: string; loadShift: string; optimalRange: string; view: string; phase: string }> = [];

  // Collect all annotations that have a metricName
  const metricMeasurements: Record<string, { value: number; label: string }[]> = {};
  for (const item of annotatedScreenshots) {
    for (const ann of item.annotations) {
      if (ann.metricName && ann.measuredValue != null) {
        if (!metricMeasurements[ann.metricName]) metricMeasurements[ann.metricName] = [];
        metricMeasurements[ann.metricName].push({ value: ann.measuredValue, label: ann.label || "" });
      }
    }
  }

  // For each active metric standard, find the measurement and rate it using Low/Optimal/High
  for (const std of metricsStandards) {
    if (!std.isActive) continue;

    // Category-based metrics (M01 Overstride, M10 Push-Off Alignment)
    if (std.unit === "category" || std.metricId === "M01" || std.metricId === "M10") {
      let category: string | null = null;
      let rating = "Not Measured";
      let finding = "";
      let loadShift = "";
      const optimalRange = "Category-based";

      if (std.metricId === "M01") {
        // M01 Overstride
        category = assessment?.overstrideCategory || null;
        const cadence = assessment?.cadence || null;
        if (category) {
          if (category === "optimal") {
            rating = "Optimal";
            finding = "Foot lands close to under centre of mass";
            loadShift = "—";
          } else if (category === "understride") {
            rating = "Low";
            finding = std.lowFinding || "Understride — foot lands behind/under COM";
            loadShift = std.lowLoadShift || "";
          } else {
            rating = "High";
            finding = category === "overstride"
              ? (std.highFinding || "Overstride — excess braking")
              : "Mild overstride — foot slightly ahead of COM";
            loadShift = std.highLoadShift || "";
          }
          if (cadence && cadence < 165 && (category === "mild_overstride" || category === "overstride")) {
            finding += ` (cadence ${cadence} spm — low cadence amplifies braking forces)`;
          } else if (cadence) {
            finding += ` (cadence ${cadence} spm)`;
          }
        }
      } else if (std.metricId === "M10") {
        // M10 Push-Off Alignment
        category = assessment?.pushOffCategory || null;
        if (category) {
          const catLabels: Record<string, string> = {
            lateral_push_off: "Lateral Push Off",
            balanced: "Balanced",
            medial_push_off: "Medial Push Off",
          };
          if (category === "balanced") {
            rating = "Optimal";
            finding = "Balanced push-off alignment — neutral frontal plane";
            loadShift = "—";
          } else if (category === "lateral_push_off") {
            rating = "Low";
            finding = std.lowFinding || "Lateral push-off — foot rolls outward at toe-off";
            loadShift = std.lowLoadShift || "";
          } else {
            rating = "High";
            finding = std.highFinding || "Medial push-off — foot rolls inward at toe-off";
            loadShift = std.highLoadShift || "";
          }
        }
      }

      ratings.push({
        metricId: std.metricId || "",
        metricName: std.metricName,
        measuredValue: null,
        unit: "category",
        rating,
        finding,
        loadShift,
        optimalRange,
        view: std.view || std.metricCategory || "",
        phase: std.phase || "",
      });
      continue;
    }

    // Standard degree-based metrics
    const measurements = metricMeasurements[std.metricName];
    const avgValue = measurements && measurements.length > 0
      ? measurements.reduce((sum: number, m: any) => sum + m.value, 0) / measurements.length
      : null;

    let rating = "Not Measured";
    let finding = "";
    let loadShift = "";
    const optimalRange = std.optimalMin != null && std.optimalMax != null ? `${std.optimalMin}–${std.optimalMax}°` : "";

    if (avgValue !== null) {
      if (std.optimalMin != null && std.optimalMax != null && avgValue >= std.optimalMin && avgValue <= std.optimalMax) {
        rating = "Optimal";
        finding = "Within optimal range";
        loadShift = "—";
      } else if (std.lowMax != null && avgValue <= std.lowMax) {
        rating = "Low";
        finding = std.lowFinding || "Below optimal";
        loadShift = std.lowLoadShift || "";
      } else if (std.highMin != null && avgValue >= std.highMin) {
        rating = "High";
        finding = std.highFinding || "Above optimal";
        loadShift = std.highLoadShift || "";
      } else {
        // In the gap between low/optimal or optimal/high — treat as borderline
        rating = "Optimal";
        finding = "Near optimal range";
        loadShift = "—";
      }
    }

    ratings.push({
      metricId: std.metricId || "",
      metricName: std.metricName,
      measuredValue: avgValue !== null ? Math.round(avgValue * 10) / 10 : null,
      unit: std.unit || "",
      rating,
      finding,
      loadShift,
      optimalRange,
      view: std.view || std.metricCategory || "",
      phase: std.phase || "",
    });
  }

  return ratings;
}

function buildReportPrompt(patient: any, assessment: any, annotatedScreenshots: any[], metricsRatings?: any[], asymmetryData?: any[], dynamoTests?: any[]): string {
  let prompt = `Generate a running assessment report for the following patient:\n\n`;
  prompt += `**Patient:** ${patient.name}\n`;
  if (patient.dateOfBirth) prompt += `**DOB:** ${patient.dateOfBirth}\n`;
  if (patient.gender) prompt += `**Gender:** ${patient.gender}\n`;
  if (patient.height) prompt += `**Height:** ${patient.height} cm\n`;
  if (patient.weight) prompt += `**Weight:** ${patient.weight} kg\n`;

  prompt += `\n**Assessment Date:** ${assessment.assessmentDate}\n`;


  if (assessment.backgroundNotes) prompt += `\n**Background Notes (from physio):**\n${assessment.backgroundNotes}\n`;
  if (assessment.trainingFrequency) prompt += `**Training Frequency:** ${assessment.trainingFrequency}\n`;
  if (assessment.weeklyMileage) prompt += `**Weekly Mileage:** ${assessment.weeklyMileage}\n`;
  if (assessment.runningGoals) prompt += `**Running Goals:** ${assessment.runningGoals}\n`;
  if (assessment.runningExperience) prompt += `**Running Experience:** ${assessment.runningExperience}\n`;
  if (assessment.currentPace) prompt += `**Current Pace:** ${assessment.currentPace}\n`;
  if (assessment.cadence) prompt += `**Cadence:** ${assessment.cadence} steps/min\n`;
  if (assessment.overstrideCategory) {
    const catLabels: Record<string, string> = { understride: "Understride", optimal: "Reference Target", mild_overstride: "Mild Overstride", overstride: "Overstride" };
    prompt += `**Overstride Category (M01):** ${catLabels[assessment.overstrideCategory] || assessment.overstrideCategory}`;
    if (assessment.cadence) prompt += ` (cadence: ${assessment.cadence} spm)`;
    prompt += `\n`;
  }
  if (assessment.pushOffCategory) {
    const catLabels: Record<string, string> = { lateral_push_off: "Lateral Push Off", balanced: "Balanced", medial_push_off: "Medial Push Off" };
    prompt += `**Push-Off Alignment (M10):** ${catLabels[assessment.pushOffCategory] || assessment.pushOffCategory}\n`;
  }
  if (assessment.concerns) prompt += `**Concerns:** ${assessment.concerns}\n`;

  if (assessment.injuries) {
    const injuries = typeof assessment.injuries === "string" ? JSON.parse(assessment.injuries) : assessment.injuries;
    if (Array.isArray(injuries) && injuries.length > 0) {
      prompt += `\n**Injury History:**\n`;
      injuries.forEach((inj: any, i: number) => {
        prompt += `${i + 1}. ${inj.description}${inj.date ? ` (${inj.date})` : ""}${inj.status ? ` - ${inj.status}` : ""}\n`;
      });
    }
  }

  // InBody & VO2 - uploaded PDFs
  if (assessment.inbodyFileUrl || assessment.vo2FileUrl) {
    prompt += `\n**Test Results:**\n`;
    if (assessment.inbodyFileUrl) {
      prompt += `InBody PDF report has been uploaded (${assessment.inbodyFileName || 'InBody report'}).\n`;
      if (assessment.inbodyNotes) prompt += `InBody Notes: ${assessment.inbodyNotes}\n`;
    }
    if (assessment.vo2FileUrl) {
      prompt += `VO2 Master PDF report has been uploaded (${assessment.vo2FileName || 'VO2 report'}).\n`;
      if (assessment.vo2Notes) prompt += `VO2 Notes: ${assessment.vo2Notes}\n`;
    }
  }

  // Gait Analysis
  if (annotatedScreenshots.length > 0) {
    prompt += `\n**Gait Analysis Findings:**\n`;
    for (const item of annotatedScreenshots) {
      const ss = item.screenshot;
      prompt += `\n${ss.viewType.replace("_", " ")} - ${ss.gaitPhase.replace("_", " ")}:\n`;
      if (ss.description) prompt += `Description: ${ss.description}\n`;
      for (const ann of item.annotations) {
        if (ann.metricName) {
          prompt += `- ${ann.metricName}: ${ann.measuredValue != null ? ann.measuredValue + (ann.label ? " " + ann.label : "") : ann.label || ""}\n`;
        } else if (ann.label) {
          prompt += `- ${ann.label}: ${ann.measuredValue ? ann.measuredValue + "°" : ""}\n`;
        }
      }
    }
  }

  // Metrics Ratings (12-Metric Low/Optimal/High format)
  if (metricsRatings && metricsRatings.length > 0) {
    prompt += `\n**Biomechanical Metrics Ratings (12-Metric Assessment):**\n`;
    prompt += `Rating scale: Low (below optimal) / Optimal / High (above optimal)\n`;
    for (const r of metricsRatings) {
      if (r.measuredValue !== null) {
        prompt += `- [${r.metricId}] ${r.metricName} (${r.view}, ${r.phase}): ${r.measuredValue}° → ${r.rating}`;
        if (r.finding) prompt += ` — ${r.finding}`;
        if (r.loadShift && r.loadShift !== "—") prompt += ` | Load shift: ${r.loadShift}`;
        prompt += ` (Optimal: ${r.optimalRange})\n`;
      } else {
        prompt += `- [${r.metricId}] ${r.metricName} (${r.view}, ${r.phase}): Not measured\n`;
      }
    }
    prompt += `\nPlease include these metric ratings in the metricsRatings array of your response. Use the exact rating values (Low/Optimal/High/Not Measured). For each metric, include the finding and load shift information in the notes field.`;
  }

  // VALD Dynamo Strength Test Data
  if (dynamoTests && dynamoTests.length > 0) {
    prompt += `\n**VALD Dynamo Handheld Dynamometer Results:**\n`;
    const groupedByJoint: Record<string, any[]> = {};
    for (const t of dynamoTests) {
      if (!groupedByJoint[t.joint]) groupedByJoint[t.joint] = [];
      groupedByJoint[t.joint].push(t);
    }
    for (const [joint, tests] of Object.entries(groupedByJoint)) {
      prompt += `\n${joint}:\n`;
      for (const t of tests) {
        const pos = t.position ? ` [${t.position}]` : "";
        prompt += `- ${t.movement}${pos}:\n`;
        // Mean Force
        const left = t.leftValue != null ? `L: ${t.leftValue}${t.unit}` : "L: N/A";
        const right = t.rightValue != null ? `R: ${t.rightValue}${t.unit}` : "R: N/A";
        const asymmetry = t.asymmetryPercent != null ? ` (Asymmetry: ${t.asymmetryPercent}%)` : "";
        prompt += `  Mean Force: ${left}, ${right}${asymmetry}\n`;
        // Peak Force
        if (t.leftPeakForce != null || t.rightPeakForce != null) {
          const lpf = t.leftPeakForce != null ? `L: ${t.leftPeakForce}${t.peakForceUnit || 'N'}` : "L: N/A";
          const rpf = t.rightPeakForce != null ? `R: ${t.rightPeakForce}${t.peakForceUnit || 'N'}` : "R: N/A";
          const pfMax = Math.max(t.leftPeakForce || 0, t.rightPeakForce || 0);
          const pfMin = Math.min(t.leftPeakForce || 0, t.rightPeakForce || 0);
          const pfAsym = pfMax > 0 && t.leftPeakForce != null && t.rightPeakForce != null ? Math.round(((pfMax - pfMin) / pfMax) * 100) : null;
          prompt += `  Peak Force: ${lpf}, ${rpf}${pfAsym != null ? ` (Asymmetry: ${pfAsym}%)` : ''}\n`;
        }
        // Peak RFD
        if (t.leftPeakRfd != null || t.rightPeakRfd != null) {
          const lrfd = t.leftPeakRfd != null ? `L: ${t.leftPeakRfd}${t.peakRfdUnit || 'N/s'}` : "L: N/A";
          const rrfd = t.rightPeakRfd != null ? `R: ${t.rightPeakRfd}${t.peakRfdUnit || 'N/s'}` : "R: N/A";
          const rfdMax = Math.max(t.leftPeakRfd || 0, t.rightPeakRfd || 0);
          const rfdMin = Math.min(t.leftPeakRfd || 0, t.rightPeakRfd || 0);
          const rfdAsym = rfdMax > 0 && t.leftPeakRfd != null && t.rightPeakRfd != null ? Math.round(((rfdMax - rfdMin) / rfdMax) * 100) : null;
          prompt += `  Peak RFD: ${lrfd}, ${rrfd}${rfdAsym != null ? ` (Asymmetry: ${rfdAsym}%)` : ''}\n`;
        }
        // Time to Peak Force
        if (t.leftTimeToPeak != null || t.rightTimeToPeak != null) {
          const lttp = t.leftTimeToPeak != null ? `L: ${t.leftTimeToPeak}ms` : "L: N/A";
          const rttp = t.rightTimeToPeak != null ? `R: ${t.rightTimeToPeak}ms` : "R: N/A";
          const ttpMax = Math.max(t.leftTimeToPeak || 0, t.rightTimeToPeak || 0);
          const ttpMin = Math.min(t.leftTimeToPeak || 0, t.rightTimeToPeak || 0);
          const ttpAsym = ttpMax > 0 && t.leftTimeToPeak != null && t.rightTimeToPeak != null ? Math.round(((ttpMax - ttpMin) / ttpMax) * 100) : null;
          prompt += `  Time to Peak: ${lttp}, ${rttp}${ttpAsym != null ? ` (Asymmetry: ${ttpAsym}%)` : ''}\n`;
        }
        if (t.notes) prompt += `  Notes: ${t.notes}\n`;
      }
    }
    prompt += `\nPlease include the strength testing findings in your impression. Analyze Mean Force, Peak Force, Peak RFD (Rate of Force Development), and Time to Peak Force. Note any significant asymmetries (>15%) and relate them to running biomechanics and injury risk. Low Peak RFD may indicate reduced neuromuscular control. Delayed Time to Peak Force may suggest slower muscle activation. Include strength-specific recommendations in the management section.`;
  }

  // Clinical notes
  if (assessment.clinicalImpression) prompt += `\n**Physio's Clinical Impression:**\n${assessment.clinicalImpression}\n`;
  if (assessment.thingsToImprove) prompt += `\n**Things to Improve (from physio):**\n${assessment.thingsToImprove}\n`;
  if (assessment.managementPlan) prompt += `\n**Management Plan Notes (from physio):**\n${assessment.managementPlan}\n`;
  if (assessment.runningCues) prompt += `\n**Running Cues (from physio):**\n${assessment.runningCues}\n`;
  if (assessment.mobilityExercises) prompt += `\n**Mobility Exercises (from physio):**\n${assessment.mobilityExercises}\n`;
  if (assessment.strengthExercises) prompt += `\n**Strength Exercises (from physio):**\n${assessment.strengthExercises}\n`;
  if (assessment.runningProgramming) prompt += `\n**Running Programming (from physio):**\n${assessment.runningProgramming}\n`;

  // Left/Right Asymmetry Data
  if (asymmetryData && asymmetryData.length > 0) {
    prompt += `\n**Left vs Right Asymmetry Comparison:**\n`;
    for (const a of asymmetryData) {
      if (a.leftValue !== null && a.rightValue !== null) {
        prompt += `- ${a.metricName}: Left=${a.leftValue}°, Right=${a.rightValue}°, Difference=${a.difference}° (${a.percentDiff}%), Rating: ${a.rating}\n`;
      } else if (a.leftValue !== null) {
        prompt += `- ${a.metricName}: Left=${a.leftValue}° (right side not measured)\n`;
      } else if (a.rightValue !== null) {
        prompt += `- ${a.metricName}: Right=${a.rightValue}° (left side not measured)\n`;
      }
    }
    prompt += `\nPlease include a detailed asymmetry analysis in the 'asymmetryAnalysis' field. Discuss clinical implications of any significant asymmetries (>10% difference), relate them to injury risk, and suggest corrective strategies.`;
  } else {
    prompt += `\nNo bilateral comparison data is available. Note this in the asymmetryAnalysis field.`;
  }

  prompt += `\nPlease synthesize all the above information into a coherent, professional running assessment report. Use the physio's clinical notes as the primary guide for the impression and management sections, but enhance them with proper clinical language and structure. Make the report read as if written by an experienced sports physiotherapist.`;

  return prompt;
}

// Build left vs right asymmetry comparison from annotated screenshots
// Includes all 10 metrics: Side view (M01-M05) uses side_left/side_right, Back view (M06-M10) uses legSide field
function buildAsymmetryComparison(annotatedScreenshots: any[], metricsStandards: any[]): Array<{
  metricName: string; leftValue: number | null; rightValue: number | null;
  difference: number | null; percentDiff: number | null; rating: string; view: string;
}> {
  // Separate left and right annotations for side view AND back view
  const leftSideMetrics: Record<string, number[]> = {};
  const rightSideMetrics: Record<string, number[]> = {};
  const leftBackMetrics: Record<string, number[]> = {};
  const rightBackMetrics: Record<string, number[]> = {};

  for (const item of annotatedScreenshots) {
    const ss = item.screenshot;
    for (const ann of item.annotations) {
      if (!ann.metricName || ann.measuredValue == null) continue;
      if (ss.viewType === "side_left") {
        if (!leftSideMetrics[ann.metricName]) leftSideMetrics[ann.metricName] = [];
        leftSideMetrics[ann.metricName].push(ann.measuredValue);
      } else if (ss.viewType === "side_right") {
        if (!rightSideMetrics[ann.metricName]) rightSideMetrics[ann.metricName] = [];
        rightSideMetrics[ann.metricName].push(ann.measuredValue);
      } else if (ss.viewType === "back") {
        // Use legSide field to determine left vs right for back view
        if (ss.legSide === "left") {
          if (!leftBackMetrics[ann.metricName]) leftBackMetrics[ann.metricName] = [];
          leftBackMetrics[ann.metricName].push(ann.measuredValue);
        } else if (ss.legSide === "right") {
          if (!rightBackMetrics[ann.metricName]) rightBackMetrics[ann.metricName] = [];
          rightBackMetrics[ann.metricName].push(ann.measuredValue);
        }
      }
    }
  }

  // Include all active metrics
  const allMetrics = metricsStandards.filter((m: any) => m.isActive);

  const results: Array<{
    metricName: string; leftValue: number | null; rightValue: number | null;
    difference: number | null; percentDiff: number | null; rating: string; view: string;
  }> = [];

  for (const metric of allMetrics) {
    const isSideView = metric.view === "Side" || metric.metricCategory?.toLowerCase().includes("side");
    const isBackView = metric.view === "Back" || metric.metricCategory?.toLowerCase().includes("back");
    if (!isSideView && !isBackView) continue;

    const leftMap = isSideView ? leftSideMetrics : leftBackMetrics;
    const rightMap = isSideView ? rightSideMetrics : rightBackMetrics;

    const leftVals = leftMap[metric.metricName];
    const rightVals = rightMap[metric.metricName];
    const leftAvg = leftVals && leftVals.length > 0 ? leftVals.reduce((a: number, b: number) => a + b, 0) / leftVals.length : null;
    const rightAvg = rightVals && rightVals.length > 0 ? rightVals.reduce((a: number, b: number) => a + b, 0) / rightVals.length : null;

    let difference: number | null = null;
    let percentDiff: number | null = null;
    let rating = "Incomplete";

    if (leftAvg !== null && rightAvg !== null) {
      difference = Math.round((rightAvg - leftAvg) * 10) / 10;
      const avg = (Math.abs(leftAvg) + Math.abs(rightAvg)) / 2;
      percentDiff = avg > 0 ? Math.round((Math.abs(difference) / avg) * 1000) / 10 : 0;

      if (percentDiff < 5) rating = "Symmetric";
      else if (percentDiff < 10) rating = "Mild Asymmetry";
      else if (percentDiff < 15) rating = "Moderate Asymmetry";
      else rating = "Significant Asymmetry";
    }

    if (leftAvg !== null || rightAvg !== null) {
      results.push({
        metricName: metric.metricName,
        leftValue: leftAvg !== null ? Math.round(leftAvg * 10) / 10 : null,
        rightValue: rightAvg !== null ? Math.round(rightAvg * 10) / 10 : null,
        difference,
        percentDiff,
        rating,
        view: isSideView ? "Side" : "Back",
      });
    }
  }

  return results;
}

// Mapping of which metrics to auto-detect for each view type and gait phase
// 12-Metric Running Video Assessment (M01-M12)
function getMetricsForView(viewType: string, gaitPhase: string): Array<{ metricName: string; description: string; measureType: string }> {
  const sideViewMetrics: Record<string, Array<{ metricName: string; description: string; measureType: string }>> = {
    foot_strike: [
      // M01: Overstride Angle — IC (category-based, not measured by angle tool)
      {
        metricName: "Overstride Angle",
        description: "[M01] Overstride assessment — CATEGORY-BASED, not angle measurement. Use the Overstride Category picker in the assessment editor instead. Visual reference: draw Vertical GT + GT→Heel to see foot placement relative to centre of mass. Must be paired with cadence for proper judgment.",
        measureType: "category"
      },
      // M02: Tibial Inclination — IC
      {
        metricName: "Tibial Inclination",
        description: "[M02] Forward tibial angle relative to vertical. Place 3 points: [a point DIRECTLY ABOVE the tibial tuberosity (same x, y near top — vertical reference), the TIBIAL TUBEROSITY (bony bump below kneecap), the LATERAL MALLEOLUS (bony bump on outside of ankle)]. Vertex = tibial tuberosity. Optimal: 5–10°.",
        measureType: "angle"
      },
    ],
    loading: [
      // M03: Peak Knee Flexion (Stance)
      {
        metricName: "Peak Knee Flexion (Stance)",
        description: "[M03] Peak knee flexion angle during stance phase. Place 3 points: [HIP (greater trochanter), KNEE (center of knee joint), ANKLE (lateral malleolus)]. Vertex = KNEE. Optimal: 40–48°.",
        measureType: "angle"
      },
    ],
    push_off: [
      // M04: Hip Extension — Toe-Off
      {
        metricName: "Hip Extension",
        description: "[M04] Hip extension angle at late stance / toe-off. Place 3 points: [a point DIRECTLY ABOVE the hip (same x, y near top — vertical reference), the HIP (greater trochanter), the KNEE of trailing leg]. Vertex = HIP. Optimal: 10–20°.",
        measureType: "angle"
      },
    ],
    swing: [
      // M05: Trunk Lean — Mid-Stance (also captured during swing for some analyses)
      {
        metricName: "Trunk Forward Lean",
        description: "[M05] Forward trunk lean angle relative to vertical. Place 3 points: [a point DIRECTLY ABOVE the acromion (same x, y near top — vertical reference), the ACROMION (shoulder tip), the GREATER TROCHANTER (hip)]. Vertex = acromion. Optimal: 5–10°.",
        measureType: "angle"
      },
    ],
    other: [
      // M05: Trunk Lean — Mid-Stance
      {
        metricName: "Trunk Forward Lean",
        description: "[M05] Forward trunk lean angle relative to vertical. Place 3 points: [a point DIRECTLY ABOVE the acromion (same x, y near top — vertical reference), the ACROMION (shoulder tip), the GREATER TROCHANTER (hip)]. Vertex = acromion. Optimal: 5–10°.",
        measureType: "angle"
      },
    ],
  };

  const backViewMetrics: Record<string, Array<{ metricName: string; description: string; measureType: string }>> = {
    foot_strike: [
      // M07: Step Width — IC
      {
        metricName: "Step Width",
        description: "[M07] Foot placement angle from sacral vertical midline at initial contact. Place 3 points: [a point DIRECTLY ABOVE the sacrum (same x, y near top — vertical reference), the SACRUM (center of pelvis), the HEEL CENTER of landing foot]. Vertex = sacrum. Optimal: 5–8° lateral.",
        measureType: "angle"
      },
    ],
    loading: [
      // M06: Pelvic Drop — Mid-Stance
      {
        metricName: "Pelvic Drop",
        description: "[M06] Pelvic tilt angle during mid-stance. Place 3 points: [LEFT ASIS (widest point of left pelvis), RIGHT ASIS (widest point of right pelvis), a point DIRECTLY TO THE RIGHT of left ASIS at SAME HEIGHT (horizontal reference)]. Vertex = LEFT ASIS. Optimal: 4–7°.",
        measureType: "angle"
      },
      // M08: Knee Frontal Angle — Mid-Stance
      {
        metricName: "Knee Frontal Plane Angle",
        description: "[M08] Frontal plane knee valgus angle during mid-stance. Place 3 points: [ASIS/hip on stance leg side, KNEE center of stance leg, ANKLE center of stance leg]. Vertex = KNEE. Optimal: 5–10°.",
        measureType: "angle"
      },
      // M09: Rearfoot Alignment — Mid-Stance
      {
        metricName: "Rearfoot Eversion",
        description: "[M09] Rearfoot eversion angle during mid-stance. Place 3 points: [MID-CALF (center of calf muscle), ACHILLES INSERTION (where Achilles meets heel bone), CALCANEAL BISECTION point (bottom of heel)]. Vertex = Achilles insertion. Optimal: 8–14°.",
        measureType: "angle"
      },
    ],
    push_off: [
      // M10: Push-Off Alignment — Toe-Off (category-based)
      {
        metricName: "Push-Off Alignment",
        description: "[M10] Push-off alignment assessment — CATEGORY-BASED, not angle measurement. Use the Push-Off Category picker in the assessment editor instead. Visual reference: draw Tibial axis + Heel→2nd MT to see frontal plane alignment at push-off.",
        measureType: "category"
      },
    ],
    swing: [],
    other: [],
  };

  // Treat mid_stance as loading (they are the same phase)
  const effectivePhase = gaitPhase === "mid_stance" ? "loading" : gaitPhase;
  if (viewType === "side_left" || viewType === "side_right") {
    return sideViewMetrics[effectivePhase] || [];
  } else if (viewType === "back") {
    return backViewMetrics[effectivePhase] || [];
  }
  return [];
}

function buildPoseAnalysisPrompt(viewType: string, gaitPhase: string, metrics: Array<{ metricName: string; description: string; measureType: string }>): string {
  const viewName = viewType === "side_left" ? "left side" : viewType === "side_right" ? "right side" : "back";
  const phaseName = gaitPhase.replace("_", " ");
  const facingDir = viewType === "side_left" ? "The runner is likely facing LEFT (running left-to-right or right-to-left). " : viewType === "side_right" ? "The runner is likely facing RIGHT. " : "You are looking at the runner from behind. ";

  let prompt = `You are an expert biomechanics analyst performing a running gait video assessment.\n`;
  prompt += `View: ${viewName}. Gait phase: ${phaseName}.\n`;
  prompt += facingDir + `\n`;

  prompt += `STEP 1 — IDENTIFY EXACT ANATOMICAL LANDMARKS:\n`;
  prompt += `Look at the image carefully and identify the EXACT pixel location of each landmark.\n\n`;

  if (viewType === "back") {
    prompt += `BACK VIEW LANDMARKS (identify ALL of these):\n`;
    prompt += `- Left acromion: the outermost tip of the left shoulder (NOT the neck, the actual bony point of the shoulder)\n`;
    prompt += `- Right acromion: the outermost tip of the right shoulder\n`;
    prompt += `- Left ASIS/iliac crest: the widest bony point of the left pelvis (visible as the widest part of the hip area)\n`;
    prompt += `- Right ASIS/iliac crest: the widest bony point of the right pelvis\n`;
    prompt += `- Sacrum: the center point between the two hip bones at the lower back\n`;
    prompt += `- Left knee center: the middle of the left knee joint from behind\n`;
    prompt += `- Right knee center: the middle of the right knee joint from behind\n`;
    prompt += `- Left ankle center: center of the left ankle\n`;
    prompt += `- Right ankle center: center of the right ankle\n`;
    prompt += `- Left mid-calf: center of the left calf muscle, halfway between knee and ankle\n`;
    prompt += `- Right mid-calf: center of the right calf muscle\n`;
    prompt += `- Left Achilles insertion: where the Achilles tendon meets the heel bone (left)\n`;
    prompt += `- Right Achilles insertion: where the Achilles tendon meets the heel bone (right)\n`;
    prompt += `- Left heel center: the bottom center of the left heel\n`;
    prompt += `- Right heel center: the bottom center of the right heel\n`;
  } else {
    prompt += `SIDE VIEW LANDMARKS (identify ALL of these):\n`;
    prompt += `- Greater trochanter: the bony bump on the side of the hip — this is at the level of the hip joint, roughly where the shorts/waistband crease is. It is NOT the waist or the iliac crest (which is higher).\n`;
    prompt += `- Shoulder (glenohumeral joint): the center of the shoulder joint. NOT the neck, NOT the top of the shoulder — the actual joint center.\n`;
    prompt += `- Knee joint center: the center of the knee — the point where the thigh meets the shin, visible as the bend point.\n`;
    prompt += `- Tibial tuberosity: the bony bump just below the kneecap on the front of the shin (slightly below and in front of the knee center).\n`;
    prompt += `- Lateral malleolus: the bony bump on the outside of the ankle.\n`;
    prompt += `- Heel: the back-bottom of the heel where it contacts or is closest to the ground.\n`;
    prompt += `- Toe: the front tip of the foot.\n`;
  }

  prompt += `\nSTEP 2 — COORDINATE SYSTEM (CRITICAL — read carefully):\n`;
  prompt += `- All coordinates are NORMALIZED 0.0 to 1.0. (0,0) = top-left corner, (1,1) = bottom-right corner.\n`;
  prompt += `- x increases going RIGHT. y increases going DOWN.\n`;
  prompt += `- Typical y-values for a runner occupying most of the frame:\n`;
  prompt += `  • Head/top: y ≈ 0.02-0.10\n`;
  prompt += `  • Shoulders: y ≈ 0.15-0.28\n`;
  prompt += `  • Greater trochanter (hip): y ≈ 0.40-0.55\n`;
  prompt += `  • Knee: y ≈ 0.58-0.72\n`;
  prompt += `  • Ankle/malleolus: y ≈ 0.80-0.92\n`;
  prompt += `  • Foot/heel on ground: y ≈ 0.88-0.97\n`;
  prompt += `- ABSOLUTE RULE: y-coordinates MUST follow anatomical order from top to bottom: shoulder < hip < knee < ankle < heel.\n`;
  prompt += `- For "vertical reference" points: use the SAME x-coordinate as the landmark, but y = 0.02 (near top of image).\n`;
  prompt += `- For "horizontal reference" points: use the SAME y-coordinate as the landmark, but shift x by +0.15 to the right.\n`;

  prompt += `\nSTEP 3 — CREATE THESE SPECIFIC ANNOTATIONS:\n`;
  prompt += `For each metric below, the description tells you EXACTLY which 3 points to place and what the vertex is.\n\n`;

  const colors = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];

  metrics.forEach((m, i) => {
    prompt += `${i + 1}. **${m.metricName}**\n`;
    prompt += `   ${m.description}\n`;
    prompt += `   Type: ${m.measureType}\n`;
    prompt += `   Color: ${colors[i % colors.length]}\n\n`;
  });

  prompt += `\nCRITICAL RULES:\n`;
  prompt += `- For ANGLE annotations: provide EXACTLY 3 points as [arm1_end, vertex, arm2_end]. The VERTEX (middle point) is the joint being measured.\n`;
  prompt += `- For LINE annotations: provide EXACTLY 2 points [start, end].\n`;
  prompt += `- The angle is measured AT the vertex between the two arms.\n`;
  prompt += `- SANITY CHECK every point before returning:\n`;
  prompt += `  1. Is the hip y-value between 0.40-0.55? If not, re-examine.\n`;
  prompt += `  2. Is the knee y-value between 0.58-0.72? If not, re-examine.\n`;
  prompt += `  3. Is the ankle y-value between 0.80-0.92? If not, re-examine.\n`;
  prompt += `  4. Does shoulder.y < hip.y < knee.y < ankle.y? If not, FIX IT.\n`;
  prompt += `  5. For vertical reference points, is the x the same as the landmark and y near 0.02? If not, fix it.\n`;
  prompt += `  6. For horizontal reference points, is the y the same as the landmark? If not, fix it.\n`;
  prompt += `- If the runner is in motion, joints may shift from typical positions — that's fine, but anatomical ORDER must be preserved.\n`;
  prompt += `- Be PRECISE. Place points on the actual anatomical landmark, not approximately near it.\n`;

  return prompt;
}

function getDefaultMetrics() {
  // 12-Metric Running Video Assessment — Simplified AI-Ready Format
  // Rating scale: Low / Optimal / High with load shift for both directions
  return [
    // M01: Overstride Angle — Side, IC
    { metricId: "M01", metricName: "Overstride Angle", metricCategory: "Side View", view: "Side", phase: "IC", unit: "category", whatToMeasure: "Visual category (paired with cadence)", linesToDraw: "Vertical GT + GT→Heel (visual reference)", description: "Overstride assessment based on visual category selection paired with cadence. Not degree-based — pick Understride / Optimal / Mild Overstride / Overstride from the assessment editor.", lowMin: null, lowMax: null, lowFinding: "Understride — foot lands behind or under centre of mass", optimalMin: null, optimalMax: null, highMin: null, highMax: null, highFinding: "Overstride — foot lands well ahead of centre of mass with excess braking", lowLoadShift: "↑ Hip flexor demand", highLoadShift: "↑ PF joint & anterior knee", isHigherBetter: false, isActive: true, sortOrder: 1 },
    // M02: Tibial Inclination — Side, IC
    { metricId: "M02", metricName: "Tibial Inclination", metricCategory: "Side View", view: "Side", phase: "IC", unit: "degrees", whatToMeasure: "Tibial forward angle (°)", linesToDraw: "Vertical + Malleolus→Tib tub", description: "Forward tibial angle relative to vertical at initial contact. Large angle indicates overstride.", lowMin: -10, lowMax: 4, lowFinding: "<5° Too vertical", optimalMin: 5, optimalMax: 10, highMin: 11, highMax: 90, highFinding: ">10° Excess forward / overstride indicator", lowLoadShift: "↑ Calf/Achilles", highLoadShift: "↑ Anterior knee", isHigherBetter: false, isActive: true, sortOrder: 2 },
    // M03: Peak Knee Flexion (Stance) — Side, Loading
    { metricId: "M03", metricName: "Peak Knee Flexion (Stance)", metricCategory: "Side View", view: "Side", phase: "Loading", unit: "degrees", whatToMeasure: "Peak knee flexion angle (°)", linesToDraw: "GT→Knee + Knee→Malleolus", description: "Peak knee flexion angle during stance phase. Shock absorption deficit if too low, excess if too high.", lowMin: 0, lowMax: 39, lowFinding: "<40° Shock absorption deficit", optimalMin: 40, optimalMax: 48, highMin: 49, highMax: 90, highFinding: ">48° Excess flexion", lowLoadShift: "↑ Bone & PF compression", highLoadShift: "↑ Quad & patellar tendon", isHigherBetter: true, isActive: true, sortOrder: 3 },
    // M04: Hip Extension — Side, Toe-Off
    { metricId: "M04", metricName: "Hip Extension", metricCategory: "Side View", view: "Side", phase: "Toe-Off", unit: "degrees", whatToMeasure: "Hip extension (°)", linesToDraw: "Vertical + GT→Knee", description: "Hip extension angle at late stance / toe-off. Reduced extension limits propulsion.", lowMin: 0, lowMax: 9, lowFinding: "<10° Reduced propulsion", optimalMin: 10, optimalMax: 20, highMin: 21, highMax: 90, highFinding: ">20° Excess extension", lowLoadShift: "↑ Achilles/soleus", highLoadShift: "↑ Lumbar extension", isHigherBetter: true, isActive: true, sortOrder: 4 },
    // M05: Trunk Forward Lean — Side, Loading
    { metricId: "M05", metricName: "Trunk Forward Lean", metricCategory: "Side View", view: "Side", phase: "Loading", unit: "degrees", whatToMeasure: "Trunk angle (°)", linesToDraw: "Vertical + Acromion→GT", description: "Forward trunk lean angle relative to vertical. Affects load redistribution between hip and knee.", lowMin: 0, lowMax: 4, lowFinding: "<5° Too upright", optimalMin: 5, optimalMax: 10, highMin: 11, highMax: 90, highFinding: ">10° Excess lean", lowLoadShift: "↑ Knee extensor load", highLoadShift: "↑ Glute & lumbar load", isHigherBetter: false, isActive: true, sortOrder: 5 },
    // M06: Pelvic Drop — Back, Loading
    { metricId: "M06", metricName: "Pelvic Drop", metricCategory: "Back View", view: "Back", phase: "Loading", unit: "degrees", whatToMeasure: "Pelvic tilt (°)", linesToDraw: "ASIS→ASIS + Horizontal", description: "Pelvic tilt angle during mid-stance. Reflects hip abductor control.", lowMin: -10, lowMax: 3, lowFinding: "<4° Hip hike", optimalMin: 4, optimalMax: 7, highMin: 8, highMax: 90, highFinding: ">7° Excessive drop", lowLoadShift: "↑ Lumbar asymmetry", highLoadShift: "↑ Medial knee & adductor", isHigherBetter: false, isActive: true, sortOrder: 6 },
    // M07: Step Width — Back, IC
    { metricId: "M07", metricName: "Step Width", metricCategory: "Back View", view: "Back", phase: "IC", unit: "degrees", whatToMeasure: "Foot placement (°)", linesToDraw: "Sacral vertical + Sacrum→Heel", description: "Foot placement angle from sacral vertical midline at initial contact.", lowMin: -90, lowMax: -1, lowFinding: "Negative Crossover", optimalMin: 5, optimalMax: 8, highMin: 13, highMax: 90, highFinding: ">12° Too wide", lowLoadShift: "↑ Medial knee", highLoadShift: "↑ ITB & lateral knee", isHigherBetter: true, isActive: true, sortOrder: 7 },
    // M08: Knee Frontal Plane Angle — Back, Loading
    { metricId: "M08", metricName: "Knee Frontal Plane Angle", metricCategory: "Back View", view: "Back", phase: "Loading", unit: "degrees", whatToMeasure: "Valgus/Varus (°)", linesToDraw: "ASIS→Patella + Patella→Ankle", description: "Frontal plane knee valgus angle during mid-stance. Excessive valgus increases PFJ and ITB risk.", lowMin: -90, lowMax: 4, lowFinding: "<5° Varus", optimalMin: 5, optimalMax: 10, highMin: 11, highMax: 90, highFinding: ">10° Excessive valgus / PFJ & ITB risk", lowLoadShift: "↑ Lateral compartment", highLoadShift: "↑ Medial PF & MCL", isHigherBetter: false, isActive: true, sortOrder: 8 },
    // M09: Rearfoot Eversion — Back, Loading
    { metricId: "M09", metricName: "Rearfoot Eversion", metricCategory: "Back View", view: "Back", phase: "Loading", unit: "degrees", whatToMeasure: "Rearfoot eversion angle (°)", linesToDraw: "Tibial axis + Calcaneus", description: "Rearfoot eversion angle during mid-stance. Excess eversion indicates overpronation.", lowMin: -90, lowMax: 7, lowFinding: "<8° Insufficient eversion / supination", optimalMin: 8, optimalMax: 14, highMin: 15, highMax: 90, highFinding: ">14° Excess pronation", lowLoadShift: "↑ Lateral ankle/peroneals", highLoadShift: "↑ Posterior tibial & medial knee", isHigherBetter: false, isActive: true, sortOrder: 9 },
    // M10: Push-Off Alignment — Back, Toe-Off (category-based) [was M12, renumbered after M10/M11 removal]
    { metricId: "M10", metricName: "Push-Off Alignment", metricCategory: "Back View", view: "Back", phase: "Toe-Off", unit: "category", whatToMeasure: "Visual category (frontal push-off alignment)", linesToDraw: "Tibial axis + Heel→2nd MT (visual reference)", description: "Frontal plane foot alignment at push-off. Category-based — pick Lateral Push Off / Balanced / Medial Push Off from the assessment editor.", lowMin: null, lowMax: null, lowFinding: "Lateral push-off — foot rolls outward at toe-off", optimalMin: null, optimalMax: null, highMin: null, highMax: null, highFinding: "Medial push-off — foot rolls inward at toe-off", lowLoadShift: "↑ Lateral ankle/peroneals", highLoadShift: "↑ Posterior tibial/Achilles", isHigherBetter: false, isActive: true, sortOrder: 10 },
  ];
}

export type AppRouter = typeof appRouter;
