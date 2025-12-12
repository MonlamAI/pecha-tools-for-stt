export const revalidate = 0; // or: export const dynamic = "force-dynamic";

import { getAllGroup } from "@/model/group";
import Uploadcsv from "./Uploadcsv";

export default async function page() {
  const groupsResult = await getAllGroup();
  const groups = Array.isArray(groupsResult) ? groupsResult : [];
  return (
    <div className="flex justify-center items-center h-screen">
      <Uploadcsv groups={groups} />
    </div>
  );
}
