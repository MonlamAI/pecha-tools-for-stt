import Link from "next/link";
import AudioTranscript from "@/components/AudioTranscript";
import RightSidebar from "@/components/RightSidebar";
import languagesObject from "../../data/language";
import { fetchUserDataBySession } from "@/service/user-service";

/*
 * make sure every request is server-rendered with cache: 'no-store' so Next.js doesn’t cache across sessions
 * a temporary fix
 */
export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: any }) {
  const { session } = searchParams;
  const language = languagesObject;
  const { error, userTasks, userDetail, userHistory } =
    await fetchUserDataBySession(session);

  // console.log({ error, userTasks, userDetail, userHistory })
  const routes = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Report", path: "/report" },
    { name: "Stats", path: "/stats" },
    { name: "Upload", path: "/task" },
  ];

  return (
    <div className="flex flex-col justify-center items-center overflow-y-auto">
      {session === undefined || session === "" ? (
        <>
          <div className="text-xl font-semibold mt-10 p-5 text-center">
            please log in to it with correct email - ?session=email
            <span className="block">or</span>
          </div>
          <div className="flex flex-col gap-6 sm:flex-row">
            {routes.map((route) => (
              <Link
                key={route.name}
                href={route.path}
                type="button"
                className="btn btn-accent"
              >
                {route.name}
              </Link>
            ))}
          </div>
        </>
      ) : error ? (
        <div className="mt-10 p-5 text-xl font-semibold text-center">
          {error}
        </div>
      ) : (
        <AudioTranscript
          tasks={userTasks}
          userDetail={userDetail}
          language={language}
          userHistory={userHistory}
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
