import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  patients, InsertPatient,
  assessments, InsertAssessment,
  screenshots, InsertScreenshot,
  annotations, InsertAnnotation,
  metricsStandards, InsertMetricsStandard,
  videos, InsertVideo,
  dynamoTests, InsertDynamoTest,
  practitioners, InsertPractitioner,
  abilityGroups, InsertAbilityGroup,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ===== PATIENTS =====
export async function getPatients(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(patients).where(eq(patients.userId, userId)).orderBy(desc(patients.updatedAt));
}

export async function getPatient(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(patients).where(and(eq(patients.id, id), eq(patients.userId, userId))).limit(1);
  return result[0];
}

export async function createPatient(data: InsertPatient) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(patients).values(data);
  return result[0].insertId;
}

export async function updatePatient(id: number, userId: number, data: Partial<InsertPatient>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(patients).set(data).where(and(eq(patients.id, id), eq(patients.userId, userId)));
}

export async function deletePatient(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(patients).where(and(eq(patients.id, id), eq(patients.userId, userId)));
}

// ===== ASSESSMENTS =====
export async function getAssessments(patientId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(assessments).where(and(eq(assessments.patientId, patientId), eq(assessments.userId, userId))).orderBy(desc(assessments.updatedAt));
}

export async function getAssessment(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(assessments).where(and(eq(assessments.id, id), eq(assessments.userId, userId))).limit(1);
  return result[0];
}

export async function createAssessment(data: InsertAssessment) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(assessments).values(data);
  return result[0].insertId;
}

export async function updateAssessment(id: number, userId: number, data: Partial<InsertAssessment>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(assessments).set(data).where(and(eq(assessments.id, id), eq(assessments.userId, userId)));
}

export async function deleteAssessment(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(assessments).where(and(eq(assessments.id, id), eq(assessments.userId, userId)));
}

// ===== SCREENSHOTS =====
export async function getScreenshots(assessmentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(screenshots).where(eq(screenshots.assessmentId, assessmentId)).orderBy(screenshots.sortOrder);
}

export async function createScreenshot(data: InsertScreenshot) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(screenshots).values(data);
  const insertId = result[0].insertId;
  // Return the full record so the client can use it for auto-analysis
  const rows = await db.select().from(screenshots).where(eq(screenshots.id, insertId)).limit(1);
  return rows[0] || { id: insertId, ...data };
}

export async function updateScreenshot(id: number, data: Partial<InsertScreenshot>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(screenshots).set(data).where(eq(screenshots.id, id));
}

export async function deleteScreenshot(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Also delete related annotations
  await db.delete(annotations).where(eq(annotations.screenshotId, id));
  await db.delete(screenshots).where(eq(screenshots.id, id));
}

// ===== ANNOTATIONS =====
export async function getAnnotations(screenshotId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(annotations).where(eq(annotations.screenshotId, screenshotId));
}

export async function createAnnotation(data: InsertAnnotation) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(annotations).values(data);
  return result[0].insertId;
}

export async function updateAnnotation(id: number, data: Partial<InsertAnnotation>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(annotations).set(data).where(eq(annotations.id, id));
}

export async function deleteAnnotation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(annotations).where(eq(annotations.id, id));
}

// ===== METRICS STANDARDS =====
export async function getMetricsStandards(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(metricsStandards).where(eq(metricsStandards.userId, userId)).orderBy(metricsStandards.sortOrder);
}

export async function createMetricsStandard(data: InsertMetricsStandard) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(metricsStandards).values(data);
  return result[0].insertId;
}

export async function updateMetricsStandard(id: number, userId: number, data: Partial<InsertMetricsStandard>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(metricsStandards).set(data).where(and(eq(metricsStandards.id, id), eq(metricsStandards.userId, userId)));
}

export async function deleteMetricsStandard(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(metricsStandards).where(and(eq(metricsStandards.id, id), eq(metricsStandards.userId, userId)));
}

// ===== VIDEOS =====
export async function getVideos(assessmentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(videos).where(eq(videos.assessmentId, assessmentId));
}

export async function createVideo(data: InsertVideo) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(videos).values(data);
  return result[0].insertId;
}

export async function deleteVideo(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(videos).where(eq(videos.id, id));
}

// Dynamo Tests
export async function getDynamoTests(assessmentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dynamoTests).where(eq(dynamoTests.assessmentId, assessmentId)).orderBy(dynamoTests.sortOrder, dynamoTests.id);
}

export async function createDynamoTest(data: Omit<InsertDynamoTest, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Auto-calculate asymmetry percentage
  let asymmetryPercent: number | null = null;
  if (data.leftValue != null && data.rightValue != null && data.leftValue > 0 && data.rightValue > 0) {
    const max = Math.max(data.leftValue, data.rightValue);
    const min = Math.min(data.leftValue, data.rightValue);
    asymmetryPercent = Math.round(((max - min) / max) * 100 * 10) / 10;
  }
  const result = await db.insert(dynamoTests).values({ ...data, asymmetryPercent });
  const insertId = result[0].insertId;
  const rows = await db.select().from(dynamoTests).where(eq(dynamoTests.id, insertId)).limit(1);
  return rows[0];
}

export async function updateDynamoTest(id: number, data: Partial<InsertDynamoTest>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Recalculate asymmetry if values changed
  if (data.leftValue !== undefined || data.rightValue !== undefined) {
    const existing = await db.select().from(dynamoTests).where(eq(dynamoTests.id, id)).limit(1);
    if (existing.length > 0) {
      const left = data.leftValue ?? existing[0].leftValue;
      const right = data.rightValue ?? existing[0].rightValue;
      if (left != null && right != null && left > 0 && right > 0) {
        const max = Math.max(left, right);
        const min = Math.min(left, right);
        data.asymmetryPercent = Math.round(((max - min) / max) * 100 * 10) / 10;
      } else {
        data.asymmetryPercent = null;
      }
    }
  }
  await db.update(dynamoTests).set(data).where(eq(dynamoTests.id, id));
}

export async function deleteDynamoTest(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(dynamoTests).where(eq(dynamoTests.id, id));
}

// ===== PRACTITIONERS =====
export async function getPractitioners(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(practitioners).where(eq(practitioners.userId, userId)).orderBy(desc(practitioners.updatedAt));
}

export async function getPractitioner(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(practitioners).where(and(eq(practitioners.id, id), eq(practitioners.userId, userId))).limit(1);
  return result[0];
}

export async function getDefaultPractitioner(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  // Try default first, then fall back to first practitioner
  let result = await db.select().from(practitioners).where(and(eq(practitioners.userId, userId), eq(practitioners.isDefault, true))).limit(1);
  if (result.length === 0) {
    result = await db.select().from(practitioners).where(eq(practitioners.userId, userId)).orderBy(practitioners.id).limit(1);
  }
  return result[0];
}

export async function createPractitioner(data: InsertPractitioner) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(practitioners).values(data);
  const insertId = result[0].insertId;
  const rows = await db.select().from(practitioners).where(eq(practitioners.id, insertId)).limit(1);
  return rows[0];
}

export async function updatePractitioner(id: number, userId: number, data: Partial<InsertPractitioner>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(practitioners).set(data).where(and(eq(practitioners.id, id), eq(practitioners.userId, userId)));
}

export async function deletePractitioner(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(practitioners).where(and(eq(practitioners.id, id), eq(practitioners.userId, userId)));
}

export async function setDefaultPractitioner(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Clear all defaults for this user
  await db.update(practitioners).set({ isDefault: false }).where(eq(practitioners.userId, userId));
  // Set the new default
  await db.update(practitioners).set({ isDefault: true }).where(and(eq(practitioners.id, id), eq(practitioners.userId, userId)));
}

// ===== ABILITY GROUPS =====
export async function getAbilityGroups(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(abilityGroups).where(eq(abilityGroups.userId, userId)).orderBy(abilityGroups.sortOrder);
}

export async function createAbilityGroup(data: InsertAbilityGroup) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(abilityGroups).values(data);
  const insertId = result[0].insertId;
  const rows = await db.select().from(abilityGroups).where(eq(abilityGroups.id, insertId)).limit(1);
  return rows[0];
}

export async function updateAbilityGroup(id: number, userId: number, data: Partial<InsertAbilityGroup>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(abilityGroups).set(data).where(and(eq(abilityGroups.id, id), eq(abilityGroups.userId, userId)));
}

export async function deleteAbilityGroup(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(abilityGroups).where(and(eq(abilityGroups.id, id), eq(abilityGroups.userId, userId)));
}

export async function resetAbilityGroups(userId: number, groups: InsertAbilityGroup[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Delete all existing groups for this user
  await db.delete(abilityGroups).where(eq(abilityGroups.userId, userId));
  // Insert new groups
  if (groups.length > 0) {
    await db.insert(abilityGroups).values(groups);
  }
  return getAbilityGroups(userId);
}
