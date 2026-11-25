-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'AGENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "AgentAvailability" AS ENUM ('AVAILABLE', 'BUSY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "ComplaintCategory" AS ENUM ('PAYMENT', 'LOGIN', 'REFUND', 'DELIVERY', 'TECHNICAL', 'ACCOUNT', 'NETWORK', 'SUBSCRIPTION', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('URGENT', 'HIGH', 'NORMAL');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('SELF_SERVICE', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('AUTOMATIC', 'MANUAL', 'REASSIGNMENT');

-- CreateEnum
CREATE TYPE "CustomerSolutionResponse" AS ENUM ('SOLVED', 'NOT_SOLVED', 'PENDING');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "SlaState" AS ENUM ('ON_TRACK', 'WARNING', 'BREACHED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SlaStatus" AS ENUM ('ON_TRACK', 'WARNING', 'BREACHED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EscalationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TICKET_CREATED', 'AI_SOLUTION', 'CUSTOMER_REJECTED_SOLUTION', 'TICKET_ASSIGNED', 'NEW_MESSAGE', 'SLA_WARNING', 'SLA_BREACH', 'ESCALATION', 'TICKET_RESOLVED', 'FEEDBACK', 'ADMIN_ACTION');

-- CreateEnum
CREATE TYPE "EscalationType" AS ENUM ('WARNING', 'BREACH', 'MANUAL');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "phone_number" VARCHAR(30),
    "role" "Role" NOT NULL,
    "account_status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "application_name" VARCHAR(80) NOT NULL,
    "application_category" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "skills" "ComplaintCategory"[],
    "availability_status" "AgentAvailability" NOT NULL DEFAULT 'AVAILABLE',
    "maximum_workload" INTEGER NOT NULL DEFAULT 10,
    "team" TEXT NOT NULL DEFAULT 'Customer Support',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "ticket_number" VARCHAR(24) NOT NULL,
    "application_id" UUID NOT NULL,
    "subject" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ComplaintCategory" NOT NULL,
    "priority" "TicketPriority" NOT NULL,
    "priority_confidence" DOUBLE PRECISION NOT NULL,
    "priority_reason" VARCHAR(500) NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'SELF_SERVICE',
    "customer_id" UUID NOT NULL,
    "assigned_agent_id" UUID,
    "self_service_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolution_method" VARCHAR(100),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_assignments" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "assigned_by" UUID,
    "assignment_type" "AssignmentType" NOT NULL DEFAULT 'MANUAL',
    "assignment_reason" VARCHAR(300) NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassigned_at" TIMESTAMP(3),

    CONSTRAINT "ticket_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" UUID NOT NULL,
    "priority" "TicketPriority" NOT NULL,
    "first_response_minutes" INTEGER NOT NULL,
    "resolution_minutes" INTEGER NOT NULL,
    "warning_threshold_minutes" INTEGER NOT NULL DEFAULT 15,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_records" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "sla_policy_id" UUID NOT NULL,
    "response_deadline" TIMESTAMP(3) NOT NULL,
    "resolution_deadline" TIMESTAMP(3) NOT NULL,
    "first_response_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "warning_at" TIMESTAMP(3),
    "breached_at" TIMESTAMP(3),
    "state" "SlaState" NOT NULL DEFAULT 'ON_TRACK',
    "response_sla_status" "SlaStatus" NOT NULL DEFAULT 'ON_TRACK',
    "resolution_sla_status" "SlaStatus" NOT NULL DEFAULT 'ON_TRACK',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_base" (
    "id" UUID NOT NULL,
    "application_id" UUID,
    "category" "ComplaintCategory" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "problem" VARCHAR(500) NOT NULL,
    "possible_cause" VARCHAR(500) NOT NULL,
    "troubleshooting_steps" TEXT[],
    "recommended_solution" TEXT NOT NULL,
    "keywords" TEXT[],
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_base_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analysis" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "analysis_reason" VARCHAR(1000) NOT NULL,
    "duplicate_detected" BOOLEAN NOT NULL DEFAULT false,
    "predicted_category" "ComplaintCategory" NOT NULL,
    "category_confidence" DOUBLE PRECISION NOT NULL,
    "predicted_priority" "TicketPriority" NOT NULL,
    "priority_confidence" DOUBLE PRECISION NOT NULL,
    "sentiment" "Sentiment" NOT NULL,
    "sentiment_score" DOUBLE PRECISION NOT NULL,
    "priority_reason" VARCHAR(500) NOT NULL,
    "similar_ticket_ids" TEXT[],
    "model_version" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_suggestions" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "knowledge_base_id" UUID,
    "relevance_score" DOUBLE PRECISION NOT NULL,
    "steps" TEXT[],
    "suggested_solution" TEXT NOT NULL,
    "customer_choice" BOOLEAN,
    "customer_response" "CustomerSolutionResponse" NOT NULL DEFAULT 'PENDING',
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "message_content" TEXT NOT NULL,
    "attachment_url" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_notes" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "note_content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "storage_name" VARCHAR(100) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canned_responses" (
    "id" UUID NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "body" VARCHAR(3000) NOT NULL,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canned_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "ticket_id" UUID,
    "notification_type" "NotificationType" NOT NULL,
    "title" VARCHAR(120) NOT NULL DEFAULT 'SmartSLA update',
    "message" VARCHAR(500) NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalations" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "actor_id" UUID,
    "notified_admin_id" UUID,
    "type" "EscalationType" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "reason" VARCHAR(500) NOT NULL,
    "recommended" VARCHAR(500),
    "action_taken" VARCHAR(500),
    "status" "EscalationStatus" NOT NULL DEFAULT 'OPEN',
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" VARCHAR(1500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_history" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "performed_by" UUID,
    "action_type" VARCHAR(60) NOT NULL DEFAULT 'EVENT',
    "action_event" VARCHAR(200) NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "details" JSONB,
    "description" VARCHAR(500),
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_account_status_idx" ON "users"("role", "account_status");

-- CreateIndex
CREATE UNIQUE INDEX "applications_application_name_key" ON "applications"("application_name");

-- CreateIndex
CREATE INDEX "applications_is_active_application_name_idx" ON "applications"("is_active", "application_name");

-- CreateIndex
CREATE UNIQUE INDEX "agent_profiles_user_id_key" ON "agent_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_number_key" ON "tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "tickets_customer_id_created_at_idx" ON "tickets"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "tickets_assigned_agent_id_status_idx" ON "tickets"("assigned_agent_id", "status");

-- CreateIndex
CREATE INDEX "tickets_status_priority_created_at_idx" ON "tickets"("status", "priority", "created_at");

-- CreateIndex
CREATE INDEX "tickets_application_id_category_idx" ON "tickets"("application_id", "category");

-- CreateIndex
CREATE INDEX "tickets_status_created_at_idx" ON "tickets"("status", "created_at");

-- CreateIndex
CREATE INDEX "ticket_assignments_ticket_id_assigned_at_idx" ON "ticket_assignments"("ticket_id", "assigned_at");

-- CreateIndex
CREATE INDEX "ticket_assignments_agent_id_assigned_at_idx" ON "ticket_assignments"("agent_id", "assigned_at");

-- CreateIndex
CREATE UNIQUE INDEX "sla_policies_priority_key" ON "sla_policies"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "sla_records_ticket_id_key" ON "sla_records"("ticket_id");

-- CreateIndex
CREATE INDEX "sla_records_state_response_deadline_idx" ON "sla_records"("state", "response_deadline");

-- CreateIndex
CREATE INDEX "sla_records_state_resolution_deadline_idx" ON "sla_records"("state", "resolution_deadline");

-- CreateIndex
CREATE INDEX "knowledge_base_application_id_category_is_verified_is_activ_idx" ON "knowledge_base"("application_id", "category", "is_verified", "is_active");

-- CreateIndex
CREATE INDEX "ai_analysis_ticket_id_created_at_idx" ON "ai_analysis"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_suggestions_ticket_id_relevance_score_idx" ON "ai_suggestions"("ticket_id", "relevance_score");

-- CreateIndex
CREATE INDEX "messages_ticket_id_created_at_idx" ON "messages"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "internal_notes_ticket_id_created_at_idx" ON "internal_notes"("ticket_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storage_name_key" ON "attachments"("storage_name");

-- CreateIndex
CREATE INDEX "attachments_ticket_id_created_at_idx" ON "attachments"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "canned_responses_title_idx" ON "canned_responses"("title");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "escalations_ticket_id_type_status_idx" ON "escalations"("ticket_id", "type", "status");

-- CreateIndex
CREATE INDEX "escalations_triggered_at_idx" ON "escalations"("triggered_at");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_ticket_id_key" ON "feedback"("ticket_id");

-- CreateIndex
CREATE INDEX "feedback_rating_created_at_idx" ON "feedback"("rating", "created_at");

-- CreateIndex
CREATE INDEX "ticket_history_ticket_id_created_at_idx" ON "ticket_history"("ticket_id", "created_at");

-- AddForeignKey
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_records" ADD CONSTRAINT "sla_records_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_records" ADD CONSTRAINT "sla_records_sla_policy_id_fkey" FOREIGN KEY ("sla_policy_id") REFERENCES "sla_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analysis" ADD CONSTRAINT "ai_analysis_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_base"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canned_responses" ADD CONSTRAINT "canned_responses_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_notified_admin_id_fkey" FOREIGN KEY ("notified_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "agent_profiles"
ADD CONSTRAINT "agent_profiles_maximum_workload_positive" CHECK ("maximum_workload" > 0);

-- AddCheckConstraint
ALTER TABLE "sla_policies"
ADD CONSTRAINT "sla_policies_positive_minutes"
CHECK ("first_response_minutes" > 0 AND "resolution_minutes" > 0 AND "warning_threshold_minutes" > 0);

-- AddCheckConstraint
ALTER TABLE "tickets"
ADD CONSTRAINT "tickets_priority_confidence_range"
CHECK ("priority_confidence" BETWEEN 0 AND 1);

-- AddCheckConstraint
ALTER TABLE "ai_analysis"
ADD CONSTRAINT "ai_analysis_score_ranges"
CHECK (
  "confidence_score" BETWEEN 0 AND 1
  AND "category_confidence" BETWEEN 0 AND 1
  AND "priority_confidence" BETWEEN 0 AND 1
  AND "sentiment_score" BETWEEN -1 AND 1
);

-- AddCheckConstraint
ALTER TABLE "ai_suggestions"
ADD CONSTRAINT "ai_suggestions_relevance_range"
CHECK ("relevance_score" BETWEEN 0 AND 1);

-- AddCheckConstraint
ALTER TABLE "feedback"
ADD CONSTRAINT "feedback_rating_range"
CHECK ("rating" BETWEEN 1 AND 5);

-- AddCheckConstraint
ALTER TABLE "escalations"
ADD CONSTRAINT "escalations_level_positive"
CHECK ("level" > 0);

