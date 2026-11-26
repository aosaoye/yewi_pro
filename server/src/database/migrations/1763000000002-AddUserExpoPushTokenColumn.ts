import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserExpoPushTokenColumn1763000000002
  implements MigrationInterface
{
  name = 'AddUserExpoPushTokenColumn1763000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "expo_push_token" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "expo_push_token"`,
    );
  }
}
