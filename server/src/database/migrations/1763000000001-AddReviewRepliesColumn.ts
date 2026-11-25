import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReviewRepliesColumn1763000000001 implements MigrationInterface {
  name = 'AddReviewRepliesColumn1763000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "replies" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reviews" DROP COLUMN IF EXISTS "replies"`,
    );
  }
}
