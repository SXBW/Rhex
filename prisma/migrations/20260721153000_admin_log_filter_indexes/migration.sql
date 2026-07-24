CREATE INDEX IF NOT EXISTS "AdminLog_action_createdAt_idx"
  ON "AdminLog"("action", "createdAt");

CREATE INDEX IF NOT EXISTS "UserCheckInLog_isMakeUp_createdAt_idx"
  ON "UserCheckInLog"("isMakeUp", "createdAt");

CREATE INDEX IF NOT EXISTS "PointLog_changeType_createdAt_idx"
  ON "PointLog"("changeType", "createdAt");

CREATE INDEX IF NOT EXISTS "Upload_bucketType_createdAt_idx"
  ON "Upload"("bucketType", "createdAt");
