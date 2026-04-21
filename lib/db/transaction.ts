import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import type {
  StudyLabTransaction,
  StudyLabTransactionRunner,
} from "@/features/study-lab/types/domain";
import { getPgPool, type PgQueryable } from "./client";

const transactionClients = new WeakMap<StudyLabTransaction, PoolClient>();

export class PgStudyLabTransactionRunner implements StudyLabTransactionRunner {
  async runInTransaction<T>(callback: (tx: StudyLabTransaction) => Promise<T>): Promise<T> {
    const client = await getPgPool().connect();
    const tx: StudyLabTransaction = { kind: "study-lab-transaction" };

    transactionClients.set(tx, client);

    try {
      await client.query("begin");
      const result = await callback(tx);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      transactionClients.delete(tx);
      client.release();
    }
  }
}

export function getPgQueryable(tx?: StudyLabTransaction): PgQueryable {
  if (!tx) {
    return getPgPool();
  }

  const client = transactionClients.get(tx);

  if (!client) {
    throw new Error("Invalid or expired STUDY LAB transaction.");
  }

  return client;
}

export async function pgQueryInContext<T extends QueryResultRow = QueryResultRow>(
  tx: StudyLabTransaction | undefined,
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  return getPgQueryable(tx).query<T>(text, [...values]);
}
