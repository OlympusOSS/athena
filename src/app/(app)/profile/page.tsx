"use client";

import { Badge, cn, FieldDisplay, Icon, Input, Label } from "@olympus/canvas";
import { useEffect, useState } from "react";
import { ActionBar, FlexBox, PageHeader, ProtectedPage, SectionCard } from "@/components/layout";
import { UserRole } from "@/features/auth";
import { useUser } from "@/features/auth/hooks/useAuth";

export default function ProfilePage() {
	const user = useUser();
	const [isEditing, setIsEditing] = useState(false);
	const [displayName, setDisplayName] = useState(user?.displayName || "");
	const [email, setEmail] = useState(user?.email || "");
	const [showToast, setShowToast] = useState(false);

	// Auto-hide toast after 6 seconds
	useEffect(() => {
		if (showToast) {
			const timer = setTimeout(() => setShowToast(false), 6000);
			return () => clearTimeout(timer);
		}
	}, [showToast]);

	if (!user) {
		return null; // Protected by AdminLayout
	}

	const handleEdit = () => {
		setIsEditing(true);
	};

	const handleCancel = () => {
		setDisplayName(user.displayName);
		setEmail(user.email);
		setIsEditing(false);
	};

	const handleSave = () => {
		// In a real application, this would update the user profile
		// For now, we'll just show a success message
		setIsEditing(false);
		setShowToast(true);
	};

	return (
		<ProtectedPage>
			<div className="space-y-6">
				<div className="space-y-6">
					<PageHeader
						title="User Profile"
						actions={
							!isEditing ? (
								<ActionBar
									primaryAction={{
										label: "Edit Profile",
										icon: <Icon name="edit" />,
										onClick: handleEdit,
									}}
								/>
							) : (
								<ActionBar
									primaryAction={{
										label: "Save",
										icon: <Icon name="save" />,
										onClick: handleSave,
									}}
									secondaryActions={[
										{
											label: "Cancel",
											icon: <Icon name="close" />,
											onClick: handleCancel,
											variant: "outline",
										},
									]}
								/>
							)
						}
					/>

					<div className="grid gap-6 lg:grid-cols-3">
						<div>
							<div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-6">
								<div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-3xl font-bold text-primary-foreground">
									{user.displayName.charAt(0)}
								</div>

								<Badge variant={user.role === UserRole.ADMIN ? "default" : "secondary"}>{user.role}</Badge>

								<span className="text-xs text-muted-foreground">Account created: March 1, 2025</span>
							</div>
						</div>

						<div className="space-y-6 lg:col-span-2">
							<SectionCard
								title={
									<FlexBox align="center" gap={1}>
										<Icon name="user" />
										<span>Personal Information</span>
									</FlexBox>
								}
							>
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="space-y-2">
										{isEditing ? (
											<div className="space-y-2">
												<Label>Display Name</Label>
												<Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
											</div>
										) : (
											<FieldDisplay label="Display Name" value={user.displayName} />
										)}
									</div>

									<div className="space-y-2">
										{isEditing ? (
											<div className="space-y-2">
												<Label>Email Address</Label>
												<Input value={email} onChange={(e) => setEmail(e.target.value)} />
											</div>
										) : (
											<FieldDisplay label="Email Address" value={user.email} />
										)}
									</div>
								</div>
							</SectionCard>

							<SectionCard
								title={
									<FlexBox align="center" gap={1}>
										<Icon name="lock" />
										<span>Account Information</span>
									</FlexBox>
								}
							>
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="space-y-2">
										<FieldDisplay label="Email" value={user.email} />
									</div>

									<div className="space-y-2">
										<FieldDisplay label="Role" value={user.role} valueType="chip" />
									</div>
								</div>
							</SectionCard>
						</div>
					</div>
				</div>
			</div>

			{/* Success Toast */}
			<div
				className={cn("fixed bottom-4 right-4 z-50 transition-all duration-300", showToast ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}
			>
				<div className="flex items-center gap-3 rounded-lg border border-success bg-success/10 px-4 py-3 shadow-lg">
					<span className="text-sm font-medium text-foreground">Profile updated successfully!</span>
					<button type="button" onClick={() => setShowToast(false)} className="ml-2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground">
						<Icon name="close" />
					</button>
				</div>
			</div>
		</ProtectedPage>
	);
}
