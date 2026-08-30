export const REPORT_GROUPS = {
  rl: [
    { id: 'rl-pretest', modules: [1], title: 'Module 1 Pre-test', submission: false, note: 'Offline pre-test. Resources and schedule only.' },
    { id: 'rl-2-3', modules: [2, 3], title: 'Module 2&3 Report', submission: true },
    { id: 'rl-4-5', modules: [4, 5], title: 'Module 4&5 Report', submission: true },
    { id: 'rl-6', modules: [6], title: 'Module 6 Report', submission: true },
    { id: 'rl-7', modules: [7], title: 'Module 7 Report', submission: true },
    { id: 'rl-8', modules: [8], title: 'Module 8 Report', submission: true }
  ],
  idp: [
    { id: 'idp-pretest', modules: [1], title: 'IDP Pre-test', submission: false, note: 'Schedule placeholder. If held online, the assessment will remain on EMAS.' },
    { id: 'idp-2-3', modules: [2, 3], title: 'Module 2&3 Report', submission: true },
    { id: 'idp-4-5', modules: [4, 5], title: 'Module 4&5 Report', submission: true },
    { id: 'idp-6', modules: [6], title: 'Module 6 Report', submission: true },
    { id: 'idp-7', modules: [7], title: 'Module 7 Report', submission: true },
    { id: 'idp-8', modules: [8], title: 'Module 8 Report', submission: true }
  ],
  t3: [
    { id: 't3-1', modules: [1], title: 'Module 1', submission: false },
    { id: 't3-2', modules: [2], title: 'Module 2', submission: false },
    { id: 't3-3', modules: [3], title: 'Module 3', submission: false },
    { id: 't3-4', modules: [4], title: 'Module 4', submission: false },
    { id: 't3-5', modules: [5], title: 'Module 5', submission: false },
    { id: 't3-6', modules: [6], title: 'Module 6', submission: false },
    { id: 't3-7', modules: [7], title: 'Module 7', submission: false },
    { id: 't3-8', modules: [8], title: 'Post-test', submission: false, note: 'Post-test schedule and resources only unless the laboratory enables online submission.' }
  ]
};

export const SUBMISSION_GRACE_MS = 5 * 60 * 1000;
export const MAX_REPORT_BYTES = 30 * 1024 * 1024;

export function submissionClosesAt(deadlineAt) {
  if (!deadlineAt) return null;
  const deadline = new Date(deadlineAt).getTime();
  return Number.isFinite(deadline) ? deadline + SUBMISSION_GRACE_MS : null;
}

export function submissionExpired(deadlineAt, now = Date.now()) {
  const closesAt = submissionClosesAt(deadlineAt);
  return closesAt == null || now > closesAt;
}

export function reportGroupFor(track, moduleNumber) {
  return REPORT_GROUPS[track]?.find((group) => group.modules.includes(Number(moduleNumber))) || null;
}

export function minutesLate(submittedAt, deadlineAt) {
  if (!deadlineAt) return 0;
  return Math.max(0, Math.ceil((new Date(submittedAt).getTime() - new Date(deadlineAt).getTime()) / 60000));
}

export function latePenalty(minutes) {
  return Math.min(100, Math.max(0, minutes) * 10);
}

export function safeFilePart(value) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
}

export function storedFileName({ name, npm, reportGroup, weekNumber }) {
  return `${safeFilePart(name)}_${safeFilePart(npm)}_${safeFilePart(reportGroup)}_Week${weekNumber}.pdf`;
}
