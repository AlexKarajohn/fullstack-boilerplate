import {
  eq,
  or,
  and,
  ilike,
  inArray,
  sql,
  SQL,
  type InferSelectModel,
  type InferInsertModel,
} from "drizzle-orm";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";
import type {
  PostgresJsDatabase,
  PostgresJsTransaction,
} from "drizzle-orm/postgres-js";

type AnyPgTable = PgTable<any>;
type AnyPgColumn = PgColumn<any>;

export type PgDbOrTx =
  | PostgresJsDatabase<Record<string, unknown>, any>
  | PostgresJsTransaction<Record<string, unknown>, any, any>;

export interface TableDataServiceConfig<T extends AnyPgTable> {
  idColumn?: keyof T["_"]["columns"];
  /**
   * If set, all getById/search/update/delete are scoped to this column (e.g. "teamId").
   * Callers must pass teamId so only rows belonging to that team are returned or modified.
   * Optional when creating the service – omit for tables that are not team-scoped.
   */
  teamIdColumn?: keyof T["_"]["columns"];
  /**
   * If set, all getById/search/update/delete are scoped to this column (e.g. "playerId").
   * Callers must pass playerId so only rows belonging to that player are returned or modified.
   * Optional when creating the service – omit for tables that are not player-scoped.
   */
  playerIdColumn?: keyof T["_"]["columns"];
  searchFields?: AnyPgColumn[];
  searchLimit?: number;
}

export type SelectModel<T extends AnyPgTable> = InferSelectModel<T>;
export type InsertModel<T extends AnyPgTable> = InferInsertModel<T>;

export class TableDataService<
  T extends AnyPgTable,
  TSelect = SelectModel<T>,
  TInsert = InsertModel<T>,
> {
  constructor(
    private readonly db: PostgresJsDatabase<Record<string, unknown>, any>,
    private readonly table: T,
    private readonly config: TableDataServiceConfig<T> = {},
  ) {}

  private getColumn(key: string) {
    return this.table[key as keyof T["_"]["columns"]] as AnyPgColumn;
  }

  private executor(tx?: PgDbOrTx) {
    return (tx ?? this.db) as PostgresJsDatabase<Record<string, unknown>, any>;
  }

  private isTeamScoped(): boolean {
    return Boolean(this.config.teamIdColumn);
  }

  private isPlayerScoped(): boolean {
    return Boolean(this.config.playerIdColumn);
  }

  private getBaseWhere(id: string, teamId?: string, playerId?: string) {
    const idCol = this.getColumn((this.config.idColumn ?? "id") as string);
    const conditions: SQL[] = [eq(idCol, id)];

    if (this.config.teamIdColumn && teamId !== undefined && teamId !== "") {
      conditions.push(
        eq(this.getColumn(this.config.teamIdColumn as string), teamId),
      );
    }

    if (
      this.config.playerIdColumn &&
      playerId !== undefined &&
      playerId !== ""
    ) {
      conditions.push(
        eq(this.getColumn(this.config.playerIdColumn as string), playerId),
      );
    }

    return and(...conditions);
  }

  async getById(
    id: string,
    teamId?: string,
    playerId?: string,
    tx?: PgDbOrTx,
  ): Promise<TSelect | null> {
    if (this.isTeamScoped() && (teamId === undefined || teamId === "")) {
      return null;
    }
    if (this.isPlayerScoped() && (playerId === undefined || playerId === "")) {
      return null;
    }
    const exec = this.executor(tx);
    const rows = await exec
      .select()
      .from(this.table as AnyPgTable)
      .where(this.getBaseWhere(id, teamId, playerId))
      .limit(1);
    return (rows[0] ?? null) as TSelect | null;
  }

  async search(
    options: {
      q?: string;
      limit?: number;
      teamId?: string;
      playerId?: string;
      allowedIds?: string[] | null;
    } = {},
    tx?: PgDbOrTx,
  ): Promise<{ data: TSelect[]; total: number }> {
    if (this.isTeamScoped() && (options.teamId === undefined || options.teamId === "")) {
      return { data: [], total: 0 };
    }
    if (
      this.isPlayerScoped() &&
      (options.playerId === undefined || options.playerId === "")
    ) {
      return { data: [], total: 0 };
    }
    if (
      options.allowedIds !== undefined &&
      options.allowedIds !== null &&
      options.allowedIds.length === 0
    ) {
      return { data: [], total: 0 };
    }

    const exec = this.executor(tx);
    const limit = options.limit ?? this.config.searchLimit ?? 50;
    const searchFields = this.config.searchFields ?? [];

    const conditions: (SQL | undefined)[] = [];

    if (this.config.teamIdColumn && options.teamId) {
      conditions.push(
        eq(this.getColumn(this.config.teamIdColumn as string), options.teamId),
      );
    }

    if (this.config.playerIdColumn && options.playerId) {
      conditions.push(
        eq(
          this.getColumn(this.config.playerIdColumn as string),
          options.playerId,
        ),
      );
    }

    if (
      options.allowedIds !== undefined &&
      options.allowedIds !== null &&
      options.allowedIds.length > 0
    ) {
      const idCol = this.getColumn((this.config.idColumn ?? "id") as string);
      conditions.push(inArray(idCol, options.allowedIds));
    }

    if (options.q && options.q.trim() !== "" && searchFields.length > 0) {
      const searchTerm = `%${options.q.trim()}%`;
      conditions.push(or(...searchFields.map((col) => ilike(col, searchTerm))));
    }

    const whereClause = and(...(conditions.filter(Boolean) as SQL[]));
    const table = this.table as AnyPgTable;

    const [data, countResult] = await Promise.all([
      exec.select().from(table).where(whereClause).limit(limit),
      exec
        .select({ count: sql<number>`count(*)` })
        .from(table)
        .where(whereClause),
    ]);

    return {
      data: data as TSelect[],
      total: Number(countResult[0]?.count ?? 0),
    };
  }

  async create(
    data: TInsert,
    teamId?: string,
    playerId?: string,
    tx?: PgDbOrTx,
  ): Promise<TSelect[]> {
    const exec = this.executor(tx);
    let values = data as Record<string, unknown>;
    if (
      this.isTeamScoped() &&
      this.config.teamIdColumn &&
      teamId !== undefined &&
      teamId !== ""
    ) {
      values = { ...values, [this.config.teamIdColumn as string]: teamId };
    }
    if (
      this.isPlayerScoped() &&
      this.config.playerIdColumn &&
      playerId !== undefined &&
      playerId !== ""
    ) {
      values = { ...values, [this.config.playerIdColumn as string]: playerId };
    }
    const result = await exec
      .insert(this.table as AnyPgTable)
      .values(values)
      .returning();
    return result as TSelect[];
  }

  async update(
    id: string,
    teamId: string | undefined,
    playerId: string | undefined,
    data: Partial<TInsert>,
    tx?: PgDbOrTx,
  ): Promise<TSelect | null> {
    if (this.isTeamScoped() && (teamId === undefined || teamId === "")) {
      return null;
    }
    if (this.isPlayerScoped() && (playerId === undefined || playerId === "")) {
      return null;
    }
    const exec = this.executor(tx);
    const result = await exec
      .update(this.table as AnyPgTable)
      .set(data as Record<string, unknown>)
      .where(this.getBaseWhere(id, teamId, playerId))
      .returning();
    return (result[0] ?? null) as TSelect | null;
  }

  async delete(
    id: string,
    teamId?: string,
    playerId?: string,
    tx?: PgDbOrTx,
  ): Promise<TSelect | null> {
    if (this.isTeamScoped() && (teamId === undefined || teamId === "")) {
      return null;
    }
    if (this.isPlayerScoped() && (playerId === undefined || playerId === "")) {
      return null;
    }
    const exec = this.executor(tx);
    const result = await exec
      .delete(this.table as AnyPgTable)
      .where(this.getBaseWhere(id, teamId, playerId))
      .returning();
    return (result[0] ?? null) as TSelect | null;
  }
}

export function createTableDataService<T extends AnyPgTable>(
  db: PostgresJsDatabase<Record<string, unknown>, any>,
  table: T,
  config?: TableDataServiceConfig<T>,
): TableDataService<T, SelectModel<T>, InsertModel<T>> {
  return new TableDataService(db, table, config);
}
