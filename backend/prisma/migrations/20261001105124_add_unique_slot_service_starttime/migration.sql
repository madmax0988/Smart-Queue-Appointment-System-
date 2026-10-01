-- DropIndex
DROP INDEX "AppointmentSlot_serviceId_startTime_idx";

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentSlot_serviceId_startTime_key" ON "AppointmentSlot"("serviceId", "startTime");
