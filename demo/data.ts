/**
 * Fake inbox for the live demo. Generic first names + an initial, a fictional studio,
 * deterministic (no Math.random) so every visitor and every Lab frame sees the same rows.
 */
export interface Message {
  id: string;
  from: string;
  initials: string;
  subject: string;
  snippet: string;
  body: string[];
  time: string;
  unread: boolean;
}

const PEOPLE = [
  "Ada L.", "Bruno M.", "Chiara P.", "Dev R.", "Elif S.", "Farah K.", "Goran V.", "Hana T.",
  "Ivo B.", "Jun A.", "Kofi D.", "Lena H.", "Mateo C.", "Nia O.", "Omar F.", "Priya N.",
  "Quinn E.", "Rosa G.", "Sami J.", "Tomas W.",
];

const THREADS: [string, string, string][] = [
  ["Room booking for Thursday", "The east studio is free from 14:00. I put us down for two hours", "Shall I add the projector as well? Last time the cable was missing and we lost twenty minutes."],
  ["Invoice 1042 approved", "Finance signed it off this morning, payment goes out on Friday", "If the supplier asks, the reference is the same as the purchase order."],
  ["Draft of the spring brochure", "Attached is v3 with the new photos. Page 4 still needs copy", "Could you look at the captions? They run long on the narrow layout."],
  ["Lunch on the terrace?", "The weather looks good for once. 12:30 by the stairs?", "I'll bring the folding chairs if nobody else does."],
  ["Keys for the archive room", "Front desk has a spare set now, sign it out in the book", "Please return them the same day — there is only one spare."],
  ["Schedule change: Monday stand-up", "We're moving to 9:45 so the late shift can join", "The calendar invite has been updated; no need to reply."],
  ["Feedback on the onboarding flow", "Three people got stuck on the second step, notes inside", "Mostly the button sat below the fold on smaller phones."],
  ["Printer on floor 2", "It's jammed again. I left a note, please don't force it", "The technician comes on Wednesday morning."],
  ["Quarterly numbers", "Summary is in the shared folder, the chart is on slide 6", "Happy to walk anyone through it before the meeting."],
  ["Workshop sign-up", "Eight seats left for the typography session next week", "Bring a laptop; the exercises use the browser only."],
  ["Visitor badge request", "Two guests on the 14th, arriving around ten", "Names are in the form; they'll need Wi-Fi access too."],
  ["Re: website copy", "I trimmed the intro to two sentences, see what you think", "The longer version is still in the doc if we want it back."],
  ["Shared calendar is out of sync", "Some events show twice on tablets", "Removing and re-adding the calendar fixed it for me."],
  ["Plant watering rota", "New rota for October is pinned in the kitchen", "The tall one by the window only needs water on Fridays."],
  ["Photos from the open day", "Uploaded 120 photos, the best ones are starred", "Let me know which ones should go on the noticeboard."],
];

const TIMES = ["09:12", "08:47", "08:05", "Yesterday", "Yesterday", "Mon", "Mon", "Sun", "Sat", "Fri", "Thu", "Wed"];

function initialsOf(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export const MESSAGES: Message[] = Array.from({ length: 40 }, (_, i) => {
  const from = PEOPLE[(i * 7) % PEOPLE.length];
  const [subject, snippet, more] = THREADS[i % THREADS.length];
  const round = Math.floor(i / THREADS.length);
  return {
    id: String(i + 1),
    from,
    initials: initialsOf(from),
    subject: round ? `${subject} (${round + 1})` : subject,
    snippet,
    body: [
      `Hi team,`,
      `${snippet}.`,
      more,
      `This is message ${i + 1} of 40 in the demo inbox. Fold, unfold, or change the width above — the open message stays open, because it lives in the URL (?sel=${i + 1}).`,
      `Thanks,\n${from}`,
    ],
    time: TIMES[Math.min(TIMES.length - 1, Math.floor(i / 3.4))],
    unread: i % 5 === 0 || i % 7 === 2,
  };
});
