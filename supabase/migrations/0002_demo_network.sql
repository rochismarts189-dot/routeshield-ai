-- RouteShield AI - Seed Demo Network
-- Migration: 0002_demo_network.sql

-- Insert Nodes
INSERT INTO routeshield.nodes (id, name, map_x, map_y, latitude, longitude)
VALUES
  ('A', 'Transit Stop', 40, 180, 12.0000, 77.0000),
  ('B', 'Market Corner', 180, 180, 12.0000, 77.0013),
  ('C', 'Library Junction', 340, 180, 12.0000, 77.0028),
  ('D', 'Clinic Entrance', 500, 180, 12.0000, 77.0043),
  ('E', 'Garden Gate', 180, 60, 12.0011, 77.0013),
  ('F', 'Community Centre', 340, 60, 12.0011, 77.0028),
  ('G', 'South Crossing', 180, 320, 11.9987, 77.0013),
  ('H', 'Clinic Ramp', 500, 320, 11.9987, 77.0043)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  map_x = EXCLUDED.map_x,
  map_y = EXCLUDED.map_y,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude;

-- Insert Edges (ensuring canonical from_node < to_node constraint)
INSERT INTO routeshield.edges (id, from_node, to_node, name, length_m, step_free_status, has_steps)
VALUES
  ('AB', 'A', 'B', 'Transit Stop to Market Corner', 140, 'YES', false),
  ('BC', 'B', 'C', 'Market Corner to Library Junction', 160, 'YES', false),
  ('CD', 'C', 'D', 'Library Junction to Clinic Entrance', 160, 'YES', false),
  ('BE', 'B', 'E', 'Market Corner to Garden Gate', 120, 'YES', false),
  ('EF', 'E', 'F', 'Garden Gate to Community Centre (Stairs)', 160, 'NO', true),
  ('FD', 'D', 'F', 'Clinic Entrance to Community Centre', 200, 'YES', false),
  ('BG', 'B', 'G', 'Market Corner to South Crossing', 140, 'YES', false),
  ('GH', 'G', 'H', 'South Crossing to Clinic Ramp', 320, 'YES', false),
  ('HD', 'D', 'H', 'Clinic Entrance to Clinic Ramp', 140, 'YES', false),
  ('FC', 'C', 'F', 'Library Junction to Community Centre', 120, 'UNKNOWN', false)
ON CONFLICT (id) DO UPDATE SET
  from_node = EXCLUDED.from_node,
  to_node = EXCLUDED.to_node,
  name = EXCLUDED.name,
  length_m = EXCLUDED.length_m,
  step_free_status = EXCLUDED.step_free_status,
  has_steps = EXCLUDED.has_steps;
