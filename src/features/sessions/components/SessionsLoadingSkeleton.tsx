import { LoadingState } from "@olympusoss/canvas";

interface SessionsLoadingSkeletonProps {
	rows?: number;
}

export const SessionsLoadingSkeleton = ({ rows: _rows = 5 }: SessionsLoadingSkeletonProps) => {
	return <LoadingState variant="section" message="Loading sessions..." />;
};
