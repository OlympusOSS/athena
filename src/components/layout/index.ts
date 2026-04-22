// Layout Components Barrel Export
// Primitives (PageHeader/ActionBar/SectionCard/PageTabs) are now Canvas exports;
// re-exported here for call-site compatibility. Shell/Header/Sidebar are
// app-specific compositions that wrap Canvas primitives.

export {
	ActionBar,
	type ActionBarProps,
	FlexBox,
	type FlexBoxProps,
	PageHeader,
	type PageHeaderProps,
	PageTabs,
	type PageTabsProps,
	Section,
	SectionCard,
	type SectionCardProps,
	type SectionProps,
	StatCard,
	type StatCardProps,
} from "@olympusoss/canvas";

export { AdminLayout } from "./AdminLayout";
export { Footer } from "./Footer";
export { Header } from "./Header";
export { ProtectedPage, type ProtectedPageProps } from "./ProtectedPage";
export { Sidebar } from "./Sidebar";
