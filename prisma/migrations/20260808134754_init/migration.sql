-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'TENANT',
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BlacklistEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "landlordName" TEXT NOT NULL,
    "landlordNameFull" TEXT,
    "addressDistrict" TEXT NOT NULL,
    "addressDetail" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceUrls" TEXT NOT NULL DEFAULT '[]',
    "submitterId" TEXT NOT NULL,
    "landlordResponse" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "severity" INTEGER NOT NULL DEFAULT 3,
    "reportCount" INTEGER NOT NULL DEFAULT 1,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastIncidentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BlacklistEntry_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "propertyAddress" TEXT NOT NULL,
    "items" TEXT NOT NULL DEFAULT '[]',
    "reportUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Inspection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeaseContract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "landlordName" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "monthlyRent" INTEGER NOT NULL,
    "deposit" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "customClauses" TEXT,
    "pdfUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaseContract_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "BlacklistEntry_landlordName_addressDistrict_idx" ON "BlacklistEntry"("landlordName", "addressDistrict");

-- CreateIndex
CREATE INDEX "BlacklistEntry_addressDistrict_idx" ON "BlacklistEntry"("addressDistrict");

-- CreateIndex
CREATE INDEX "BlacklistEntry_status_idx" ON "BlacklistEntry"("status");

-- CreateIndex
CREATE INDEX "BlacklistEntry_lastIncidentAt_idx" ON "BlacklistEntry"("lastIncidentAt");

-- CreateIndex
CREATE INDEX "BlacklistEntry_severity_idx" ON "BlacklistEntry"("severity");

-- CreateIndex
CREATE INDEX "Inspection_userId_idx" ON "Inspection"("userId");

-- CreateIndex
CREATE INDEX "LeaseContract_userId_idx" ON "LeaseContract"("userId");
