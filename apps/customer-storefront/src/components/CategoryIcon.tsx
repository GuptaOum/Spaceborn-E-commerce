import React from 'react';
import {
  BatteryCharging, Bot, Box, Cable, Cog, Cpu, Layers, LayoutGrid, Lightbulb, Monitor, Package, Plane, Printer, Radio,
  ShieldCheck, Wrench, Zap, type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  all: LayoutGrid,
  cpu: Cpu,
  radio: Radio,
  cog: Cog,
  battery: BatteryCharging,
  bot: Bot,
  wrench: Wrench,
  printer: Printer,
  cable: Cable,
  package: Package,
  box: Box,
  zap: Zap,
  layers: Layers,
  plane: Plane,
  lightbulb: Lightbulb,
  monitor: Monitor,
  shield: ShieldCheck,
};

/** Draws the icon an admin picked for a category in Storefront Studio. */
export const CategoryIcon: React.FC<{ icon: string; className?: string; style?: React.CSSProperties }> = ({ icon, className, style }) => {
  const Icon = ICONS[icon] ?? Box;
  return <Icon className={className} style={style} />;
};
