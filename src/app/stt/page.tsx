// [Reason] The STT worker interface (previously at `/?session=email`) now lives at
// /stt and derives identity from the authenticated session cookie instead of a
// query param. Workflow/data loading is unchanged (reuses fetchUserDataBySession).
import Link from "next/link";
import { redirect } from "next/navigation";
import AudioTranscript from "@/components/AudioTranscript";
import RightSidebar from "@/components/RightSidebar";
import languagesObject from "../../../data/language";
import {
  fetchUserDataBySession,
  type FetchUserDataResult,
} from "@/service/user-service";
import { getSessionUser } from "@/lib/auth/requireUser";

export const dynamic = "force-dynamic";

export default async function SttPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const language = languagesObject;
  // [Reason] Identity comes from the verified session (user.email), never the URL.
  const result: FetchUserDataResult = await fetchUserDataBySession(user.email);

  return (
    <div className="flex flex-col justify-center items-center overflow-y-auto">
      <div className="w-full flex justify-start px-4 pt-3">
        <Link href="/" className="btn btn-sm btn-ghost">
          ← Home
        </Link>
      </div>
      {"error" in result ? (
        <div className="mt-10 p-5 text-xl font-semibold text-center">
          {result.error}
        </div>
      ) : (
        <AudioTranscript
          tasks={result.userTasks ?? []}
          userDetail={result.userDetail}
          language={language}
          userHistory={result.userHistory}
        />
      )}
      <RightSidebar>
        <iframe
          className="h-full"
          src="https://docs.google.com/spreadsheets/d/1Sn9IO9Gxj0swe7CdZPAsKx3ccBiDAtNHTvBDoMn7iqA/edit?usp=sharing"
        ></iframe>
      </RightSidebar>
    </div>
  );
}
