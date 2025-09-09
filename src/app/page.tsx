import Link from "next/link";
import { getUserTask } from "../model/action";
import AudioTranscript from "@/components/AudioTranscript";
import RightSidebar from "@/components/RightSidebar";
import languagesObject from "../../data/language";
import prisma from "@/service/db";
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

  // let userTasks;
  // let userDetail;
  // let errMsg;
  // let userHistory;

  // const users = await prisma.User.findMany({
  //   include: {
  //     group: true,                // include the Group each user belongs to
  //     transcriber_task: true,     // tasks where they're transcriber
  //     reviewer_task: true,        // tasks where they're reviewer
  //     final_reviewer_task: true,  // tasks where they're final reviewer
  //   }
  // });
  // console.log('useeffect:', users);
  // prisma.user.findMany().then((result: any) => {
  //   console.log({ result })
  // })

  // if (session && session !== "") {
  //   const result = await getUserTask(session);
  //   if (result?.error) {
  //     errMsg = result?.error;
  //   } else {
  //     userTasks = result?.userTasks;
  //     userDetail = result?.userData;
  //     userHistory = result?.userHistory;
  //   }
  // }

  const routes = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Report", path: "/report" },
    { name: "Stats", path: "/stats" },
    { name: "Upload", path: "/task" },
  ];

  // return (
  //   <pre>
  //     {JSON.stringify({ error, userTasks, userDetail, userHistory }, null, 2)}
  //   </pre>
  // );
  return (
    <div className="flex flex-col justify-center items-center overflow-y-auto">
      {session === undefined || session === "" ? (
        <>
          <div className="text-xl font-semibold mt-10 p-5 text-center">
            please log in to it with correct username - ?session=username
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
