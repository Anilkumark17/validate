/**
 * Curated few-shot examples. They teach output structure, specificity and tone.
 * They are demonstrations, never research about the user's customers, and are not copied into projects.
 * Selection is deterministic keyword scoring: a vector database is not needed for a handful of examples.
 */

export interface ExampleStakeholder {
  id: string;
  roleName: string;
  description: string;
  whyItMatters: string;
  relevance: number;
  interviewPriority: "high" | "medium" | "low";
  recruitmentCriteria: string;
  interviewQuestions: string[];
  expectedEvidence: string;
}

export interface ExampleAssumption {
  id: string;
  title: string;
  description: string;
  category: string;
  rationale: string;
  impact: number;
  uncertainty: number;
  provisional: boolean;
  validationMethod: string;
  validationQuestions: string[];
  experimentDescription: string;
  /** a threshold proposed before research, never a result */
  successCriteria: string;
  stakeholderIds: string[];
}

export interface FewShotExample {
  id: string;
  domain: string;
  keywords: string[];
  project: { name: string; description: string; audience: string | null };
  stakeholders: ExampleStakeholder[];
  assumptions: ExampleAssumption[];
  summary: string;
}

const mealmate: FewShotExample = {
  id: "food-household-planning",
  domain: "Food and household planning",
  keywords: ["meal", "cook", "cooking", "dinner", "recipe", "recipes", "grocery", "groceries", "ingredient", "ingredients", "family", "parent", "parents", "kitchen", "food", "household", "diet", "nutrition"],
  project: {
    name: "MealMate",
    description: "An app that helps busy parents decide what to cook every day based on their family's preferences and available ingredients.",
    audience: "Busy parents who plan family meals",
  },
  stakeholders: [
    {
      id: "s1",
      roleName: "Parents who regularly plan or prepare family meals",
      description: "The person who decides what the family eats on most days and usually cooks it.",
      whyItMatters: "They feel the daily decision effort and would adopt or reject the product.",
      relevance: 5,
      interviewPriority: "high",
      recruitmentCriteria: "Cooks for a household with children at least four evenings a week; has planned meals in the last month.",
      interviewQuestions: ["Tell me about the last time you had to decide what to cook for dinner. What happened?"],
      expectedEvidence: "Specific recent stories of how dinner decisions get made, and what was tried to make them easier.",
    },
    {
      id: "s2",
      roleName: "Family members who influence meal preferences",
      description: "Partners and older children whose likes, dislikes and dietary needs shape what can be cooked.",
      whyItMatters: "A suggestion only works if the family will actually eat it.",
      relevance: 3,
      interviewPriority: "medium",
      recruitmentCriteria: "Lives in a household where meals are cooked for several people with different preferences.",
      interviewQuestions: ["Tell me about the last family dinner that went well or badly. What made the difference?"],
      expectedEvidence: "How preferences are expressed and handled when a meal is chosen.",
    },
    {
      id: "s3",
      roleName: "People responsible for household grocery shopping",
      description: "Whoever buys the food, who may not be the person who cooks.",
      whyItMatters: "Suggestions depend on what is actually in the house and what gets bought.",
      relevance: 4,
      interviewPriority: "medium",
      recruitmentCriteria: "Did the main grocery shop for the household in the last two weeks.",
      interviewQuestions: ["Walk me through your last grocery trip, from deciding what to buy to unpacking."],
      expectedEvidence: "How shopping lists are made and how well they match what gets cooked.",
    },
  ],
  assumptions: [
    {
      id: "a1",
      title: "Parents struggle to decide what to cook on weeknights",
      description: "Deciding what to make for dinner is a recurring, stressful task for working parents.",
      category: "problem_severity",
      rationale: "The product only matters if the daily decision is painful enough to seek help.",
      impact: 5,
      uncertainty: 4,
      provisional: false,
      validationMethod: "Customer interviews",
      validationQuestions: ["Tell me about the last time you struggled to decide what to cook for dinner.", "What did you end up doing that evening, and why?"],
      experimentDescription: "Interview parents about specific recent weeknight dinners and record how the decision was made and what it cost them.",
      successCriteria: "Proposed before interviews: at least 6 of 10 target parents describe a stressful dinner decision in the past two weeks without being prompted.",
      stakeholderIds: ["s1"],
    },
    {
      id: "a2",
      title: "Parents will trust an app to recommend meals that suit their family's preferences",
      description: "Parents would act on automated meal suggestions instead of overriding them.",
      category: "customer_desirability",
      rationale: "Trust in the suggestions decides whether the app replaces the decision or adds one more step.",
      impact: 4,
      uncertainty: 5,
      provisional: false,
      validationMethod: "Prototype testing",
      validationQuestions: ["How do you currently decide whether a suggested meal will work for your family?", "Tell me about a time you tried a recipe from a recommendation. What happened?"],
      experimentDescription: "Show a clickable prototype with suggested weekly plans and observe which suggestions are accepted, edited or rejected.",
      successCriteria: "Proposed before testing: at least half of suggested meals are accepted without edits across ten sessions.",
      stakeholderIds: ["s1", "s2"],
    },
    {
      id: "a3",
      title: "Parents are willing to maintain ingredient information to receive relevant meal suggestions",
      description: "Parents will keep a list of what is at home up to date with little effort.",
      category: "usability",
      rationale: "If keeping inventory is a chore, suggestions will go stale and the product will be abandoned.",
      impact: 4,
      uncertainty: 4,
      provisional: false,
      validationMethod: "Usability testing",
      validationQuestions: ["How do you currently keep track of the ingredients available at home?", "Tell me about the last time you made a shopping list. How did you build it?"],
      experimentDescription: "Ask participants to add a week of groceries to a prototype and measure time and drop-off.",
      successCriteria: "Proposed before testing: setup finishes in under five minutes for most participants, and most say they would repeat it weekly based on their current habits.",
      stakeholderIds: ["s3"],
    },
  ],
  summary: "Three stakeholder roles tied to the daily cooking decision, and three high-risk assumptions covering problem, trust and effort.",
};

const interviewPrep: FewShotExample = {
  id: "career-interview-preparation",
  domain: "Career development and interview preparation",
  keywords: ["interview", "interviews", "job", "jobs", "career", "resume", "hiring", "candidate", "candidates", "recruiter", "technical", "coding", "mock", "preparation", "skills", "seeker", "seekers", "hire"],
  project: {
    name: "InterviewPrep AI",
    description: "An AI platform that helps job seekers prepare for technical interviews through personalized questions, feedback, and mock interviews.",
    audience: "Job seekers preparing for technical interviews",
  },
  stakeholders: [
    {
      id: "s1",
      roleName: "Job seekers actively preparing for technical interviews",
      description: "People currently practicing for interviews and deciding how to spend limited preparation time.",
      whyItMatters: "They are the users who would practice with the platform and pay for it.",
      relevance: 5,
      interviewPriority: "high",
      recruitmentCriteria: "Has an interview scheduled or applied to technical roles in the last month.",
      interviewQuestions: ["Tell me about the last time you prepared for a technical interview. What did you do first?"],
      expectedEvidence: "How preparation is planned, what is practiced, and where people get stuck.",
    },
    {
      id: "s2",
      roleName: "Candidates who recently completed technical interviews",
      description: "People who finished an interview process in the past few months and can reflect on what mattered.",
      whyItMatters: "They can say which preparation actually helped and which gaps hurt them.",
      relevance: 4,
      interviewPriority: "medium",
      recruitmentCriteria: "Completed at least one technical interview loop in the last three months.",
      interviewQuestions: ["Walk me through your last technical interview. Which part was hardest, and what had you done to prepare for it?"],
      expectedEvidence: "Which preparation habits were followed by good or bad interview outcomes.",
    },
    {
      id: "s3",
      roleName: "Recruiters or technical interviewers",
      description: "People who run technical interviews and judge candidates.",
      whyItMatters: "They define what good performance looks like, which the practice questions must match.",
      relevance: 2,
      interviewPriority: "low",
      recruitmentCriteria: "Has conducted technical interviews in the last year.",
      interviewQuestions: ["Tell me about the last candidate you interviewed. What separated their answers from other candidates?"],
      expectedEvidence: "What interviewers actually evaluate, to check practice content against reality.",
    },
  ],
  assumptions: [
    {
      id: "a1",
      title: "Job seekers struggle to identify their most important interview preparation gaps",
      description: "Candidates do not know which skills to focus on, so their practice is unfocused.",
      category: "problem_severity",
      rationale: "Personalization only has value if people cannot find their own gaps today.",
      impact: 5,
      uncertainty: 4,
      provisional: false,
      validationMethod: "Interviews with active job seekers",
      validationQuestions: ["How do you decide which skills to focus on when preparing for an interview?", "Tell me about the last time you realized you were weak in some area. How did you find out?"],
      experimentDescription: "Interview job seekers about how they chose what to practice for their most recent interview.",
      successCriteria: "Proposed before interviews: at least 6 of 10 describe choosing topics by guess or habit rather than by measured gaps.",
      stakeholderIds: ["s1"],
    },
    {
      id: "a2",
      title: "Job seekers find personalized AI feedback more useful than generic practice questions",
      description: "Feedback tailored to a person's answers changes how they prepare more than a standard question list does.",
      category: "customer_desirability",
      rationale: "The core product bet is that personalization beats free generic practice material.",
      impact: 5,
      uncertainty: 5,
      provisional: false,
      validationMethod: "Comparative prototype experiment",
      validationQuestions: ["What makes feedback from a practice interview useful enough to change how you prepare?", "Tell me about the last time feedback changed what you practiced."],
      experimentDescription: "Give two groups either personalized feedback or generic questions and compare predefined usefulness ratings and follow-up behavior.",
      successCriteria: "Proposed before the experiment: the personalized group scores clearly higher on usefulness and practices more in the following week than the generic group.",
      stakeholderIds: ["s1"],
    },
    {
      id: "a3",
      title: "Job seekers will return to practice regularly if the platform tracks their progress",
      description: "Progress tracking turns one-off practice into a repeated habit.",
      category: "retention",
      rationale: "Revenue and outcomes depend on repeat use, which a single good session does not show.",
      impact: 4,
      uncertainty: 5,
      provisional: false,
      validationMethod: "Longitudinal MVP experiment",
      validationQuestions: ["How do you currently track your progress while preparing for interviews?", "Tell me about a preparation routine you kept up for more than a few weeks. What kept you going?"],
      experimentDescription: "Release a basic MVP with progress tracking to a small cohort and measure return visits over a fixed period.",
      successCriteria: "Proposed before launch: define a return-usage rate and measurement window, for example a share of users practicing in at least three of four weeks.",
      stakeholderIds: ["s1", "s2"],
    },
  ],
  summary: "Candidate roles at different stages plus an interviewer perspective, and assumptions about the gap problem, value of personalization and repeat use.",
};

const localService: FewShotExample = {
  id: "generic-product-discovery",
  domain: "Generic product discovery",
  keywords: ["platform", "marketplace", "service", "services", "provider", "providers", "local", "customers", "connect", "booking", "app", "startup", "product"],
  project: {
    name: "LocalService Connect",
    description: "A platform connecting households with local service providers.",
    audience: null,
  },
  stakeholders: [
    {
      id: "s1",
      roleName: "Households that have recently searched for a local service",
      description: "People who looked for and possibly hired a plumber, cleaner or similar provider in the recent past.",
      whyItMatters: "They experience the search and trust problem the platform claims to solve.",
      relevance: 5,
      interviewPriority: "high",
      recruitmentCriteria: "Hired or tried to hire a local service provider in the last three months.",
      interviewQuestions: ["Tell me about the last time you needed a local service. How did you find someone?"],
      expectedEvidence: "How people search, compare and choose providers today, and what goes wrong.",
    },
    {
      id: "s2",
      roleName: "Service providers who receive customer inquiries",
      description: "Independent providers or small businesses who win work from new customers.",
      whyItMatters: "A two-sided platform fails if providers will not respond or pay.",
      relevance: 5,
      interviewPriority: "high",
      recruitmentCriteria: "Runs a local service business and handled new customer inquiries in the last month.",
      interviewQuestions: ["Walk me through the last new customer inquiry you received, from first message to finished job."],
      expectedEvidence: "How leads arrive and are handled today, and what they would change.",
    },
    {
      id: "s3",
      roleName: "People responsible for choosing or paying for a service when different from the end user",
      description: "A landlord, property manager or family member who decides or pays on behalf of the household.",
      whyItMatters: "The person who benefits may not be the person who chooses or pays.",
      relevance: 2,
      interviewPriority: "low",
      recruitmentCriteria: "Arranged or paid for a service for someone else in the last six months.",
      interviewQuestions: ["Tell me about the last time you arranged a service for someone else. Who made the final decision?"],
      expectedEvidence: "Who decides and who pays in practice, and how that changes what they need.",
    },
  ],
  assumptions: [
    {
      id: "a1",
      title: "Households struggle to assess the reliability of local service providers",
      description: "Households cannot easily tell which provider will show up, do good work and charge fairly.",
      category: "problem_severity",
      rationale: "Trust in providers is the main reason a connecting platform would be needed.",
      impact: 5,
      uncertainty: 4,
      provisional: true,
      validationMethod: "Interviews with households that recently hired a service provider",
      validationQuestions: ["How did you decide which provider to trust the last time you needed a local service?", "Tell me about a time a provider did not meet your expectations. What happened next?"],
      experimentDescription: "Interview recent customers about how they chose a provider and what went wrong.",
      successCriteria: "Proposed before interviews: at least 6 of 10 describe a concrete trust problem in their last hire.",
      stakeholderIds: ["s1"],
    },
    {
      id: "a2",
      title: "Local service providers are willing to respond to and manage leads through a digital platform",
      description: "Providers will change how they receive and answer inquiries to use a new tool.",
      category: "operational_feasibility",
      rationale: "Without active providers the platform has nothing to offer households.",
      impact: 4,
      uncertainty: 5,
      provisional: true,
      validationMethod: "Provider interviews and a workflow prototype",
      validationQuestions: ["How do you currently receive, track, and respond to new customer inquiries?", "Tell me about the last tool you adopted for your business. What made you keep or drop it?"],
      experimentDescription: "Interview providers, then give a few a simple lead inbox and measure response behavior for two weeks.",
      successCriteria: "Proposed before the experiment: define a provider participation and response-time threshold, for example most pilot providers answering leads within a set number of hours.",
      stakeholderIds: ["s2"],
    },
  ],
  summary: "Two-sided stakeholder mapping for a marketplace, with the audience unconfirmed so audience-dependent assumptions are provisional.",
};

export const EXAMPLES: readonly FewShotExample[] = [mealmate, interviewPrep, localService];

const GENERIC_ID = localService.id;
const words = (t: string) => t.toLowerCase().match(/[a-z]+/g) ?? [];

/** Score = number of distinct example keywords found in the project text. */
export function scoreExample(ex: FewShotExample, text: string): number {
  const w = new Set(words(text));
  return ex.keywords.filter((k) => w.has(k)).length;
}

/**
 * Two or three examples. The best matching domain examples first (only if they match at all),
 * then the generic example as a structural anchor. Same input always gives the same selection.
 */
export function selectExamples(text: string, max = 3): FewShotExample[] {
  const ranked = EXAMPLES.filter((e) => e.id !== GENERIC_ID)
    .map((e, i) => ({ e, s: scoreExample(e, text), i }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.e);
  const picked = ranked.slice(0, Math.max(1, max - 1));
  const generic = EXAMPLES.find((e) => e.id === GENERIC_ID)!;
  picked.push(generic);
  if (picked.length < 2) picked.push(...EXAMPLES.filter((e) => !picked.includes(e)).slice(0, 2 - picked.length));
  return picked.slice(0, max);
}

/** The example rendered in the exact JSON structure the model must return. */
export function exampleOutput(ex: FewShotExample) {
  return {
    stakeholders: ex.stakeholders.map(({ ...s }) => s),
    assumptions: ex.assumptions.map(({ stakeholderIds, ...a }) => a),
    assumptionStakeholderLinks: ex.assumptions.flatMap((a) => a.stakeholderIds.map((sid) => ({ assumptionId: a.id, stakeholderId: sid }))),
    generationSummary: ex.summary,
  };
}
