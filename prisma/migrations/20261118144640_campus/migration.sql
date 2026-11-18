-- CreateTable
CREATE TABLE "campus_profiles" (
    "userId" TEXT NOT NULL,
    "trackInterests" TEXT[],
    "campusCoordinatorInterest" BOOLEAN NOT NULL DEFAULT false,
    "adultConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campus_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "university_memberships" (
    "userId" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fieldOfStudy" TEXT,
    "graduationYear" INTEGER,
    "clubId" TEXT,
    "clubPosition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "university_memberships_pkey" PRIMARY KEY ("userId","universityId")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "normalizedAliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "country" TEXT,
    "parentId" TEXT,
    "rorId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "university_catalog" (
    "rorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "aliases" TEXT[],
    "searchText" TEXT NOT NULL,
    "worksCount" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "university_catalog_pkey" PRIMARY KEY ("rorId")
);

-- CreateIndex
CREATE INDEX "university_memberships_universityId_idx" ON "university_memberships"("universityId");

-- CreateIndex
CREATE INDEX "university_memberships_clubId_idx" ON "university_memberships"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_rorId_key" ON "organizations"("rorId");

-- CreateIndex
CREATE INDEX "organizations_type_normalizedName_idx" ON "organizations"("type", "normalizedName");

-- CreateIndex
CREATE INDEX "organizations_normalizedAliases_idx" ON "organizations" USING GIN ("normalizedAliases");

-- CreateIndex
CREATE INDEX "organizations_createdById_createdAt_idx" ON "organizations"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "campus_profiles" ADD CONSTRAINT "campus_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_memberships" ADD CONSTRAINT "university_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_memberships" ADD CONSTRAINT "university_memberships_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_memberships" ADD CONSTRAINT "university_memberships_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
