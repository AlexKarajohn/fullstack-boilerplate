import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import type { TableDataService } from "./table-service";

/** Zod schemas for validation. selectSchema must have `id` and support .pick({ id: true }); insertSchema for create body. updateSchema optional (else insertSchema.partial() when safe). */
export interface TableEndpointSchemas {
  selectSchema: z.ZodTypeAny & { pick: (keys: { id: true }) => z.ZodTypeAny };
  insertSchema: z.ZodTypeAny;
  updateSchema?: z.ZodTypeAny;
}

export interface CreateTableEndpointsOptions {
  schemas: TableEndpointSchemas;
  resourceName: string;
  searchLimit?: number;
  getTeamIdFromRequest?: (req: Request) => string | undefined;
  getPlayerIdFromRequest?: (req: Request) => string | undefined;
  getAllowedIdsFromRequest?: (req: Request) => string[] | null | undefined;
}

export interface TableEndpoint {
  validator: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void | Response;
  handler: (req: Request, res: Response) => void | Promise<void | Response>;
}

export interface TableEndpoints {
  getById: TableEndpoint;
  search: TableEndpoint;
  create: TableEndpoint;
  update: TableEndpoint;
  delete: TableEndpoint;
}

export function createTableEndpoints(
  service: TableDataService<any, any, any>,
  options: CreateTableEndpointsOptions,
): TableEndpoints {
  const {
    schemas,
    resourceName,
    searchLimit = 50,
    getTeamIdFromRequest,
    getPlayerIdFromRequest,
    getAllowedIdsFromRequest,
  } = options;
  const { selectSchema, insertSchema, updateSchema } = schemas;
  const idParamsSchema = selectSchema.pick({ id: true });
  const updateBodySchema =
    updateSchema ?? (insertSchema as z.ZodObject<z.ZodRawShape>).partial();

  function requireTeamId(req: Request, res: Response): string | null {
    if (!getTeamIdFromRequest) return "";
    const teamId = getTeamIdFromRequest(req);
    if (teamId === undefined || teamId === null || String(teamId).trim() === "") {
      res.status(400).json({ error: "teamId is required (e.g. from URL /teams/:teamId/...)" });
      return null;
    }
    return teamId;
  }

  function requirePlayerId(req: Request, res: Response): string | null | undefined {
    if (!getPlayerIdFromRequest) return undefined;
    const playerId = getPlayerIdFromRequest(req);
    if (playerId === undefined || playerId === null || String(playerId).trim() === "") {
      res.status(400).json({ error: "playerId is required (e.g. from URL .../players/:playerId/...)" });
      return null;
    }
    return playerId;
  }

  const getById: TableEndpoint = {
    validator: (req, res, next) => {
      const { error } = idParamsSchema.safeParse(req.params);
      if (error) {
        return res.status(400).json({
          error: "Validation failed",
          details: error.flatten().fieldErrors,
        });
      }
      next();
    },
    handler: async (req, res) => {
      try {
        const teamId = requireTeamId(req, res);
        if (teamId === null) return;
        const playerId = requirePlayerId(req, res);
        if (playerId === null) return;
        const id = req.params.id;
        if (typeof id !== "string") {
          return res.status(400).json({ error: "Invalid id" });
        }
        const row = await service.getById(id, teamId || undefined, playerId ?? undefined);
        if (row === null) {
          return res.status(404).json({ error: "Not found" });
        }
        res.json(row);
      } catch {
        res.status(500).json({ error: "Database error" });
      }
    },
  };

  const search: TableEndpoint = {
    validator: (req, res, next) => {
      const querySchema = z.object({
        q: z.string().optional(),
      });
      const { error } = querySchema.safeParse(req.query);
      if (error) {
        return res.status(400).json({ error: "Invalid search query" });
      }
      next();
    },
    handler: async (req, res) => {
      try {
        const teamId = requireTeamId(req, res);
        if (teamId === null) return;
        const playerId = requirePlayerId(req, res);
        if (playerId === null) return;
        const q = typeof req.query.q === "string" ? req.query.q : undefined;
        const allowedIds = getAllowedIdsFromRequest?.(req);
        const { data, total } = await service.search({
          q,
          limit: searchLimit,
          teamId: teamId || undefined,
          playerId: playerId ?? undefined,
          allowedIds,
        });
        res.setHeader(
          "Content-Range",
          `${resourceName} 0-${data.length}/${total}`,
        );
        res.setHeader("Access-Control-Expose-Headers", "Content-Range");
        res.json(data);
      } catch {
        res.status(500).json({ error: "Database error" });
      }
    },
  };

  const create: TableEndpoint = {
    validator: (req, res, next) => {
      const { error } = insertSchema.safeParse(req.body);
      if (error) {
        return res.status(400).json({ error: error.message });
      }
      next();
    },
    handler: async (req, res) => {
      try {
        const teamId = requireTeamId(req, res);
        if (teamId === null) return;
        const playerId = requirePlayerId(req, res);
        if (playerId === null) return;
        const result = await service.create(
          req.body,
          teamId || undefined,
          playerId ?? undefined,
        );
        res.json(result);
      } catch {
        res.status(500).json({ error: "Database error" });
      }
    },
  };

  const update: TableEndpoint = {
    validator: (req, res, next) => {
      const paramsResult = idParamsSchema.safeParse(req.params);
      const bodyResult = updateBodySchema.safeParse(req.body);
      if (!paramsResult.success || !bodyResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: {
            params: paramsResult.error?.flatten().fieldErrors,
            body: bodyResult.error?.flatten().fieldErrors,
          },
        });
      }
      next();
    },
    handler: async (req, res) => {
      try {
        const teamId = requireTeamId(req, res);
        if (teamId === null) return;
        const playerId = requirePlayerId(req, res);
        if (playerId === null) return;
        const id = req.params.id;
        if (typeof id !== "string") {
          return res.status(400).json({ error: "Invalid id" });
        }
        const row = await service.update(
          id,
          teamId || undefined,
          playerId ?? undefined,
          req.body,
        );
        if (row === null) {
          return res.status(404).json({ error: "Not found" });
        }
        res.json(row);
      } catch {
        res.status(500).json({ error: "Database error" });
      }
    },
  };

  const del: TableEndpoint = {
    validator: (req, res, next) => {
      const { error } = idParamsSchema.safeParse(req.params);
      if (error) {
        return res.status(400).json({
          error: "Validation failed",
          details: error.flatten().fieldErrors,
        });
      }
      next();
    },
    handler: async (req, res) => {
      try {
        const teamId = requireTeamId(req, res);
        if (teamId === null) return;
        const playerId = requirePlayerId(req, res);
        if (playerId === null) return;
        const id = req.params.id;
        if (typeof id !== "string") {
          return res.status(400).json({ error: "Invalid id" });
        }
        const deleted = await service.delete(
          id,
          teamId || undefined,
          playerId ?? undefined,
        );
        if (deleted === null) {
          return res.status(404).json({ error: "Not found" });
        }
        res.json({
          message: "Deleted successfully",
          deletedRow: deleted,
        });
      } catch {
        res.status(500).json({ error: "Database error" });
      }
    },
  };

  return {
    getById,
    search,
    create,
    update,
    delete: del,
  };
}
