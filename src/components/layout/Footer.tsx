import { Link } from "@mui/material";
import type React from "react";
import { Box, Typography } from "@/components/ui";

const Footer: React.FC = () => {
	return (
		<Box
			component="footer"
			sx={{
				py: 2,
				px: 3,
				mt: "auto",
				borderTop: 1,
				borderColor: "divider",
				backgroundColor: "background.paper",
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
			}}
		>
			<Typography
				variant="body"
				size="sm"
				sx={{
					color: "text.secondary",
					display: "flex",
					alignItems: "center",
					gap: 0.5,
				}}
			>
				Built by{" "}
				<Link
					target="_blank"
					rel="noopener noreferrer"
					color="primary"
					sx={{
						textDecoration: "none",
						fontWeight: "medium",
						"&:hover": {
							textDecoration: "underline",
						},
					}}
				>
				</Link>
			</Typography>
		</Box>
	);
};

export default Footer;
