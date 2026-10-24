import { WorkspaceSkeleton } from "@/components/ui/workspace-skeleton";

export default function Loading() {
  return <WorkspaceSkeleton message="Reading the map. A large repository takes a few seconds." />;
}
