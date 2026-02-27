"use client";

import { Avatar, AvatarFallback, Badge, Card, CardContent, FieldDisplay, Icon, Input, Label, Toast, Toaster, useToast } from "@olympusoss/canvas";
import { useState } from "react";
import { ActionBar, FlexBox, PageHeader, ProtectedPage, SectionCard } from "@/components/layout";
import { UserRole } from "@/features/auth";
import { useUser } from "@/features/auth/hooks/useAuth";

export default function ProfilePage() {
	const user = useUser();
	const [isEditing, setIsEditing] = useState(false);
	const [displayName, setDisplayName] = useState(user?.displayName || "");
	const [email, setEmail] = useState(user?.email || "");
	const { toast, show: showToast, dismiss } = useToast();

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
		showToast("Profile updated successfully!", "success");
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
							<Card>
								<CardContent className="flex flex-col items-center gap-4 pt-6">
									<Avatar className="h-20 w-20">
										<AvatarFallback className="text-3xl">{user.displayName.charAt(0)}</AvatarFallback>
									</Avatar>

									<Badge variant={user.role === UserRole.ADMIN ? "default" : "secondary"}>{user.role}</Badge>

									<span className="text-xs text-muted-foreground">Account created: March 1, 2025</span>
								</CardContent>
							</Card>
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

			<Toaster>
				<Toast {...toast} onClose={dismiss} />
			</Toaster>
		</ProtectedPage>
	);
}
