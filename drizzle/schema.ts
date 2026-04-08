import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, float, boolean } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Patients / Runners
export const patients = mysqlTable("patients", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // physio who created this patient
  name: varchar("name", { length: 255 }).notNull(),
  dateOfBirth: varchar("dateOfBirth", { length: 20 }),
  gender: varchar("gender", { length: 20 }),
  height: float("height"), // cm
  weight: float("weight"), // kg
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Patient = typeof patients.$inferSelect;
export type InsertPatient = typeof patients.$inferInsert;

// Assessments - one per session
export const assessments = mysqlTable("assessments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  patientId: int("patientId").notNull(),
  assessmentDate: varchar("assessmentDate", { length: 20 }).notNull(),
  status: mysqlEnum("status", ["draft", "in_progress", "completed"]).default("draft").notNull(),

  // Subjective Assessment
  trainingFrequency: varchar("trainingFrequency", { length: 255 }),
  weeklyMileage: varchar("weeklyMileage", { length: 255 }),
  runningGoals: text("runningGoals"),
  runningExperience: text("runningExperience"),
  currentPace: varchar("currentPace", { length: 100 }),
  preferredTerrain: varchar("preferredTerrain", { length: 255 }),
  shoeType: varchar("shoeType", { length: 255 }),
  injuries: json("injuries"), // Array of { description, date, status }
  concerns: text("concerns"),
  backgroundNotes: text("backgroundNotes"),

  // InBody Results - uploaded PDF from equipment
  inbodyFileUrl: text("inbodyFileUrl"), // S3 URL of uploaded InBody PDF
  inbodyFileName: varchar("inbodyFileName", { length: 500 }),
  inbodyNotes: text("inbodyNotes"),

  // VO2 Master Results - uploaded PDF from equipment
  vo2FileUrl: text("vo2FileUrl"), // S3 URL of uploaded VO2 Master PDF
  vo2FileName: varchar("vo2FileName", { length: 500 }),
  vo2Notes: text("vo2Notes"),

  // Running Metrics
  cadence: int("cadence"), // steps per minute
  overstrideCategory: varchar("overstrideCategory", { length: 50 }), // understride, optimal, mild_overstride, overstride
  pushOffCategory: varchar("pushOffCategory", { length: 50 }), // lateral_push_off, balanced, medial_push_off

  // Clinical Notes
  clinicalImpression: text("clinicalImpression"),
  thingsToImprove: text("thingsToImprove"),
  managementPlan: text("managementPlan"),
  runningCues: text("runningCues"),
  mobilityExercises: text("mobilityExercises"),
  strengthExercises: text("strengthExercises"),
  runningProgramming: text("runningProgramming"),

  // Assessment Conditions
  assessmentSpeed: varchar("assessmentSpeed", { length: 100 }), // e.g. "10 km/h"
  assessmentIncline: varchar("assessmentIncline", { length: 100 }), // e.g. "0%"
  assessmentFootwear: varchar("assessmentFootwear", { length: 255 }), // e.g. "Nike Pegasus 41"
  assessmentRecording: text("assessmentRecording"), // e.g. "Treadmill, 2D video side and back"

  // Follow-up reassessment
  followUpMonths: int("followUpMonths"), // number of months after assessment date for reassessment

  // Practitioner who conducted the assessment
  practitionerId: int("practitionerId"),

  // AI Generated Report
  aiGeneratedReport: text("aiGeneratedReport"),
  reportJson: json("reportJson"), // Structured report data for PDF

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Assessment = typeof assessments.$inferSelect;
export type InsertAssessment = typeof assessments.$inferInsert;

// Screenshots from video analysis
export const screenshots = mysqlTable("screenshots", {
  id: int("id").autoincrement().primaryKey(),
  assessmentId: int("assessmentId").notNull(),
  viewType: mysqlEnum("viewType", ["side_left", "side_right", "back"]).notNull(),
  gaitPhase: mysqlEnum("gaitPhase", ["foot_strike", "loading", "mid_stance", "push_off", "swing", "other"]).notNull(),
  imageUrl: text("imageUrl").notNull(), // S3 URL
  thumbnailUrl: text("thumbnailUrl"),
  timestamp: float("timestamp"), // video timestamp in seconds
  description: text("description"),
  legSide: varchar("legSide", { length: 10 }), // 'left' or 'right' — which leg is being analyzed (for back view)
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Screenshot = typeof screenshots.$inferSelect;
export type InsertScreenshot = typeof screenshots.$inferInsert;

// Annotations (lines, circles, angles) on screenshots
export const annotations = mysqlTable("annotations", {
  id: int("id").autoincrement().primaryKey(),
  screenshotId: int("screenshotId").notNull(),
  annotationType: mysqlEnum("annotationType", ["line", "angle", "circle", "text"]).notNull(),
  data: json("data").notNull(), // { points, color, width, angle, label, etc. }
  color: varchar("color", { length: 20 }).default("#ff0000"),
  label: varchar("label", { length: 255 }),
  metricName: varchar("metricName", { length: 100 }), // links to metricsStandards.metricName
  measuredValue: float("measuredValue"), // e.g. angle in degrees
  useOuterAngle: boolean("useOuterAngle").default(false), // whether to use outer (360-inner) angle
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Annotation = typeof annotations.$inferSelect;
export type InsertAnnotation = typeof annotations.$inferInsert;

// Configurable metrics standards — 12-Metric Running Video Assessment
export const metricsStandards = mysqlTable("metricsStandards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // physio who owns these standards
  metricId: varchar("metricId", { length: 10 }), // e.g. M01, M02, ...
  metricName: varchar("metricName", { length: 100 }).notNull(),
  metricCategory: varchar("metricCategory", { length: 100 }).notNull(),
  view: varchar("view", { length: 20 }), // Side or Back
  phase: varchar("phase", { length: 50 }), // IC, Loading, Toe-Off, Mid-Stance, Mid-Swing
  unit: varchar("unit", { length: 50 }),
  description: text("description"),
  whatToMeasure: text("whatToMeasure"), // e.g. "Forward angle (°)"
  linesToDraw: text("linesToDraw"), // e.g. "Vertical GT + GT→Heel"
  // Low / Optimal / High rating scale
  lowMin: float("lowMin"),
  lowMax: float("lowMax"),
  lowFinding: text("lowFinding"), // e.g. "<5° Understride"
  optimalMin: float("optimalMin"),
  optimalMax: float("optimalMax"),
  highMin: float("highMin"),
  highMax: float("highMax"),
  highFinding: text("highFinding"), // e.g. ">15° Excess braking"
  // Load shift descriptions
  lowLoadShift: text("lowLoadShift"), // e.g. "↑ Hip flexor demand"
  highLoadShift: text("highLoadShift"), // e.g. "↑ PF joint & anterior knee"
  // Legacy fields kept for migration compatibility
  needsImprovementMin: float("needsImprovementMin"),
  needsImprovementMax: float("needsImprovementMax"),
  acceptableMin: float("acceptableMin"),
  acceptableMax: float("acceptableMax"),
  excellentMin: float("excellentMin"),
  excellentMax: float("excellentMax"),
  isHigherBetter: boolean("isHigherBetter").default(true),
  isActive: boolean("isActive").default(true),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MetricsStandard = typeof metricsStandards.$inferSelect;
export type InsertMetricsStandard = typeof metricsStandards.$inferInsert;

// VALD Dynamo handheld dynamometer test results
export const dynamoTests = mysqlTable("dynamoTests", {
  id: int("id").autoincrement().primaryKey(),
  assessmentId: int("assessmentId").notNull(),
  joint: varchar("joint", { length: 100 }).notNull(), // e.g. Hip, Knee, Ankle, Shoulder
  movement: varchar("movement", { length: 100 }).notNull(), // e.g. Flexion, Extension, Abduction
  position: varchar("position", { length: 100 }), // e.g. Supine, Prone, Side-lying, Seated
  leftValue: float("leftValue"), // force in Newtons or kg
  rightValue: float("rightValue"),
  unit: varchar("unit", { length: 20 }).default("kg").notNull(), // kg, N, lbs
  // Peak Force
  leftPeakForce: float("leftPeakForce"),
  rightPeakForce: float("rightPeakForce"),
  peakForceUnit: varchar("peakForceUnit", { length: 20 }).default("N"), // N, kg, lbs
  // Peak RFD (Rate of Force Development)
  leftPeakRfd: float("leftPeakRfd"),
  rightPeakRfd: float("rightPeakRfd"),
  peakRfdUnit: varchar("peakRfdUnit", { length: 20 }).default("N/s"), // N/s
  // Time to Peak Force
  leftTimeToPeak: float("leftTimeToPeak"), // in milliseconds
  rightTimeToPeak: float("rightTimeToPeak"),
  leftReps: int("leftReps"), // number of reps tested
  rightReps: int("rightReps"),
  asymmetryPercent: float("asymmetryPercent"), // auto-calculated L/R difference %
  notes: text("notes"),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DynamoTest = typeof dynamoTests.$inferSelect;
export type InsertDynamoTest = typeof dynamoTests.$inferInsert;

// Practitioner profiles
export const practitioners = mysqlTable("practitioners", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // which logged-in user owns this profile
  name: varchar("name", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }), // e.g. "Physiotherapist", "Sports Scientist"
  qualifications: varchar("qualifications", { length: 500 }), // e.g. "BSc, MSc, FACP"
  clinic: varchar("clinic", { length: 255 }), // e.g. "Total Health - Hong Kong Sports Clinic"
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 320 }),
  website: varchar("website", { length: 500 }),
  address: text("address"),
  isDefault: boolean("isDefault").default(false), // default practitioner for this user
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Practitioner = typeof practitioners.$inferSelect;
export type InsertPractitioner = typeof practitioners.$inferInsert;

// Ability Groups - configurable radar chart categories
export const abilityGroups = mysqlTable("abilityGroups", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // physio who owns these groups
  groupId: varchar("groupId", { length: 50 }).notNull(), // e.g. "shock_absorption"
  label: varchar("label", { length: 100 }).notNull(), // e.g. "Shock Absorption"
  color: varchar("color", { length: 20 }).notNull(), // hex color for the chart
  metricIds: json("metricIds").notNull(), // array of metric IDs e.g. ["M02", "M03"]
  metricWeights: json("metricWeights"), // object mapping metricId to weight e.g. {"M02": 1.0, "M03": 1.5}
  sortOrder: int("sortOrder").default(0),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AbilityGroup = typeof abilityGroups.$inferSelect;
export type InsertAbilityGroup = typeof abilityGroups.$inferInsert;

// Video uploads
export const videos = mysqlTable("videos", {
  id: int("id").autoincrement().primaryKey(),
  assessmentId: int("assessmentId").notNull(),
  viewType: mysqlEnum("viewType", ["side_left", "side_right", "back"]).notNull(),
  videoUrl: text("videoUrl").notNull(),
  fileName: varchar("fileName", { length: 500 }),
  durationSeconds: float("durationSeconds"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Video = typeof videos.$inferSelect;
export type InsertVideo = typeof videos.$inferInsert;
