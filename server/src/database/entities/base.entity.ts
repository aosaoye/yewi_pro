import { randomUUID } from 'crypto';
import { BeforeInsert, PrimaryColumn } from 'typeorm';

export abstract class UuidVarcharEntity {
  @PrimaryColumn({
    type: 'varchar',
    length: 64,
    default: () => 'gen_random_uuid()::text',
  })
  id!: string;

  @BeforeInsert()
  ensureId(): void {
    if (!this.id) {
      this.id = randomUUID();
    }
  }
}
