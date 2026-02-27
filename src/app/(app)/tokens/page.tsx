"use client";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
	Alert,
	AlertDescription,
	Badge,
	Button,
	Card,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	EmptyState,
	ErrorState,
	Icon,
	Input,
	Label,
	StatCard,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Textarea,
} from "@olympusoss/canvas";
import { useState } from "react";
import { ActionBar, AdminLayout, PageHeader, PageTabs } from "@/components/layout";
import type { IntrospectTokenFormData, OAuth2TokenDetails, TokenFormErrors } from "@/features/oauth2-tokens";
import {
	enhanceTokenDetails,
	getDefaultIntrospectTokenFormData,
	getTokenStatusInfo,
	useOAuth2TokenStats,
	useRevokeOAuth2Token,
	useTokenIntrospectionManager,
	validateIntrospectTokenForm,
} from "@/features/oauth2-tokens";
import type { IntrospectedOAuth2Token } from "@/services/hydra";

// Type for items returned by the token introspection manager
type IntrospectedTokenListItem = IntrospectedOAuth2Token & {
	key: string;
	tokenPreview: string;
	introspectedAt: string;
};

export default function OAuth2TokensPage() {
	const [activeTab, setActiveTab] = useState(0);
	const [introspectFormData, setIntrospectFormData] = useState<IntrospectTokenFormData>(getDefaultIntrospectTokenFormData());
	const [formErrors, setFormErrors] = useState<TokenFormErrors>({});
	const [selectedToken, setSelectedToken] = useState<OAuth2TokenDetails | null>(null);
	const [viewDialogOpen, setViewDialogOpen] = useState(false);
	const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
	const [revokeTokenValue, setRevokeTokenValue] = useState("");

	// Hooks
	const { introspectedTokens, addTokenIntrospection, removeTokenIntrospection, clearAllIntrospections, isIntrospecting, introspectionError } =
		useTokenIntrospectionManager();

	const revokeTokenMutation = useRevokeOAuth2Token();
	const { data: tokenStats } = useOAuth2TokenStats(introspectedTokens);

	const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
		setActiveTab(newValue);
	};

	const handleIntrospectSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		// Validate form
		const validationErrors = validateIntrospectTokenForm(introspectFormData);
		setFormErrors(validationErrors);

		if (Object.keys(validationErrors).length > 0) {
			return;
		}

		try {
			await addTokenIntrospection(introspectFormData);
			setIntrospectFormData(getDefaultIntrospectTokenFormData());
		} catch (error) {
			console.error("Failed to introspect token:", error);
		}
	};

	const handleViewToken = (token: IntrospectedTokenListItem) => {
		setSelectedToken(enhanceTokenDetails(token));
		setViewDialogOpen(true);
	};

	const handleRevokeClick = (token: IntrospectedTokenListItem) => {
		setRevokeTokenValue(token.tokenPreview || "");
		setRevokeDialogOpen(true);
	};

	const handleRevokeConfirm = async () => {
		if (!revokeTokenValue) return;

		try {
			await revokeTokenMutation.mutateAsync({ token: revokeTokenValue });
			setRevokeDialogOpen(false);
			setRevokeTokenValue("");
			// Optionally remove from introspected tokens
			const tokenToRemove = introspectedTokens.find((t: IntrospectedTokenListItem) => t.tokenPreview === revokeTokenValue);
			if (tokenToRemove) {
				removeTokenIntrospection(tokenToRemove.key);
			}
		} catch (error) {
			console.error("Failed to revoke token:", error);
		}
	};

	return (
		<AdminLayout>
			<div className="space-y-6">
				<PageHeader
					title="OAuth2 Access Tokens"
					subtitle="Introspect and manage OAuth2 access tokens"
					icon={<Icon name="key-round" />}
					actions={
						<Button variant="outline" onClick={clearAllIntrospections} disabled={introspectedTokens.length === 0}>
							Clear All
						</Button>
					}
				/>

				{/* Stats Cards */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard title="Introspected Tokens" value={tokenStats?.totalTokens || 0} icon={<Icon name="receipt" />} colorVariant="primary" />
					<StatCard title="Active Tokens" value={tokenStats?.activeTokens || 0} icon={<Icon name="success" />} colorVariant="success" />
					<StatCard title="Expired Tokens" value={tokenStats?.expiredTokens || 0} icon={<Icon name="error" />} colorVariant="error" />
					<StatCard title="Expiring in 24h" value={tokenStats?.tokensExpiringIn24h || 0} icon={<Icon name="time" />} colorVariant="warning" />
				</div>

				{/* Tabs */}
				<Card>
					<PageTabs
						value={activeTab.toString()}
						onChange={(value) => handleTabChange({} as React.SyntheticEvent, parseInt(value, 10))}
						tabs={[
							{ label: "Introspect Token", value: "0" },
							{
								label: `Token List (${introspectedTokens.length})`,
								value: "1",
							},
						]}
					/>

					{activeTab === 0 && (
						<div className="p-6">
							<form onSubmit={handleIntrospectSubmit}>
								<div className="space-y-6">
									<div className="space-y-2">
										<Label htmlFor="token-input">Access Token</Label>
										<Textarea
											id="token-input"
											className="min-h-[120px] font-mono"
											value={introspectFormData.token}
											onChange={(e) =>
												setIntrospectFormData((prev) => ({
													...prev,
													token: e.target.value,
												}))
											}
											placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
											required
										/>
										{formErrors.token ? (
											<p className="text-sm text-destructive">{formErrors.token}</p>
										) : (
											<p className="text-sm text-muted-foreground">Paste the token you want to introspect</p>
										)}
									</div>
									<div className="space-y-2">
										<Label htmlFor="scope-input">Scope (Optional)</Label>
										<Input
											id="scope-input"
											value={introspectFormData.scope}
											onChange={(e) =>
												setIntrospectFormData((prev) => ({
													...prev,
													scope: e.target.value,
												}))
											}
											placeholder="openid profile email"
										/>
										<p className="text-sm text-muted-foreground">Optional scope to check against the token</p>
									</div>
									<div className="flex items-center gap-2">
										<Button type="submit" disabled={isIntrospecting}>
											{isIntrospecting ? <Icon name="loading" /> : <Icon name="search" />}
											{isIntrospecting ? "Introspecting..." : "Introspect Token"}
										</Button>
										<Button variant="outline" type="button" onClick={() => setIntrospectFormData(getDefaultIntrospectTokenFormData())}>
											Clear
										</Button>
									</div>
								</div>
							</form>

							{/* Error Display */}
							{introspectionError && <ErrorState message={`Failed to introspect token: ${introspectionError.message}`} variant="inline" />}
						</div>
					)}

					{activeTab === 1 && (
						<div className="p-6">
							{introspectedTokens.length === 0 ? (
								<EmptyState
									icon={<Icon name="key-round" />}
									title="No tokens introspected yet"
									description='Use the "Introspect Token" tab to analyze OAuth2 tokens'
								/>
							) : (
								<div className="overflow-auto rounded-md border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Token</TableHead>
												<TableHead>Subject</TableHead>
												<TableHead>Client ID</TableHead>
												<TableHead>Scopes</TableHead>
												<TableHead>Status</TableHead>
												<TableHead>Expires</TableHead>
												<TableHead>Actions</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{introspectedTokens.map((token: IntrospectedTokenListItem) => {
												const statusInfo = getTokenStatusInfo(token);
												const expValue = token.exp;
												const expiryDate = expValue ? new Date(expValue * 1000) : null;
												const _isExpired = expiryDate ? expiryDate < new Date() : false;

												return (
													<TableRow key={token.key}>
														<TableCell>
															<code>{token.tokenPreview}</code>
														</TableCell>
														<TableCell>{token.sub || "N/A"}</TableCell>
														<TableCell>{token.client_id || "N/A"}</TableCell>
														<TableCell>
															{token.scope ? (
																<div className="flex flex-wrap gap-1">
																	{token.scope
																		.split(" ")
																		.slice(0, 2)
																		.map((scope: string) => (
																			<Badge key={scope} variant="secondary">
																				{scope}
																			</Badge>
																		))}
																	{token.scope.split(" ").length > 2 && <Badge variant="secondary">+{token.scope.split(" ").length - 2}</Badge>}
																</div>
															) : null}
														</TableCell>
														<TableCell>
															<Badge variant={statusInfo.status === "active" ? "default" : "destructive"}>{statusInfo.displayName}</Badge>
														</TableCell>
														<TableCell>
															{expiryDate ? <span className="text-sm text-muted-foreground">{expiryDate.toLocaleDateString()}</span> : "Never"}
														</TableCell>
														<TableCell>
															<div className="flex items-center gap-1">
																<Button variant="ghost" size="icon" onClick={() => handleViewToken(token)} title="View Details">
																	<Icon name="view" />
																</Button>
																<Button variant="ghost" size="icon" onClick={() => handleRevokeClick(token)} title="Revoke Token">
																	<Icon name="delete" />
																</Button>
															</div>
														</TableCell>
													</TableRow>
												);
											})}
										</TableBody>
									</Table>
								</div>
							)}
						</div>
					)}
				</Card>

				{/* Token Details Dialog */}
				<Dialog open={viewDialogOpen} onOpenChange={(open) => !open && setViewDialogOpen(false)}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<Icon name="shield" />
								Token Details
							</DialogTitle>
						</DialogHeader>
						{selectedToken && (
							<div className="space-y-4">
								{/* Status Banner */}
								<Alert variant={selectedToken.statusInfo?.isActive ? "default" : "destructive"}>
									{selectedToken.statusInfo?.isActive ? <Icon name="success" /> : <Icon name="x-circle" />}
									<AlertDescription>
										Token is {selectedToken.statusInfo?.isActive ? "active" : "inactive/expired"}
										{selectedToken.statusInfo?.timeToExpiry && <> &bull; Expires in {selectedToken.statusInfo.timeToExpiry}</>}
									</AlertDescription>
								</Alert>

								<Accordion type="multiple" defaultValue={["basic"]}>
									{/* Basic Information */}
									<AccordionItem value="basic">
										<AccordionTrigger>Basic Information</AccordionTrigger>
										<AccordionContent>
											<div className="grid gap-3">
												<div className="space-y-1">
													<p className="text-sm font-medium text-muted-foreground">Subject</p>
													<p className="text-sm text-foreground">{selectedToken.sub || "N/A"}</p>
												</div>
												<div className="space-y-1">
													<p className="text-sm font-medium text-muted-foreground">Client ID</p>
													<p className="text-sm text-foreground">{selectedToken.client_id || "N/A"}</p>
												</div>
												<div className="space-y-1">
													<p className="text-sm font-medium text-muted-foreground">Token Type</p>
													<p className="text-sm text-foreground">{selectedToken.tokenTypeFormatted || "N/A"}</p>
												</div>
												<div className="space-y-1">
													<p className="text-sm font-medium text-muted-foreground">Token Use</p>
													<p className="text-sm text-foreground">{selectedToken.token_use || "N/A"}</p>
												</div>
											</div>
										</AccordionContent>
									</AccordionItem>

									{/* Timestamps */}
									<AccordionItem value="timestamps">
										<AccordionTrigger>Timestamps</AccordionTrigger>
										<AccordionContent>
											<div className="grid gap-3">
												<div className="space-y-1">
													<p className="text-sm font-medium text-muted-foreground">Issued At</p>
													<p className="text-sm text-foreground">{selectedToken.issuedAtFormatted || "N/A"}</p>
												</div>
												<div className="space-y-1">
													<p className="text-sm font-medium text-muted-foreground">Expires At</p>
													<p className="text-sm text-foreground">{selectedToken.expiresAtFormatted || "Never"}</p>
												</div>
												{selectedToken.nbf && (
													<div className="space-y-1">
														<p className="text-sm font-medium text-muted-foreground">Not Before</p>
														<p className="text-sm text-foreground">{new Date(selectedToken.nbf * 1000).toLocaleString()}</p>
													</div>
												)}
											</div>
										</AccordionContent>
									</AccordionItem>

									{/* Scopes and Audience */}
									<AccordionItem value="scopes">
										<AccordionTrigger>Scopes &amp; Audience</AccordionTrigger>
										<AccordionContent>
											<div className="grid gap-3">
												<div className="space-y-1">
													<p className="text-sm font-medium text-muted-foreground">Scopes</p>
													<div className="flex flex-wrap gap-1">
														{selectedToken.formattedScopes?.map((scope: string) => (
															<Badge key={scope} variant="outline">
																{scope}
															</Badge>
														)) || <span className="text-sm text-muted-foreground">None</span>}
													</div>
												</div>
												<div className="space-y-1">
													<p className="text-sm font-medium text-muted-foreground">Audience</p>
													<div className="flex flex-wrap gap-1">
														{selectedToken.formattedAudience?.map((aud: string) => (
															<Badge key={aud} variant="secondary">
																{aud}
															</Badge>
														)) || <span className="text-sm text-muted-foreground">None</span>}
													</div>
												</div>
											</div>
										</AccordionContent>
									</AccordionItem>
								</Accordion>
							</div>
						)}
						<DialogFooter>
							<Button variant="outline" onClick={() => setViewDialogOpen(false)}>
								Close
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				{/* Revoke Token Dialog */}
				<Dialog open={revokeDialogOpen} onOpenChange={(open) => !open && setRevokeDialogOpen(false)}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Revoke Token</DialogTitle>
						</DialogHeader>
						<div className="space-y-4">
							<p className="text-sm text-muted-foreground">
								Are you sure you want to revoke this token? This action cannot be undone and will immediately invalidate the token.
							</p>
							<code className="block rounded-md bg-muted px-3 py-2 font-mono text-sm">{revokeTokenValue}</code>
						</div>
						<DialogFooter>
							<ActionBar
								align="right"
								primaryAction={{
									label: revokeTokenMutation.isPending ? "Revoking..." : "Revoke Token",
									onClick: handleRevokeConfirm,
									disabled: revokeTokenMutation.isPending,
								}}
								secondaryActions={[
									{
										label: "Cancel",
										onClick: () => setRevokeDialogOpen(false),
									},
								]}
							/>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				{/* Revoke Error Display */}
				{revokeTokenMutation.error && (
					<Alert variant="destructive">
						<Icon name="error" />
						<AlertDescription>Failed to revoke token: {revokeTokenMutation.error.message}</AlertDescription>
					</Alert>
				)}
			</div>
		</AdminLayout>
	);
}
