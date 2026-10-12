// Founders First Network — component types.
// Documentation only. The bundle is a classic script on window.FFN.

import type { ReactNode, ChangeEvent, ButtonHTMLAttributes } from 'react';

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
export type ControlSize = 'sm' | 'md' | 'lg';
export type StageId = 'lead' | 'mql' | 'sql' | 'customer' | 'advocate' | 'dormant' | 'lost';

export interface StageDef {
  id: StageId;
  label: string;
  tone: Tone;
  /** One line describing what qualifies a lead for this stage. */
  hint: string;
}

/** The FFN pipeline, in order, including the two off-path stages. */
export declare const stages: StageDef[];

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: ControlSize;
  /** Swaps the label for a spinner and disables the button. Width is held. */
  loading?: boolean;
  block?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  children: ReactNode;
}
export declare function Button(props: ButtonProps): JSX.Element;

export interface BadgeProps {
  tone?: Tone;
  /** Set false to drop the leading dot. The label always stays. */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}
export declare function Badge(props: BadgeProps): JSX.Element;

export interface StageBadgeProps {
  stage: StageId;
  className?: string;
}
export declare const StageBadge: ((props: StageBadgeProps) => JSX.Element) & { stages: StageDef[] };

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}
export declare function Field(props: FieldProps): JSX.Element;

export interface InputProps {
  label?: ReactNode;
  /** Replaced by `error` when that is set. Both are wired to aria-describedby. */
  hint?: ReactNode;
  error?: ReactNode;
  size?: ControlSize;
  /** Sets the value in IBM Plex Mono. Use for IDs, phone numbers and amounts. */
  mono?: boolean;
  required?: boolean;
  id?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}
export declare function Input(props: InputProps): JSX.Element;

export interface TextareaProps extends Omit<InputProps, 'size' | 'mono' | 'type'> {
  rows?: number;
}
export declare function Textarea(props: TextareaProps): JSX.Element;

export interface SelectOption { value: string; label: string }
export interface SelectProps extends Omit<InputProps, 'mono' | 'type'> {
  options: SelectOption[];
  /** Rendered as a leading empty option. */
  placeholder?: string;
}
export declare function Select(props: SelectProps): JSX.Element;

export interface CheckboxProps {
  label: ReactNode;
  hint?: ReactNode;
  checked?: boolean;
  disabled?: boolean;
  id?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}
export declare function Checkbox(props: CheckboxProps): JSX.Element;

export interface SwitchProps {
  label?: ReactNode;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}
export declare function Switch(props: SwitchProps): JSX.Element;

export interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Buttons for the header right side. Keep to two. */
  actions?: ReactNode;
  footer?: ReactNode;
  /** Removes body padding. Use when the body is a DataTable. */
  flush?: boolean;
  /** Adds shadow-sm. Only for a card floating on surface-page. */
  raised?: boolean;
  className?: string;
  children: ReactNode;
}
export declare function Card(props: CardProps): JSX.Element;

export interface StatCardProps {
  label: string;
  /** Pre-formatted by the caller, including currency and separators. */
  value: ReactNode;
  delta?: ReactNode;
  direction?: 'up' | 'down' | 'flat';
  note?: ReactNode;
  className?: string;
}
export declare function StatCard(props: StatCardProps): JSX.Element;

export interface Column<Row = Record<string, unknown>> {
  key: string;
  header: ReactNode;
  align?: 'left' | 'right';
  sortable?: boolean;
  /** Return a cell node. Without it the raw row[key] is printed. */
  render?: (row: Row) => ReactNode;
}
export interface DataTableProps<Row = Record<string, unknown>> {
  columns: Column<Row>[];
  rows: Row[];
  /** Read by screen readers. Always supply one. */
  caption?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  onRowClick?: (row: Row) => void;
  selectedId?: string;
  className?: string;
}
export declare function DataTable<Row>(props: DataTableProps<Row>): JSX.Element;

export interface PipelineStep { id: string; label: string; meta?: string }
export interface PipelineStepperProps {
  /** Defaults to the five on-path FFN stages. */
  steps?: PipelineStep[];
  current: string;
  label?: string;
  className?: string;
}
export declare function PipelineStepper(props: PipelineStepperProps): JSX.Element;

export interface TabItem { id: string; label: ReactNode; count?: number }
export interface TabsProps {
  items: TabItem[];
  active: string;
  onChange?: (id: string) => void;
  className?: string;
}
export declare function Tabs(props: TabsProps): JSX.Element;

export interface AlertProps {
  tone?: Tone;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}
export declare function Alert(props: AlertProps): JSX.Element;

export interface EmptyStateProps {
  title: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}
export declare function EmptyState(props: EmptyStateProps): JSX.Element;

export interface AvatarProps {
  name: string;
  src?: string;
  size?: ControlSize;
  className?: string;
}
export declare function Avatar(props: AvatarProps): JSX.Element;

export interface ActivityItem {
  id?: string;
  title: ReactNode;
  /** Who and when, set in mono. */
  meta: ReactNode;
  /** Quoted content, shown in a sunken block. */
  note?: ReactNode;
  tone?: 'brand' | 'success' | 'warning' | 'danger';
}
export interface ActivityTimelineProps {
  items: ActivityItem[];
  className?: string;
}
export declare function ActivityTimeline(props: ActivityTimelineProps): JSX.Element;

export interface ModalProps {
  open?: boolean;
  title: string;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}
export declare function Modal(props: ModalProps): JSX.Element;

export interface FunnelDatum { name: string; value: number }
export interface FunnelChartProps {
  /** Ordered top to bottom. The first value sets the full-width bar. */
  data: FunnelDatum[];
  label?: string;
  className?: string;
}
export declare function FunnelChart(props: FunnelChartProps): JSX.Element;

export interface TrendSeries { name: string; values: number[] }
export interface TrendChartProps {
  series: TrendSeries[];
  labels: string[];
  width?: number;
  height?: number;
  label?: string;
  className?: string;
}
export declare function TrendChart(props: TrendChartProps): JSX.Element;
