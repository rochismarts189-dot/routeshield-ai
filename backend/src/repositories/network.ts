import pg from 'pg';
import { query } from '../config/db.js';

export interface NodeRecord {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  map_x: number;
  map_y: number;
}

export interface EdgeRecord {
  id: string;
  from_node: string;
  to_node: string;
  name: string;
  length_m: number;
  step_free_status: 'YES' | 'NO' | 'UNKNOWN';
  has_steps: boolean;
}

export async function getAllNodes(client?: pg.PoolClient): Promise<NodeRecord[]> {
  const res = await (client ? client.query.bind(client) : query)<NodeRecord>(
    `SELECT id, name, latitude, longitude, map_x, map_y
     FROM routeshield.nodes
     ORDER BY id ASC;`
  );
  return res.rows;
}

export async function getAllEdges(client?: pg.PoolClient): Promise<EdgeRecord[]> {
  const res = await (client ? client.query.bind(client) : query)<EdgeRecord>(
    `SELECT id, from_node, to_node, name, length_m, step_free_status, has_steps
     FROM routeshield.edges
     ORDER BY id ASC;`
  );
  return res.rows;
}

export async function getEdgeById(id: string): Promise<EdgeRecord | null> {
  const res = await query<EdgeRecord>(
    `SELECT id, from_node, to_node, name, length_m, step_free_status, has_steps
     FROM routeshield.edges
     WHERE id = $1
     LIMIT 1;`,
    [id]
  );
  return res.rows[0] || null;
}
