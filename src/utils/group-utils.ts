export function mapTaskStats(group: any, taskStats: any[]) {
  const { id, name, department_id, Department } = group;
  const departmentName = Department?.name;

  const taskStatsCount = taskStats.filter((t) => t.group_id === id);

  const getCount = (state: string) =>
    taskStatsCount.find((t) => t.state === state)?._count?._all ?? 0;

  return {
    id,
    name,
    department_id,
    departmentName,
    taskImportedCount: getCount("imported"),
    taskTranscribingCount: getCount("transcribing"),
    taskSubmittedCount: getCount("submitted"),
    taskAcceptedCount: getCount("accepted"),
    taskFinalisedCount: getCount("finalised"),
    taskTrashedCount: getCount("trashed"),
  };
}

export function groupByDepartmentId(groups: any[]) {
  const grouped = groups.reduce((acc, group) => {
    if (!acc[group.department_id]) acc[group.department_id] = [];
    acc[group.department_id].push(group);
    return acc;
  }, {} as Record<number, any[]>);

  return Object.values(grouped);
}
