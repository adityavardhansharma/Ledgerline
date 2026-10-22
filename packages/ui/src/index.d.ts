import type * as React from 'react';

type Children = { children?: React.ReactNode };
export type IconName = 'overview' | 'statement' | 'balance' | 'cashflow' | 'forecast' | 'scenario' | 'ledger' | 'sync' | 'audit' | 'team' | 'settings' | 'boardpack' | 'plug' | 'organisation' | 'bank' | 'journal' | 'euro' | 'percent' | 'trend-up' | 'trend-down' | 'runway' | 'invoice' | 'hire' | 'reconcile' | 'database' | 'plus' | 'search' | 'filter' | 'download' | 'upload' | 'external' | 'edit' | 'copy' | 'trash' | 'refresh' | 'branch' | 'compare' | 'sparkle' | 'link' | 'logout' | 'more' | 'grip' | 'chevron-down' | 'chevron-up' | 'chevron-left' | 'chevron-right' | 'arrow-up' | 'arrow-down' | 'arrow-right' | 'close' | 'check' | 'menu' | 'calendar' | 'clock' | 'lock' | 'eye' | 'bell' | 'sun' | 'moon' | 'command' | 'info' | 'warning' | 'error' | 'success' | 'pending';
export type Tone = 'neutral' | 'brand' | 'forecast' | 'scenario' | 'positive' | 'negative' | 'warning';
export type SeriesKind = 'actual' | 'forecast' | 'scenario' | 'band';

/** A line icon on the 24px grid, drawn in currentColor. */
export interface IconProps { name: IconName; size?: 16 | 18 | 20 | 24 | number; title?: string; strokeWidth?: number; className?: string }
/** The Ledgerline mark, with or without the wordmark. */
export interface LogoProps { size?: number; variant?: 'full' | 'mark' }
export interface SpinnerProps { label?: string }
/** Starts an action. Verb-first, sentence-case label. */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'secondary' | 'ghost' | 'forecast' | 'danger'; size?: 'sm' | 'md' | 'lg'; icon?: IconName; iconRight?: IconName; loading?: boolean; block?: boolean }
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { icon: IconName; label: string; variant?: 'ghost' | 'outline' | 'primary'; size?: 'sm' | 'md' }
export interface KbdProps extends Children {}
export interface FieldProps extends Children { id: string; label?: string; hint?: string; error?: string; optional?: boolean }
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { id: string; label?: string; hint?: string; error?: string; prefix?: string; suffix?: string; icon?: IconName; numeric?: boolean; optional?: boolean }
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> { id: string; label?: string; hint?: string; error?: string; options: Array<string | { value: string; label: string }> }
export interface CheckboxProps { id: string; label?: string; checked?: boolean; defaultChecked?: boolean; disabled?: boolean; onChange?: (checked: boolean) => void }
export interface RadioGroupProps { name: string; label?: string; options: Array<{ value: string; label: string; hint?: string }>; value?: string; defaultValue?: string; onChange?: (value: string) => void }
export interface SwitchProps { id: string; label: string; hint?: string; checked?: boolean; defaultChecked?: boolean; disabled?: boolean; onChange?: (on: boolean) => void }
export interface SliderProps { id: string; label: string; min: number; max: number; step?: number; value?: number; defaultValue?: number; format?: (v: number) => string; marks?: number[]; onChange?: (v: number) => void }
export interface SegmentedControlProps { options: Array<{ value: string; label: string; icon?: IconName }>; value?: string; defaultValue?: string; onChange?: (v: string) => void; size?: 'sm' | 'md'; label?: string }
export interface TabsProps { tabs: Array<{ id: string; label: string; count?: number }>; value?: string; defaultValue?: string; onChange?: (id: string) => void; label?: string }
export interface BadgeProps extends Children { tone?: Tone; icon?: IconName }
export interface StatusPillProps extends Children { status: 'synced' | 'syncing' | 'error' | 'stale' | 'draft' | 'actual' | 'forecast' | 'matched' | 'mismatch' | 'connected' | 'disconnected' }
export interface AvatarProps { name: string; size?: number; square?: boolean }
export interface TooltipProps extends Children { content: React.ReactNode; focusable?: boolean; open?: boolean }
export interface SkeletonProps { width?: number | string; height?: number; lines?: number }
export interface ProgressBarProps { value: number; label?: string; tone?: 'forecast' | 'warning' }
/** Every money figure: tabular, negatives in parentheses, zero as an en dash. */
export interface AmountProps { value: number; currency?: 'EUR' | 'GBP' | 'USD'; compact?: boolean; decimals?: number; forecast?: boolean; strong?: boolean; size?: 'lg' | 'xl'; tone?: 'auto' | 'plain'; symbol?: boolean; title?: string }
/** A variance; coloured by whether it is good for the business. */
export interface DeltaProps { value: number | null | undefined; invert?: boolean; label?: string; decimals?: number }
export interface SparklineProps { data: number[]; forecastFrom?: number; width?: number; height?: number; tone?: 'negative'; label?: string }
export interface ChartLegendProps { items: Array<{ name: string; kind?: SeriesKind; swatch?: number | null }> }
export interface Series { name: string; kind?: SeriesKind; values: Array<number | null> }
export interface LineChartProps { labels: string[]; series: Array<Series & { lower?: Array<number | null>; upper?: Array<number | null>; opacity?: number }>; todayLabel?: string; thresholds?: Array<{ value: number; label: string; tone?: 'negative' | 'warning' }>; scenarioArea?: boolean; forecastFrom?: number; height?: number; format?: (v: number) => string; zero?: boolean; endLabels?: boolean; legend?: boolean; area?: boolean; caption?: string; label?: string; negativeNote?: string }
export interface BarChartProps { labels: string[]; values?: number[]; series?: Array<{ name: string; values: number[]; swatch?: number }>; target?: number; targetLabel?: string; valueLabels?: boolean; seriesName?: string; forecastFrom?: number; highlight?: number; height?: number; format?: (v: number) => string; legend?: Array<{ name: string; kind?: SeriesKind }>; caption?: string; label?: string }
export interface WaterfallChartProps { steps: Array<{ label: string; value: number; kind?: 'start' | 'end' }>; height?: number; caption?: string; label?: string }
export interface RunwayBarProps { months: number; max?: number; compare?: number; compareLabel?: string; caption?: string }
export interface KpiTileProps { icon?: IconName; tone?: 'brand' | 'forecast' | 'warning' | 'negative' | 'positive'; sparkTone?: 'negative' | 'forecast'; label: string; value: number | null; format?: 'money' | 'pct' | 'months' | 'days' | 'ratio'; compact?: boolean; delta?: number; invert?: boolean; deltaLabel?: string; spark?: number[]; forecastFrom?: number; status?: StatusPillProps['status']; note?: string }
export interface StatementRow { type: 'section' | 'line' | 'subtotal' | 'total' | 'spacer'; label?: string; code?: string; values?: number[]; note?: string; tone?: 'plain' }
export interface FinancialStatementProps { columns: Array<{ label: string; kind?: string; period?: string }>; rows: StatementRow[]; forecastFrom?: number; totalColumn?: boolean; onDrill?: (row: StatementRow, columnIndex: number) => void; drillable?: boolean; dense?: boolean; title?: string; selected?: string; flags?: Record<string, { text: string }> }
export interface LedgerLine { date: string; journal: string; code: string; account: string; contact?: string; description: string; debit?: number; credit?: number }
export interface LedgerTableProps { lines: LedgerLine[]; totals?: boolean; hide?: Array<'date' | 'journal' | 'account' | 'contact' | 'description'> }
export interface DataTableProps<R = any> { columns: Array<{ key: string; label: string; numeric?: boolean; render?: (row: R) => React.ReactNode }>; rows: R[]; selected?: number }
export interface ReconcileCheckProps { status: 'match' | 'mismatch'; report?: string; checkedAt?: string; lines?: number; diff?: number; detail?: string; action?: React.ReactNode }
export interface BannerProps extends Children { tone?: 'info' | 'positive' | 'warning' | 'negative'; title?: string; action?: React.ReactNode; onClose?: () => void; icon?: IconName }
export interface ToastProps extends Children { tone?: 'info' | 'positive' | 'warning' | 'negative'; title: string; action?: React.ReactNode; onClose?: () => void }
export interface EmptyStateProps extends Children { icon?: IconName; title: string; action?: React.ReactNode; compact?: boolean }
export interface SyncProgressProps { org?: string; title?: string; pagesDone: number; pagesTotal?: number | null; journals?: number; eta?: string; phase: number; phases?: string[]; /** Replaces the page and journal count line. */ meta?: string }
export interface StepperProps { steps: Array<{ title: string; hint?: string }>; current: number }
export interface DialogProps extends Children { title: string; footer?: React.ReactNode; onClose?: () => void; size?: 'sm' | 'md'; inline?: boolean }
export interface DrawerProps extends Children { title: string; eyebrow?: string; subtitle?: string; footer?: React.ReactNode; onClose?: () => void; inline?: boolean }
export interface MenuItem { label?: string; icon?: IconName; kbd?: string; danger?: boolean; active?: boolean; divider?: boolean; heading?: string; onClick?: () => void }
export interface MenuProps { items: MenuItem[]; label?: string }
export interface CommandPaletteProps { query?: string; groups: Array<{ label: string; items: Array<{ icon: IconName; label: string; meta?: string; kbd?: string; active?: boolean }> }> }
export interface BreadcrumbsProps { items: string[] }
export interface PaginationProps { page: number; pages: number; from: number; to: number; total: number }
export interface NavItemProps { kbd?: string; href?: string; linkAs?: React.ElementType; rail?: boolean; id: string; label: string; icon: IconName; active?: boolean; badge?: string }
export interface OrgSwitcherProps { name: string; meta?: string }
export interface SidebarProps { linkAs?: React.ElementType; settingsHref?: string; orgSwitcher?: React.ReactNode; userMenu?: React.ReactNode; onSearch?: () => void; onSettings?: () => void; rail?: boolean; runway?: number | null; syncText?: string; syncing?: boolean; active?: string; org?: string; orgMeta?: string; user?: string; role?: string; items?: ReadonlyArray<NavItemProps | { heading: string }> }
export interface PeriodPickerProps { label?: string; onClick?: () => void }
export interface MonthGridProps { year?: number; from: number; to: number; forecastFrom?: number }
export interface ScenarioSwitcherProps { name?: string; options?: Array<{ id: string; name: string; base?: boolean; active?: boolean }>; onSelect?: (id: string) => void }
export interface TopbarProps extends Children { subtitle?: string; title: string; breadcrumbs?: string[]; status?: React.ReactNode }
export interface AppShellProps extends Children { sidebar?: Partial<SidebarProps>; rail?: boolean; subtitle?: string; runway?: number | null; syncText?: string; syncing?: boolean; active?: string; title: string; breadcrumbs?: string[]; status?: React.ReactNode; actions?: React.ReactNode; overlay?: React.ReactNode; org?: string }
export interface PanelProps extends Children { icon?: IconName; tone?: string; title?: string; subtitle?: string; actions?: React.ReactNode; flush?: boolean; className?: string }
export interface AssumptionFieldProps { onChange?: (value: number) => void; id: string; label: string; min: number; max: number; step?: number; unit?: string; value?: number; defaultValue?: number; base?: number; format?: (v: number) => string; help?: string }
export interface HireRowProps { onRemove?: () => void; role: string; start: string; salary: number; count?: number; monthly: number }
export interface Scenario { name: string; base?: boolean; parent?: string; changes?: number; runway: number; cash: number; ebitda: number; minCash?: number; revenue?: number }
export interface ScenarioCardProps extends Omit<Scenario, 'runway' | 'cash' | 'ebitda'> { runway: number | null; cash: number | null; ebitda: number | null; active?: boolean; compare?: boolean; horizon?: number; cashLabel?: string; ebitdaLabel?: string; menu?: React.ReactNode; onSelect?: () => void }
export interface CompareSide { name: string; runway: number | null; cash: number | null; ebitda: number | null; minCash: number | null; revenue: number | null }
export interface ScenarioCompareProps { a: CompareSide; b: CompareSide; horizon?: number; cashLabel?: string }
export interface AuditItemProps { actor: string; action: string; target?: string; detail?: string; at: string; icon?: IconName; tone?: 'brand' | 'forecast' | 'positive' | 'negative' }
export interface AuditTimelineProps { groups: Array<{ day: string; items: AuditItemProps[] }> }
export interface IntegrationCardProps { name: string; org: string; status: StatusPillProps['status']; facts?: Array<[string, React.ReactNode]>; actions?: React.ReactNode }
export interface CommentaryCardProps { paragraphs: Array<Array<string | { text: string; source: string }>>; meta?: string; tag?: string; /** Buttons for the card's footer; none are shown without them. */ actions?: React.ReactNode }

type C<P> = (props: P) => React.ReactElement | null;
export declare const Icon: C<IconProps>; export declare const Logo: C<LogoProps>; export declare const Spinner: C<SpinnerProps>;
export declare const Button: C<ButtonProps>; export declare const IconButton: C<IconButtonProps>; export declare const Kbd: C<KbdProps>;
export declare const Field: C<FieldProps>; export declare const Input: C<InputProps>; export declare const Select: C<SelectProps>;
export declare const Checkbox: C<CheckboxProps>; export declare const RadioGroup: C<RadioGroupProps>; export declare const Switch: C<SwitchProps>;
export declare const Slider: C<SliderProps>; export declare const SegmentedControl: C<SegmentedControlProps>; export declare const Tabs: C<TabsProps>;
export declare const Badge: C<BadgeProps>; export declare const StatusPill: C<StatusPillProps>; export declare const Avatar: C<AvatarProps>;
export declare const Tooltip: C<TooltipProps>; export declare const Skeleton: C<SkeletonProps>; export declare const ProgressBar: C<ProgressBarProps>;
export declare const Amount: C<AmountProps>; export declare const Delta: C<DeltaProps>; export declare const Sparkline: C<SparklineProps>;
export declare const ChartLegend: C<ChartLegendProps>; export declare const LineChart: C<LineChartProps>; export declare const BarChart: C<BarChartProps>;
export declare const WaterfallChart: C<WaterfallChartProps>; export declare const RunwayBar: C<RunwayBarProps>; export declare const KpiTile: C<KpiTileProps>;
export declare const FinancialStatement: C<FinancialStatementProps>; export declare const LedgerTable: C<LedgerTableProps>; export declare const DataTable: C<DataTableProps>;
export declare const ReconcileCheck: C<ReconcileCheckProps>; export declare const Banner: C<BannerProps>; export declare const Toast: C<ToastProps>;
export declare const EmptyState: C<EmptyStateProps>; export declare const SyncProgress: C<SyncProgressProps>; export declare const Stepper: C<StepperProps>;
export declare const Dialog: C<DialogProps>; export declare const Drawer: C<DrawerProps>; export declare const Menu: C<MenuProps>;
export declare const CommandPalette: C<CommandPaletteProps>; export declare const Breadcrumbs: C<BreadcrumbsProps>; export declare const Pagination: C<PaginationProps>;
export declare const NavItem: C<NavItemProps>; export declare const OrgSwitcher: C<OrgSwitcherProps>; export declare const Sidebar: C<SidebarProps>;
export declare const PeriodPicker: C<PeriodPickerProps>; export declare const MonthGrid: C<MonthGridProps>; export declare const ScenarioSwitcher: C<ScenarioSwitcherProps>;
export declare const Topbar: C<TopbarProps>; export declare const AppShell: C<AppShellProps>; export declare const Panel: C<PanelProps>;
export declare const AssumptionField: C<AssumptionFieldProps>; export declare const HireRow: C<HireRowProps>; export declare const ScenarioCard: C<ScenarioCardProps>;
export declare const ScenarioCompare: C<ScenarioCompareProps>; export declare const AuditItem: C<AuditItemProps>; export declare const AuditTimeline: C<AuditTimelineProps>;
export declare const IntegrationCard: C<IntegrationCardProps>; export declare const CommentaryCard: C<CommentaryCardProps>;
export interface SankeyChartProps { nodes: Array<{ id: string; label: string; col: number; tone?: string; emphasis?: boolean }>; links: Array<{ source: string; target: string; value: number }>; height?: number; labelWidth?: number; format?: (v: number) => string; caption?: string; label?: string }
export interface RunwayGaugeProps { months: number; max?: number; size?: number; cashOut?: string; note?: string; capped?: boolean; compare?: number; compareLabel?: string }
export interface TornadoChartProps { base: number; rows: Array<{ label: string; range?: string; low: number; high: number }>; unit?: string; lowLabel?: string; highLabel?: string; baseLabel?: string }
export interface CalendarHeatmapProps { days: Array<{ date: string; value: number; note?: string; label?: string }>; cell?: number; hint?: string; label?: string }
export interface TreemapProps { items: Array<{ label: string; value: number; swatch?: number }>; height?: number; caption?: string; label?: string; legend?: boolean }
export interface DonutChartProps { items: Array<{ label: string; value: number; swatch?: number }>; size?: number; thickness?: number; centerLabel?: string; legend?: boolean; label?: string }
export interface BulletChartProps { rows: Array<{ label: string; actual: number; target: number; max: number; bands?: number[]; invert?: boolean; format?: (v: number) => string }> }
export interface BalanceBarsProps { assets: Array<{ label: string; value: number; swatch: number }>; liabilities: Array<{ label: string; value: number; swatch: number }>; equity: Array<{ label: string; value: number; swatch: number; group?: 'equity' }> }
export interface HeroMetricProps { label: string; icon?: IconName; value: number; delta?: number; invert?: boolean; deltaLabel?: string; meta?: string; aside?: React.ReactNode; children?: React.ReactNode }
export interface DeltaPillProps { value: number; invert?: boolean; label?: string; decimals?: number }
export interface MiniRunwayProps { months: number; syncText?: string; syncing?: boolean }
export interface AgedDebtorsProps { buckets: Array<{ label: string; value: number }>; totalLabel?: string }
export declare const SankeyChart: C<SankeyChartProps>; export declare const RunwayGauge: C<RunwayGaugeProps>; export declare const TornadoChart: C<TornadoChartProps>;
export declare const CalendarHeatmap: C<CalendarHeatmapProps>; export declare const Treemap: C<TreemapProps>; export declare const DonutChart: C<DonutChartProps>;
export declare const BulletChart: C<BulletChartProps>; export declare const BalanceBars: C<BalanceBarsProps>; export declare const HeroMetric: C<HeroMetricProps>;
export declare const DeltaPill: C<DeltaPillProps>; export declare const MiniRunway: C<MiniRunwayProps>; export declare const AgedDebtors: C<AgedDebtorsProps>;
export declare function formatMoney(value: number, options?: { currency?: string; compact?: boolean; decimals?: number; symbol?: boolean; showZero?: boolean }): string;
export declare function formatPct(value: number, decimals?: number): string;
export declare const iconNames: IconName[];
/** The sample company used by every preview: Kestrel Joinery Ltd, FY 2026, actuals to 30 Sep. */
export declare const demo: Record<string, any>;

declare const api: Record<string, unknown>;
export default api;
