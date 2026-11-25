import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialYewiSchema1763000000000 implements MigrationInterface {
  name = 'InitialYewiSchema1763000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "user_role_enum" AS ENUM ('CLIENT', 'PROFESSIONAL', 'ADMIN');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "kyc_status_enum" AS ENUM ('UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "category_type_enum" AS ENUM ('GIG', 'LEAD', 'HYBRID');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "gig_status_enum" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'REJECTED');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "package_tier_enum" AS ENUM ('BASIC', 'STANDARD', 'PREMIUM');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "lead_status_enum" AS ENUM ('OPEN', 'EXPIRED', 'CANCELLED', 'FULFILLED');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "proposal_status_enum" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "order_type_enum" AS ENUM ('GIG_PURCHASE', 'CUSTOM_OFFER', 'LEAD_CONTRACT');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "order_status_enum" AS ENUM ('PENDING_REQUIREMENTS', 'IN_PROGRESS', 'DELIVERED', 'REVISION_REQUESTED', 'COMPLETED', 'CANCELLED', 'DISPUTED');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "milestone_status_enum" AS ENUM ('PENDING', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED', 'DISPUTED');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "escrow_status_enum" AS ENUM ('HELD', 'RELEASED_TO_PRO', 'REFUNDED_TO_CLIENT', 'PARTIALLY_REFUNDED');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "transaction_type_enum" AS ENUM ('DEPOSIT', 'CREDIT_PURCHASE', 'LEAD_UNLOCK', 'LEAD_REFUND', 'ORDER_PAYMENT', 'ESCROW_RELEASE', 'PLATFORM_FEE', 'PAYOUT_WITHDRAWAL', 'ORDER_REFUND');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "transaction_status_enum" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "message_type_enum" AS ENUM ('TEXT', 'ATTACHMENT', 'CUSTOM_OFFER', 'SYSTEM_EVENT');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "notification_type_enum" AS ENUM ('LEAD_MATCH', 'QUOTE_RECEIVED', 'QUOTE_ACCEPTED', 'ORDER_CREATED', 'ORDER_DELIVERED', 'REVISION_REQUESTED', 'ORDER_COMPLETED', 'DISPUTE_OPENED', 'SYSTEM_ALERT');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "subscription_status_enum" AS ENUM ('INCOMPLETE', 'INCOMPLETE_EXPIRED', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "status_media_type_enum" AS ENUM ('IMAGE', 'VIDEO', 'TEXT');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "email" varchar(255) NOT NULL,
        "password_hash" text NOT NULL,
        "roles" "user_role_enum"[] NOT NULL DEFAULT ARRAY['CLIENT']::"user_role_enum"[],
        "is_active" boolean NOT NULL DEFAULT true,
        "is_email_verified" boolean NOT NULL DEFAULT false,
        "is_pro" boolean NOT NULL DEFAULT false,
        "email_verification_token" text,
        "password_reset_token" text,
        "password_reset_expires" timestamptz,
        "refresh_token_hash" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      );
      CREATE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email");

      CREATE TABLE IF NOT EXISTS "profiles" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "user_id" varchar(64) NOT NULL,
        "first_name" varchar(120) NOT NULL,
        "last_name" varchar(120) NOT NULL,
        "display_name" varchar(160),
        "avatar_url" text,
        "phone_number" varchar(40),
        "phone_verified" boolean NOT NULL DEFAULT false,
        "country" varchar(100),
        "region" varchar(120),
        "province" varchar(120),
        "city" varchar(120),
        "postal_code" varchar(20),
        "address" text,
        "bio" text,
        "preferred_language" varchar(16) NOT NULL DEFAULT 'es',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_profiles_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_profiles_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_profiles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "professional_profiles" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "user_id" varchar(64) NOT NULL,
        "business_name" varchar(180),
        "tax_id" varchar(40),
        "bio" text NOT NULL,
        "is_pro" boolean NOT NULL DEFAULT false,
        "hourly_rate" decimal(10,2),
        "service_radius_km" integer NOT NULL DEFAULT 50,
        "latitude" double precision,
        "longitude" double precision,
        "country" varchar(100),
        "region" varchar(120),
        "province" varchar(120),
        "city" varchar(120),
        "postal_code" varchar(20),
        "address" text,
        "kyc_status" "kyc_status_enum" NOT NULL DEFAULT 'UNVERIFIED',
        "kyc_document_url" text,
        "kyc_rejection_reason" text,
        "badges" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "avg_rating" double precision NOT NULL DEFAULT 0.0,
        "total_reviews" integer NOT NULL DEFAULT 0,
        "completed_orders_count" integer NOT NULL DEFAULT 0,
        "response_time_hours" integer NOT NULL DEFAULT 24,
        "response_rate_percent" integer NOT NULL DEFAULT 100,
        "skills" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_professional_profiles_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_professional_profiles_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_professional_profiles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "IDX_pro_lat_lon" ON "professional_profiles" ("latitude", "longitude");
      CREATE INDEX IF NOT EXISTS "IDX_pro_kyc_status" ON "professional_profiles" ("kyc_status");
      CREATE INDEX IF NOT EXISTS "IDX_pro_is_pro" ON "professional_profiles" ("is_pro");

      CREATE TABLE IF NOT EXISTS "subscriptions" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "user_id" varchar(64) NOT NULL,
        "stripe_customer_id" varchar(120),
        "stripe_subscription_id" varchar(120),
        "stripe_price_id" varchar(120),
        "status" "subscription_status_enum" NOT NULL DEFAULT 'INCOMPLETE',
        "current_period_start" timestamptz,
        "current_period_end" timestamptz,
        "cancel_at_period_end" boolean NOT NULL DEFAULT false,
        "canceled_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscriptions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_subscriptions_user_id" UNIQUE ("user_id"),
        CONSTRAINT "UQ_subscriptions_stripe_sub_id" UNIQUE ("stripe_subscription_id"),
        CONSTRAINT "FK_subscriptions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "IDX_subscriptions_status" ON "subscriptions" ("status");
      CREATE INDEX IF NOT EXISTS "IDX_subscriptions_stripe_customer" ON "subscriptions" ("stripe_customer_id");

      CREATE TABLE IF NOT EXISTS "portfolio_items" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "professional_profile_id" varchar(64) NOT NULL,
        "title" varchar(200) NOT NULL,
        "description" text NOT NULL,
        "image_urls" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "project_url" text,
        "tags" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_portfolio_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_portfolio_items_pro" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "categories" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "parent_id" varchar(64),
        "name" varchar(160) NOT NULL,
        "slug" varchar(180) NOT NULL,
        "description" text,
        "icon" varchar(120),
        "banner_url" text,
        "type" "category_type_enum" NOT NULL DEFAULT 'HYBRID',
        "form_schema" jsonb,
        "base_lead_credit_cost" integer NOT NULL DEFAULT 10,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categories_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_categories_slug" UNIQUE ("slug"),
        CONSTRAINT "FK_categories_parent" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS "IDX_categories_slug" ON "categories" ("slug");
      CREATE INDEX IF NOT EXISTS "IDX_categories_parent_id" ON "categories" ("parent_id");

      CREATE TABLE IF NOT EXISTS "professional_categories" (
        "professional_profile_id" varchar(64) NOT NULL,
        "category_id" varchar(64) NOT NULL,
        CONSTRAINT "PK_professional_categories" PRIMARY KEY ("professional_profile_id", "category_id"),
        CONSTRAINT "FK_prof_cat_pro" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_prof_cat_cat" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "IDX_prof_cat_category" ON "professional_categories" ("category_id");

      CREATE TABLE IF NOT EXISTS "gigs" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "professional_profile_id" varchar(64) NOT NULL,
        "category_id" varchar(64) NOT NULL,
        "title" varchar(240) NOT NULL,
        "slug" varchar(260) NOT NULL,
        "description" text NOT NULL,
        "search_tags" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "cover_images" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "video_url" text,
        "pdf_documents" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "faqs" jsonb,
        "requirements" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "status" "gig_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "avg_rating" double precision NOT NULL DEFAULT 0.0,
        "total_reviews" integer NOT NULL DEFAULT 0,
        "orders_count" integer NOT NULL DEFAULT 0,
        "is_featured" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        CONSTRAINT "PK_gigs_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_gigs_slug" UNIQUE ("slug"),
        CONSTRAINT "FK_gigs_pro" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_gigs_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT
      );
      CREATE INDEX IF NOT EXISTS "IDX_gigs_slug" ON "gigs" ("slug");
      CREATE INDEX IF NOT EXISTS "IDX_gigs_category_id" ON "gigs" ("category_id");
      CREATE INDEX IF NOT EXISTS "IDX_gigs_pro_id" ON "gigs" ("professional_profile_id");
      CREATE INDEX IF NOT EXISTS "IDX_gigs_status" ON "gigs" ("status");

      CREATE TABLE IF NOT EXISTS "gig_packages" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "gig_id" varchar(64) NOT NULL,
        "tier" "package_tier_enum" NOT NULL,
        "name" varchar(160) NOT NULL,
        "description" text NOT NULL,
        "price" decimal(10,2) NOT NULL,
        "delivery_days" integer NOT NULL,
        "revisions" integer NOT NULL DEFAULT 1,
        "features" jsonb,
        "is_popular" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gig_packages_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_gig_packages_gig_tier" UNIQUE ("gig_id", "tier"),
        CONSTRAINT "FK_gig_packages_gig" FOREIGN KEY ("gig_id") REFERENCES "gigs"("id") ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "gig_extras" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "gig_id" varchar(64) NOT NULL,
        "title" varchar(160) NOT NULL,
        "description" text,
        "price" decimal(10,2) NOT NULL,
        "additional_delivery_days" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gig_extras_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_gig_extras_gig" FOREIGN KEY ("gig_id") REFERENCES "gigs"("id") ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "service_requests" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "client_id" varchar(64) NOT NULL,
        "category_id" varchar(64) NOT NULL,
        "title" varchar(240) NOT NULL,
        "description" text NOT NULL,
        "questionnaire_answers" jsonb NOT NULL,
        "budget_min" decimal(10,2),
        "budget_max" decimal(10,2),
        "is_urgent" boolean NOT NULL DEFAULT false,
        "preferred_date" timestamptz,
        "postal_code" varchar(20) NOT NULL,
        "city" varchar(120) NOT NULL,
        "country" varchar(100) NOT NULL DEFAULT 'ES',
        "address" text,
        "latitude" double precision,
        "longitude" double precision,
        "is_remote" boolean NOT NULL DEFAULT false,
        "credit_cost" integer NOT NULL DEFAULT 10,
        "max_unlocks" integer NOT NULL DEFAULT 5,
        "unlocks_count" integer NOT NULL DEFAULT 0,
        "status" "lead_status_enum" NOT NULL DEFAULT 'OPEN',
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_service_requests_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_service_requests_client" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_service_requests_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT
      );
      CREATE INDEX IF NOT EXISTS "IDX_sr_category_id" ON "service_requests" ("category_id");
      CREATE INDEX IF NOT EXISTS "IDX_sr_lat_lon" ON "service_requests" ("latitude", "longitude");
      CREATE INDEX IF NOT EXISTS "IDX_sr_status" ON "service_requests" ("status");

      CREATE TABLE IF NOT EXISTS "lead_unlocks" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "service_request_id" varchar(64) NOT NULL,
        "professional_profile_id" varchar(64) NOT NULL,
        "credits_spent" integer NOT NULL,
        "unlocked_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lead_unlocks_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_lead_unlocks_req_pro" UNIQUE ("service_request_id", "professional_profile_id"),
        CONSTRAINT "FK_lead_unlocks_sr" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_lead_unlocks_pro" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "quote_proposals" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "service_request_id" varchar(64) NOT NULL,
        "professional_profile_id" varchar(64) NOT NULL,
        "price" decimal(10,2) NOT NULL,
        "estimated_days" integer NOT NULL,
        "message" text NOT NULL,
        "breakdown" jsonb,
        "status" "proposal_status_enum" NOT NULL DEFAULT 'PENDING',
        "expires_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quote_proposals_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quote_proposals_sr" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_quote_proposals_pro" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "IDX_qp_sr_id" ON "quote_proposals" ("service_request_id");
      CREATE INDEX IF NOT EXISTS "IDX_qp_pro_id" ON "quote_proposals" ("professional_profile_id");

      CREATE TABLE IF NOT EXISTS "orders" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "order_number" varchar(64) NOT NULL,
        "client_id" varchar(64) NOT NULL,
        "professional_profile_id" varchar(64) NOT NULL,
        "order_type" "order_type_enum" NOT NULL,
        "gig_id" varchar(64),
        "gig_package_id" varchar(64),
        "quote_proposal_id" varchar(64),
        "service_request_id" varchar(64),
        "status" "order_status_enum" NOT NULL DEFAULT 'PENDING_REQUIREMENTS',
        "subtotal" decimal(10,2) NOT NULL,
        "platform_fee" decimal(10,2) NOT NULL,
        "total_amount" decimal(10,2) NOT NULL,
        "pro_earnings" decimal(10,2) NOT NULL,
        "escrow_status" "escrow_status_enum" NOT NULL DEFAULT 'HELD',
        "requirements_answers" jsonb,
        "delivery_deadline" timestamptz NOT NULL,
        "auto_completed_at" timestamptz,
        "cancelled_at" timestamptz,
        "cancellation_reason" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_orders_order_number" UNIQUE ("order_number"),
        CONSTRAINT "FK_orders_client" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_orders_pro" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_orders_gig" FOREIGN KEY ("gig_id") REFERENCES "gigs"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_orders_gig_package" FOREIGN KEY ("gig_package_id") REFERENCES "gig_packages"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_orders_quote_proposal" FOREIGN KEY ("quote_proposal_id") REFERENCES "quote_proposals"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_orders_service_request" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS "IDX_orders_number" ON "orders" ("order_number");
      CREATE INDEX IF NOT EXISTS "IDX_orders_client" ON "orders" ("client_id");
      CREATE INDEX IF NOT EXISTS "IDX_orders_pro" ON "orders" ("professional_profile_id");
      CREATE INDEX IF NOT EXISTS "IDX_orders_status" ON "orders" ("status");

      CREATE TABLE IF NOT EXISTS "order_milestones" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "order_id" varchar(64) NOT NULL,
        "title" varchar(200) NOT NULL,
        "description" text,
        "amount" decimal(10,2) NOT NULL,
        "delivery_days" integer NOT NULL,
        "status" "milestone_status_enum" NOT NULL DEFAULT 'PENDING',
        "due_date" timestamptz,
        "completed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_milestones_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_order_milestones_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "order_deliveries" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "order_id" varchar(64) NOT NULL,
        "delivery_number" integer NOT NULL DEFAULT 1,
        "message" text NOT NULL,
        "attachment_urls" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "is_accepted" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_deliveries_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_order_deliveries_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "order_disputes" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "order_id" varchar(64) NOT NULL,
        "initiator_id" varchar(64) NOT NULL,
        "reason" varchar(240) NOT NULL,
        "description" text NOT NULL,
        "evidence_urls" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "resolution_notes" text,
        "resolved_by_admin_id" varchar(64),
        "refund_amount_client" decimal(10,2) NOT NULL DEFAULT 0.00,
        "payout_amount_pro" decimal(10,2) NOT NULL DEFAULT 0.00,
        "status" varchar(40) NOT NULL DEFAULT 'OPEN',
        "resolved_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_disputes_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_order_disputes_order_id" UNIQUE ("order_id"),
        CONSTRAINT "FK_order_disputes_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "wallets" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "user_id" varchar(64) NOT NULL,
        "credit_balance" integer NOT NULL DEFAULT 0,
        "fiat_pending_balance" decimal(10,2) NOT NULL DEFAULT 0.00,
        "fiat_available_balance" decimal(10,2) NOT NULL DEFAULT 0.00,
        "currency" varchar(16) NOT NULL DEFAULT 'EUR',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wallets_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_wallets_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_wallets_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "ledger_transactions" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "wallet_id" varchar(64) NOT NULL,
        "type" "transaction_type_enum" NOT NULL,
        "amount" decimal(10,2) NOT NULL DEFAULT 0.00,
        "credit_amount" integer DEFAULT 0,
        "currency" varchar(16) NOT NULL DEFAULT 'EUR',
        "status" "transaction_status_enum" NOT NULL DEFAULT 'COMPLETED',
        "stripe_payment_intent_id" varchar(160),
        "stripe_transfer_id" varchar(160),
        "reference_id" varchar(160),
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ledger_transactions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ledger_wallet" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "IDX_ledger_wallet_id" ON "ledger_transactions" ("wallet_id");
      CREATE INDEX IF NOT EXISTS "IDX_ledger_type" ON "ledger_transactions" ("type");
      CREATE INDEX IF NOT EXISTS "IDX_ledger_reference_id" ON "ledger_transactions" ("reference_id");

      CREATE TABLE IF NOT EXISTS "reviews" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "order_id" varchar(64),
        "professional_profile_id" varchar(64),
        "gig_id" varchar(64),
        "author_id" varchar(64) NOT NULL,
        "target_user_id" varchar(64) NOT NULL,
        "rating" integer NOT NULL DEFAULT 5,
        "quality_rating" integer NOT NULL DEFAULT 5,
        "communication_rating" integer NOT NULL DEFAULT 5,
        "delivery_rating" integer NOT NULL DEFAULT 5,
        "comment" text NOT NULL,
        "seller_reply" text,
        "seller_replied_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reviews_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reviews_order_id" UNIQUE ("order_id"),
        CONSTRAINT "FK_reviews_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reviews_pro" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reviews_gig" FOREIGN KEY ("gig_id") REFERENCES "gigs"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_reviews_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_reviews_target" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      );
      CREATE INDEX IF NOT EXISTS "IDX_reviews_target_user" ON "reviews" ("target_user_id");
      CREATE INDEX IF NOT EXISTS "IDX_reviews_pro" ON "reviews" ("professional_profile_id");
      CREATE INDEX IF NOT EXISTS "IDX_reviews_gig" ON "reviews" ("gig_id");

      CREATE TABLE IF NOT EXISTS "conversations" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "order_id" varchar(64),
        "service_request_id" varchar(64),
        "participant_a_id" varchar(64) NOT NULL,
        "participant_b_id" varchar(64) NOT NULL,
        "last_message_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversations_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_conversations_order_id" UNIQUE ("order_id"),
        CONSTRAINT "FK_conversations_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_conversations_sr" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS "IDX_conversations_participants" ON "conversations" ("participant_a_id", "participant_b_id");
      CREATE INDEX IF NOT EXISTS "IDX_conversations_sr" ON "conversations" ("service_request_id");

      CREATE TABLE IF NOT EXISTS "messages" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "conversation_id" varchar(64) NOT NULL,
        "sender_id" varchar(64) NOT NULL,
        "type" "message_type_enum" NOT NULL DEFAULT 'TEXT',
        "content" text NOT NULL,
        "attachments" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "metadata" jsonb,
        "is_read" boolean NOT NULL DEFAULT false,
        "read_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_messages_conversation" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_messages_sender" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT
      );
      CREATE INDEX IF NOT EXISTS "IDX_messages_conv" ON "messages" ("conversation_id");
      CREATE INDEX IF NOT EXISTS "IDX_messages_sender" ON "messages" ("sender_id");

      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "user_id" varchar(64) NOT NULL,
        "type" "notification_type_enum" NOT NULL,
        "title" varchar(240) NOT NULL,
        "message" text NOT NULL,
        "link" text,
        "metadata" jsonb,
        "is_read" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "IDX_notifications_user_read" ON "notifications" ("user_id", "is_read");

      CREATE TABLE IF NOT EXISTS "promotions" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "professional_profile_id" varchar(64) NOT NULL,
        "title" varchar(200) NOT NULL,
        "description" text NOT NULL,
        "discount_percent" integer,
        "discount_amount" decimal(10,2),
        "promo_code" varchar(60),
        "category" varchar(120),
        "badge" varchar(80),
        "expires_at" timestamptz NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_promotions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_promotions_pro" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "IDX_promotions_pro" ON "promotions" ("professional_profile_id");
      CREATE INDEX IF NOT EXISTS "IDX_promotions_expires_at" ON "promotions" ("expires_at");
      CREATE INDEX IF NOT EXISTS "IDX_promotions_is_active" ON "promotions" ("is_active");

      CREATE TABLE IF NOT EXISTS "statuses" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "author_id" varchar(64) NOT NULL,
        "media_url" text,
        "media_type" "status_media_type_enum" NOT NULL DEFAULT 'IMAGE',
        "caption" text,
        "background_color" varchar(32),
        "view_count" integer NOT NULL DEFAULT 0,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_statuses_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_statuses_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "IDX_statuses_author" ON "statuses" ("author_id");
      CREATE INDEX IF NOT EXISTS "IDX_statuses_expires_at" ON "statuses" ("expires_at");
      CREATE INDEX IF NOT EXISTS "IDX_statuses_created_at" ON "statuses" ("created_at");

      CREATE TABLE IF NOT EXISTS "status_comments" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "status_id" varchar(64) NOT NULL,
        "author_id" varchar(64) NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_status_comments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_status_comments_status" FOREIGN KEY ("status_id") REFERENCES "statuses"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_status_comments_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "IDX_status_comments_status" ON "status_comments" ("status_id");
      CREATE INDEX IF NOT EXISTS "IDX_status_comments_author" ON "status_comments" ("author_id");

      CREATE TABLE IF NOT EXISTS "status_reactions" (
        "id" varchar(64) NOT NULL DEFAULT gen_random_uuid()::text,
        "status_id" varchar(64) NOT NULL,
        "user_id" varchar(64) NOT NULL,
        "reaction_type" varchar(32) NOT NULL DEFAULT 'LIKE',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_status_reactions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_status_reactions_status_user" UNIQUE ("status_id", "user_id"),
        CONSTRAINT "FK_status_reactions_status" FOREIGN KEY ("status_id") REFERENCES "statuses"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_status_reactions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "IDX_status_reactions_status" ON "status_reactions" ("status_id");
      CREATE INDEX IF NOT EXISTS "IDX_status_reactions_user" ON "status_reactions" ("user_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "status_reactions" CASCADE;
      DROP TABLE IF EXISTS "status_comments" CASCADE;
      DROP TABLE IF EXISTS "statuses" CASCADE;
      DROP TABLE IF EXISTS "promotions" CASCADE;
      DROP TABLE IF EXISTS "notifications" CASCADE;
      DROP TABLE IF EXISTS "messages" CASCADE;
      DROP TABLE IF EXISTS "conversations" CASCADE;
      DROP TABLE IF EXISTS "reviews" CASCADE;
      DROP TABLE IF EXISTS "ledger_transactions" CASCADE;
      DROP TABLE IF EXISTS "wallets" CASCADE;
      DROP TABLE IF EXISTS "order_disputes" CASCADE;
      DROP TABLE IF EXISTS "order_deliveries" CASCADE;
      DROP TABLE IF EXISTS "order_milestones" CASCADE;
      DROP TABLE IF EXISTS "orders" CASCADE;
      DROP TABLE IF EXISTS "quote_proposals" CASCADE;
      DROP TABLE IF EXISTS "lead_unlocks" CASCADE;
      DROP TABLE IF EXISTS "service_requests" CASCADE;
      DROP TABLE IF EXISTS "gig_extras" CASCADE;
      DROP TABLE IF EXISTS "gig_packages" CASCADE;
      DROP TABLE IF EXISTS "gigs" CASCADE;
      DROP TABLE IF EXISTS "professional_categories" CASCADE;
      DROP TABLE IF EXISTS "categories" CASCADE;
      DROP TABLE IF EXISTS "portfolio_items" CASCADE;
      DROP TABLE IF EXISTS "subscriptions" CASCADE;
      DROP TABLE IF EXISTS "professional_profiles" CASCADE;
      DROP TABLE IF EXISTS "profiles" CASCADE;
      DROP TABLE IF EXISTS "users" CASCADE;

      DROP TYPE IF EXISTS "status_media_type_enum";
      DROP TYPE IF EXISTS "subscription_status_enum";
      DROP TYPE IF EXISTS "notification_type_enum";
      DROP TYPE IF EXISTS "message_type_enum";
      DROP TYPE IF EXISTS "transaction_status_enum";
      DROP TYPE IF EXISTS "transaction_type_enum";
      DROP TYPE IF EXISTS "escrow_status_enum";
      DROP TYPE IF EXISTS "milestone_status_enum";
      DROP TYPE IF EXISTS "order_status_enum";
      DROP TYPE IF EXISTS "order_type_enum";
      DROP TYPE IF EXISTS "proposal_status_enum";
      DROP TYPE IF EXISTS "lead_status_enum";
      DROP TYPE IF EXISTS "package_tier_enum";
      DROP TYPE IF EXISTS "gig_status_enum";
      DROP TYPE IF EXISTS "category_type_enum";
      DROP TYPE IF EXISTS "kyc_status_enum";
      DROP TYPE IF EXISTS "user_role_enum";
    `);
  }
}
