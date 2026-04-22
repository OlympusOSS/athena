"use client";

import {
	Badge,
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	cn,
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Icon,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Switch,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@olympusoss/canvas";
import { useCallback, useEffect, useState } from "react";

interface VaultSetting {
	key: string;
	value: string;
	encrypted: boolean;
	category: string;
	updated_at: string;
}

const CATEGORIES = ["general", "captcha", "security", "smtp", "oauth"];

export function SettingsVaultSection() {
	const [settings, setSettings] = useState<VaultSetting[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Add/Edit dialog state
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingKey, setEditingKey] = useState<string | null>(null);
	const [formKey, setFormKey] = useState("");
	const [formValue, setFormValue] = useState("");
	const [formEncrypted, setFormEncrypted] = useState(false);
	const [formCategory, setFormCategory] = useState("general");
	const [saving, setSaving] = useState(false);

	// Delete confirmation state
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deletingKey, setDeletingKey] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);

	// Filter state
	const [filterCategory, setFilterCategory] = useState<string>("all");

	const fetchSettings = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const url = filterCategory !== "all" ? `/api/settings?category=${filterCategory}` : "/api/settings";
			const res = await fetch(url);
			if (!res.ok) throw new Error("Failed to fetch settings");
			const data = await res.json();
			setSettings(data.settings || []);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load settings");
		} finally {
			setLoading(false);
		}
	}, [filterCategory]);

	useEffect(() => {
		fetchSettings();
	}, [fetchSettings]);

	const resetForm = () => {
		setFormKey("");
		setFormValue("");
		setFormEncrypted(false);
		setFormCategory("general");
		setEditingKey(null);
	};

	const handleOpenAdd = () => {
		resetForm();
		setDialogOpen(true);
	};

	const handleOpenEdit = (setting: VaultSetting) => {
		setEditingKey(setting.key);
		setFormKey(setting.key);
		setFormValue(""); // Don't pre-fill value (may be encrypted)
		setFormEncrypted(setting.encrypted);
		setFormCategory(setting.category);
		setDialogOpen(true);
	};

	const handleSave = async () => {
		if (!formKey.trim()) return;

		setSaving(true);
		try {
			const res = await fetch("/api/settings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					key: formKey.trim(),
					value: formValue,
					encrypted: formEncrypted,
					category: formCategory,
				}),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error || "Failed to save setting");
			}

			setDialogOpen(false);
			resetForm();
			await fetchSettings();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save");
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!deletingKey) return;

		setDeleting(true);
		try {
			const res = await fetch(`/api/settings/${encodeURIComponent(deletingKey)}`, {
				method: "DELETE",
			});

			if (!res.ok) throw new Error("Failed to delete setting");

			setDeleteDialogOpen(false);
			setDeletingKey(null);
			await fetchSettings();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete");
		} finally {
			setDeleting(false);
		}
	};

	const formatDate = (dateStr: string) => {
		try {
			return new Date(dateStr).toLocaleString();
		} catch {
			return dateStr;
		}
	};

	// Group settings by category
	const grouped = settings.reduce<Record<string, VaultSetting[]>>((acc, s) => {
		const cat = s.category || "general";
		if (!acc[cat]) acc[cat] = [];
		acc[cat].push(s);
		return acc;
	}, {});

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="text-base">Application Settings</CardTitle>
					<div className="flex items-center gap-2">
						<Select value={filterCategory} onValueChange={setFilterCategory}>
							<SelectTrigger className="w-[140px] h-8 text-xs">
								<SelectValue placeholder="Filter..." />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All categories</SelectItem>
								{CATEGORIES.map((cat) => (
									<SelectItem key={cat} value={cat}>
										{cat}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
							<DialogTrigger asChild>
								<Button size="sm" onClick={handleOpenAdd}>
									<Icon name="Plus" className="h-3.5 w-3.5" />
									Add Setting
								</Button>
							</DialogTrigger>

							<DialogContent>
								<DialogHeader>
									<DialogTitle>{editingKey ? "Edit Setting" : "Add Setting"}</DialogTitle>
									<DialogDescription>
										{editingKey ? `Update the value for "${editingKey}".` : "Add a new key-value setting to the vault."}
									</DialogDescription>
								</DialogHeader>

								<div className="space-y-4 py-2">
									<div className="space-y-1.5">
										<Label htmlFor="setting-key" className="text-xs">
											Key
										</Label>
										<Input
											id="setting-key"
											placeholder="e.g. captcha.enabled"
											value={formKey}
											onChange={(e) => setFormKey(e.target.value)}
											disabled={!!editingKey}
											className="text-sm"
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="setting-value" className="text-xs">
											Value
										</Label>
										<Input
											id="setting-value"
											placeholder={formEncrypted ? "Enter secret value (will be encrypted)" : "Enter value"}
											value={formValue}
											onChange={(e) => setFormValue(e.target.value)}
											type={formEncrypted ? "password" : "text"}
											className="text-sm"
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="setting-category" className="text-xs">
											Category
										</Label>
										<Select value={formCategory} onValueChange={setFormCategory}>
											<SelectTrigger className="text-sm">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{CATEGORIES.map((cat) => (
													<SelectItem key={cat} value={cat}>
														{cat}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									<div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
										<div className="space-y-0.5">
											<Label className="text-xs font-medium">Encrypt value</Label>
											<p className="text-[11px] text-muted-foreground">Store this value encrypted at rest (AES-256-GCM)</p>
										</div>
										<Switch checked={formEncrypted} onCheckedChange={setFormEncrypted} />
									</div>
								</div>

								<DialogFooter>
									<DialogClose asChild>
										<Button variant="outline" size="sm">
											Cancel
										</Button>
									</DialogClose>
									<Button size="sm" onClick={handleSave} disabled={!formKey.trim() || saving}>
										{saving ? "Saving..." : "Save"}
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>
				</div>
			</CardHeader>

			<CardContent className="pt-0">
				{error && <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}

				{loading ? (
					<div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
						<Icon name="LoaderCircle" className="mr-2 h-4 w-4 animate-spin" />
						Loading settings...
					</div>
				) : settings.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<Icon name="Settings" className="mb-2 h-8 w-8 text-muted-foreground/50" />
						<p className="text-sm text-muted-foreground">No settings configured yet</p>
						<p className="text-xs text-muted-foreground/70">Add your first setting to get started</p>
					</div>
				) : (
					<div className="space-y-4">
						{Object.entries(grouped).map(([category, items]) => (
							<div key={category}>
								<div className="mb-2 flex items-center gap-2">
									<Badge variant="secondary" className="text-[10px] px-1.5 py-0 uppercase">
										{category}
									</Badge>
									<span className="text-[11px] text-muted-foreground">
										{items.length} {items.length === 1 ? "setting" : "settings"}
									</span>
								</div>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="text-xs w-[30%]">Key</TableHead>
											<TableHead className="text-xs w-[35%]">Value</TableHead>
											<TableHead className="text-xs w-[15%]">Updated</TableHead>
											<TableHead className="text-xs w-[20%] text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{items.map((setting) => (
											<TableRow key={setting.key}>
												<TableCell className="text-sm font-mono">{setting.key}</TableCell>
												<TableCell>
													<div className="flex items-center gap-1.5">
														{setting.encrypted && <Icon name="Lock" className="h-3 w-3 text-muted-foreground" />}
														<code
															className={cn(
																"rounded bg-muted px-1.5 py-0.5 text-xs",
																setting.encrypted ? "text-muted-foreground" : "text-foreground",
															)}
														>
															{setting.value}
														</code>
													</div>
												</TableCell>
												<TableCell className="text-xs text-muted-foreground">{formatDate(setting.updated_at)}</TableCell>
												<TableCell className="text-right">
													<div className="flex items-center justify-end gap-1">
														<Button variant="ghost" size="sm" onClick={() => handleOpenEdit(setting)} className="h-7 w-7 p-0">
															<Icon name="Pencil" className="h-3.5 w-3.5" />
														</Button>
														<Button
															variant="ghost"
															size="sm"
															onClick={() => {
																setDeletingKey(setting.key);
																setDeleteDialogOpen(true);
															}}
															className="h-7 w-7 p-0 text-destructive hover:text-destructive"
														>
															<Icon name="Trash2" className="h-3.5 w-3.5" />
														</Button>
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						))}
					</div>
				)}

				{/* Delete confirmation dialog */}
				<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Delete Setting</DialogTitle>
							<DialogDescription>
								Are you sure you want to delete <code className="rounded bg-muted px-1 py-0.5 text-xs font-bold">{deletingKey}</code>? This action
								cannot be undone.
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<DialogClose asChild>
								<Button variant="outline" size="sm">
									Cancel
								</Button>
							</DialogClose>
							<Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
								{deleting ? "Deleting..." : "Delete"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</CardContent>
		</Card>
	);
}
