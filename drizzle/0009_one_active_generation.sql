ALTER TABLE "generation_run" DROP CONSTRAINT "generation_run_idem_uq";--> statement-breakpoint
ALTER TABLE "generation_run" ADD CONSTRAINT "generation_run_idem_uq" UNIQUE ("project_id", "kind", "idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_run_one_active_uq" ON "generation_run" ("project_id") WHERE "status" in ('pending', 'running');
