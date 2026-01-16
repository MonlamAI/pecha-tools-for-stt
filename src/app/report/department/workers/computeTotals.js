// src/app/department/workers/computeTotals.js
onmessage = function (e) {
  const users = e.data;

  const totals = users.reduce(
    (acc, user) => {
      acc.noSubmitted += user.noSubmitted || 0;
      acc.noReviewed += user.noReviewed || 0;
      acc.cer += user.cer || 0;
      acc.syllableCount += user.syllableCount || 0;
      return acc;
    },
    { noSubmitted: 0, noReviewed: 0, cer: 0, syllableCount: 0 }
  );

  postMessage(totals);
};
