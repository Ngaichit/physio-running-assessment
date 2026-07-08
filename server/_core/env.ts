export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
  adminEmail: process.env.ADMIN_EMAIL ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  inviteCode: process.env.INVITE_CODE ?? "",
  // AWS S3
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  awsRegion: process.env.AWS_REGION ?? "us-east-1",
  awsBucket: process.env.AWS_BUCKET ?? "",
};

export function assertRequiredEnv(source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): void {
  const isProd = source.NODE_ENV === "production";
  if (isProd && !source.JWT_SECRET?.trim()) {
    throw new Error("JWT_SECRET is required in production but is empty. Set it in the Railway environment.");
  }
}
