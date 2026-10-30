/** Sample content for the landing page. Everything here is illustrative, not real customer data. */

export interface Avatar {
  id: string;
  name: string;
  tag: string;
  background: string;
  initials: string;
  goals: string[];
  pains: string[];
  motivations: string[];
  /** Patterns the model inferred across interviews. Marked as inferred in the UI. */
  traits: string[];
  /** Words a participant actually said, with the interview they came from. */
  evidence: { quote: string; source: string }[];
}

export const AVATARS: Avatar[] = [
  {
    id: "budget",
    name: "Maya",
    tag: "The Budget-Conscious Buyer",
    initials: "M",
    background: "Freelance designer, 29. Pays for her own tools and tracks every subscription.",
    goals: ["Keep monthly costs predictable", "Only pay for what she uses weekly"],
    pains: ["Annual plans she forgets to cancel", "Paying for features she never opens"],
    motivations: ["A clear free trial", "Proof the tool saves her billable hours"],
    traits: ["Compares at least three alternatives before paying", "Reads pricing pages before feature pages"],
    evidence: [
      { quote: "I cancelled two apps last month because I couldn't remember the last time I opened them.", source: "Interview 2" },
      { quote: "If it's free I'll try it. If it's not, show me what I get first.", source: "Interview 5" },
    ],
  },
  {
    id: "convenience",
    name: "Daniel",
    tag: "The Convenience-Driven Professional",
    initials: "D",
    background: "Operations manager, 38. Two kids, a packed calendar, and little patience for setup.",
    goals: ["Get a task done in one sitting", "Avoid learning another tool"],
    pains: ["Long onboarding", "Tools that need a meeting to explain"],
    motivations: ["Works with what he already uses", "Saves a visible chunk of time"],
    traits: ["Pays more for less friction", "Decides quickly once the first use works"],
    evidence: [
      { quote: "If I can't get it working on my lunch break, it doesn't happen.", source: "Interview 1" },
      { quote: "I'd pay extra for someone to just set it up.", source: "Interview 4" },
    ],
  },
  {
    id: "skeptic",
    name: "Priya",
    tag: "The Skeptical First-Time Customer",
    initials: "P",
    background: "Small shop owner, 44. Has been burned by software that promised more than it delivered.",
    goals: ["Avoid another wasted purchase", "Hear from people like her"],
    pains: ["Vague claims", "No way to try before committing"],
    motivations: ["A named person to ask", "A refund she can rely on"],
    traits: ["Asks what happens if it does not work", "Trusts peers over marketing"],
    evidence: [
      { quote: "Everyone says it will save time. Nobody says what happens when it doesn't.", source: "Interview 3" },
      { quote: "I asked my sister's friend before I asked the company.", source: "Interview 6" },
    ],
  },
];

export interface UseCase {
  id: string;
  title: string;
  body: string;
  stimulus: string;
  avatar: string;
  reaction: string;
  insight: string;
}

export const USE_CASES: UseCase[] = [
  {
    id: "product",
    title: "Product Validation",
    body: "Test product concepts, features, pricing, and positioning.",
    stimulus: "Concept: a $12 per month plan with a 14 day trial",
    avatar: "Maya, budget-conscious",
    reaction: "The trial helps. But I would need to see what I get at $12 that the free plan does not give me.",
    insight: "Price is accepted only when the free alternative is addressed directly.",
  },
  {
    id: "marketing",
    title: "Marketing & Advertisements",
    body: "Upload advertisements and understand how different customer segments might react.",
    stimulus: "Ad: “Everything you need, in one place.”",
    avatar: "Daniel, convenience-driven",
    reaction: "In one place sounds good. Show me it taking five minutes, not a feature list.",
    insight: "Time to first result lands better than breadth of features.",
  },
  {
    id: "content",
    title: "Content & Social Media",
    body: "Test LinkedIn posts, Instagram creatives, and marketing messages to understand audience perception.",
    stimulus: "Post: “We saved a customer 10 hours a week.”",
    avatar: "Priya, skeptical",
    reaction: "Who was the customer? One number with no name makes me trust it less.",
    insight: "Specific, named proof beats a bold claim for skeptical audiences.",
  },
  {
    id: "experience",
    title: "Customer Experience",
    body: "Explore how customers might interact with landing pages, onboarding flows, and product experiences.",
    stimulus: "Onboarding: 6 setup steps before first use",
    avatar: "Daniel, convenience-driven",
    reaction: "Six steps is where I quit. Let me do one thing first and set up the rest later.",
    insight: "Defer setup until after the first successful use.",
  },
];
