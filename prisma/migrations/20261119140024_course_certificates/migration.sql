-- CreateTable
CREATE TABLE "education_lesson_visits" (
    "userId" TEXT NOT NULL,
    "academy" TEXT NOT NULL,
    "lesson" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "education_lesson_visits_pkey" PRIMARY KEY ("userId","academy","lesson")
);

-- CreateTable
CREATE TABLE "education_quiz_passes" (
    "userId" TEXT NOT NULL,
    "academy" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "passedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "education_quiz_passes_pkey" PRIMARY KEY ("userId","academy","quizId")
);

-- CreateTable
CREATE TABLE "education_quiz_attempts" (
    "userId" TEXT NOT NULL,
    "academy" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "tries" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "education_quiz_attempts_pkey" PRIMARY KEY ("userId","academy","quizId")
);

-- CreateTable
CREATE TABLE "education_certificates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "academy" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "education_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "education_lesson_visits_userId_visitedAt_idx" ON "education_lesson_visits"("userId", "visitedAt");

-- CreateIndex
CREATE UNIQUE INDEX "education_certificates_userId_academy_course_key" ON "education_certificates"("userId", "academy", "course");

-- AddForeignKey
ALTER TABLE "education_lesson_visits" ADD CONSTRAINT "education_lesson_visits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_quiz_passes" ADD CONSTRAINT "education_quiz_passes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_quiz_attempts" ADD CONSTRAINT "education_quiz_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_certificates" ADD CONSTRAINT "education_certificates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
