-- Storefront Studio: admins manage the category shelf (5 to 12 categories) and publish the
-- storefront's look (theme, announcement, hero slides, home sections) as versioned settings.

alter table categories
  add column if not exists description     text not null default '',
  add column if not exists keywords        text[] not null default '{}',
  add column if not exists icon            text not null default 'box',
  add column if not exists is_visible      boolean not null default true,
  -- The category's description embedded with the same model as products, for shelf suggestions.
  add column if not exists text_embedding  vector(256),
  add column if not exists embedding_model text,
  add column if not exists created_at      timestamptz not null default now(),
  add column if not exists updated_at      timestamptz not null default now();

insert into categories (id, name, sort_order, description, keywords, icon) values
  ('dev-boards', 'Dev Boards & MCUs', 1,
   'Microcontroller boards, single board computers and edge AI compute.',
   array['arduino', 'esp32*', 'raspberry pi', 'stm32*', 'pico', 'jetson', 'microcontroller', 'mcu', 'development board', 'devkit*', 'single board computer', 'flight controller', 'plc', 'edge ai', 'motherboard'],
   'cpu'),
  ('sensors', 'Sensors & Modules', 2,
   'Sensors and sensing modules for distance, position, motion, vision and environment.',
   array['sensor', 'ultrasonic', 'lidar', 'gps', 'imu', 'camera', 'distance sensor', 'temperature sensor', 'gyroscope', 'accelerometer', 'laser scanner', 'grove'],
   'radio'),
  ('motors', 'Motors & Drivers', 3,
   'DC, geared, stepper, servo and brushless motors with their drivers and ESCs.',
   array['motor', 'dc motor', 'gear motor', 'geared motor', 'stepper motor', 'servo', 'brushless motor', 'bldc', 'motor driver', 'esc', 'h-bridge', 'encoder', 'spindle', 'coreless'],
   'cog'),
  ('power', 'Batteries & Power', 4,
   'Batteries, chargers and power supplies.',
   array['battery', 'lipo', 'li-ion', 'battery pack', 'charger', 'balance charger', 'power supply', 'smps', 'usb-c pd', 'gan', 'mah', 'voltage regulator'],
   'battery'),
  ('3d-printing', '3D Printing & CNC', 5,
   '3D printers, filament and resin, laser engravers and cutters, CNC machines and their accessories.',
   array['3d printer', '3d printing', 'resin printer', 'pla', 'petg', 'filament', 'laser engraver', 'laser cutter', 'cnc', 'cnc router', 'engraving', 'rotary roller', 'curing station', 'washing and curing', 'creality', 'bambu lab', 'atomstack', 'laser marking'],
   'printer'),
  ('mechanical', 'Robotics & Mechanical', 6,
   'Robot chassis, wheels, grippers, arms, belts, pulleys, gears and brackets.',
   array['robot chassis', 'car chassis', 'chassis', 'wheel', 'omni wheel', 'gripper', 'robotic arm', 'timing belt', 'pulley', 'gear', 'bracket', 'hexapod', 'robot platform', 'propeller', 'suspension'],
   'bot'),
  ('components', 'Components & Hardware', 7,
   'Passive components, LEDs, breadboards, jumper wires, switches and small interface boards.',
   array['resistor', 'led', 'capacitor', 'breadboard', 'jumper wires', 'push button', 'tactile switch', 'connector', 'usb to ttl', 'uart converter', 'amplifier board', 'trigger module', 'assortment kit'],
   'cable'),
  ('accessories', 'Tools & Soldering', 8,
   'Soldering stations, multimeters and hand tools for the bench.',
   array['soldering', 'soldering station', 'multimeter', 'wire stripper', 'cutter tool', 'tweezers', 'esd safe', 'tool', 'bench'],
   'wrench'),
  ('diy-kits', 'DIY Kits', 9,
   'Starter, learning and project kits that bundle parts for a complete build.',
   array['starter kit', 'learning kit', 'learning suite', 'robot kit', 'robotics kit', 'stem education', 'project kit', 'inventor kit', 'creator kit', 'bundle'],
   'package')
on conflict (id) do update set
  name = excluded.name, sort_order = excluded.sort_order, description = excluded.description,
  keywords = excluded.keywords, icon = excluded.icon, updated_at = now();

-- Every publish is a new row; the newest row is live. Restoring an old look publishes a copy,
-- so the history reads top to bottom as what customers actually saw.
create table storefront_versions (
  id            bigserial primary key,
  settings      jsonb not null,
  note          text,
  published_by  text not null,
  restored_from bigint references storefront_versions(id),
  created_at    timestamptz not null default now()
);
