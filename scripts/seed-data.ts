export const SEED_PROJECT = {
  name: "Meal planning app for busy parents",
  description: "An app that plans weeknight dinners, builds the grocery list, and respects each family member's diet.",
  targetUser: "Working parents with children under 12",
};

type T = "desirability" | "feasibility" | "viability";
export const SEED_ASSUMPTIONS: { statement: string; type: T; risk: number }[] = [
  { statement: "Parents struggle to decide what to cook on weeknights.", type: "desirability", risk: 5 },
  { statement: "Parents plan meals for the whole week in advance.", type: "desirability", risk: 4 },
  { statement: "Parents would trust an app to pick meals that suit picky eaters.", type: "desirability", risk: 4 },
  { statement: "Parents want a grocery list generated automatically from the meal plan.", type: "desirability", risk: 3 },
  { statement: "Parents throw away a meaningful amount of food every week.", type: "desirability", risk: 3 },
  { statement: "Parents will abandon an app that cannot handle each family member's dietary restrictions.", type: "desirability", risk: 4 },
  { statement: "We can import recipes from any web page reliably.", type: "feasibility", risk: 4 },
  { statement: "We can connect to major grocery delivery services through partners.", type: "feasibility", risk: 3 },
  { statement: "Meal suggestions can be generated in under five seconds.", type: "feasibility", risk: 2 },
  { statement: "Parents will pay 8 dollars per month for meal planning.", type: "viability", risk: 5 },
  { statement: "Parents will pay for an annual family plan upfront.", type: "viability", risk: 3 },
  { statement: "Grocery partner fees can cover a meaningful share of revenue.", type: "viability", risk: 3 },
];

export const SEED_MEETINGS: { title: string; transcript: string }[] = [
  {
    title: "Interview 1: Priya, two kids (6 and 9)",
    transcript: `Interviewer: Thanks for making time. Walk me through last night's dinner.
Priya: Honestly, it was pasta again. I got home at six thirty and had no idea what to make, so I boiled pasta and opened a jar of sauce.
Interviewer: How often does that happen?
Priya: Maybe four nights out of five. The decision is the worst part. I stand in front of the fridge for ten minutes.
Interviewer: Do you plan the week ahead at all?
Priya: I tried. I made a plan on a Sunday in January and by Wednesday I had skipped two meals, so now I just wing it.
Interviewer: What do you do about groceries?
Priya: I go to the store twice a week and buy whatever looks good. I do not use a list because writing one takes longer than shopping.
Interviewer: Would a list that builds itself be useful?
Priya: Yes, definitely.
Interviewer: What happens to the food you buy but do not use?
Priya: I throw out a whole bag of produce almost every Sunday. Last week it was spinach, two peppers and a cucumber, probably fifteen dollars.
Interviewer: Tell me about the kids' eating.
Priya: My nine year old only eats about six things. My six year old is allergic to peanuts, so every recipe needs a check.
Interviewer: If an app suggested a meal, would you trust it?
Priya: Not if it ignores the peanut allergy. If it got that wrong once, I would delete it that day.
Interviewer: Have you paid for any food or cooking app before?
Priya: I paid for a recipe box app for three months, twelve dollars a month, and cancelled because I never opened it.
Interviewer: What would you pay for something that worked?
Priya: I would probably pay eight dollars a month if it saved me the nightly stress.
Interviewer: Would you pay for a year upfront?
Priya: No. I do not commit to anything for a year. Month to month only.
Interviewer: Do you use grocery delivery?
Priya: Sometimes, through Instacart when I am sick. It is expensive so not often.
Interviewer: When you find recipes online, how do you save them?
Priya: I screenshot them. Websites are full of ads and long stories, and I cannot copy the ingredients properly.
Interviewer: Anything else that would matter?
Priya: It has to be fast. If I wait more than a few seconds I will close it, I am usually cooking.`,
  },
  {
    title: "Interview 2: Marcus, three kids (4, 8, 11)",
    transcript: `Interviewer: Tell me how dinner works in your house.
Marcus: My wife and I split it. We sit down every Sunday night and plan all seven dinners on a whiteboard on the fridge.
Interviewer: Does the plan hold up?
Marcus: Mostly. We keep to it about five nights out of seven.
Interviewer: So deciding what to cook is not a struggle for you?
Marcus: Not really, no. The whiteboard solves it. The hard part is the shopping afterwards.
Interviewer: Say more about shopping.
Marcus: I copy the ingredients from the recipes into my phone notes. It takes me forty minutes every Sunday and I forget things all the time.
Interviewer: Would something that built the list for you help?
Marcus: Absolutely. That is the one thing I would use immediately.
Interviewer: How do the kids eat?
Marcus: Two of them eat anything. My eleven year old is vegetarian by choice, so we cook two versions of most meals.
Interviewer: Would you let an app choose the meals?
Marcus: I would use suggestions as a starting point, but I want the final say. I do not trust software to know my kids.
Interviewer: What about waste?
Marcus: We waste very little. We cook in batches and eat leftovers for lunch.
Interviewer: Have you paid for a meal planning tool?
Marcus: No. I use free templates. I would not pay eight dollars a month for this, maybe three or four.
Interviewer: What about a yearly plan?
Marcus: If it was cheaper per month, a yearly plan could work. I pay for an annual streaming bundle already.
Interviewer: How do you order groceries?
Marcus: Walmart pickup every week. Anything that connects to Walmart would be a big plus.
Interviewer: How do you collect recipes?
Marcus: I paste links into a shared doc. Half the time the site loads so slowly that I give up and search for another recipe.
Interviewer: Would you wait for suggestions to load?
Marcus: A couple of seconds is fine. Ten seconds is too long.
Interviewer: Last thing, anything missing?
Marcus: Let me tag meals for each kid's diet. That matters more than anything else.`,
  },
  {
    title: "Interview 3: Dana, single parent, one child (7)",
    transcript: `Interviewer: How was your week of cooking?
Dana: Chaotic. I work two jobs, so most nights it is whatever is fastest.
Interviewer: Is deciding what to make hard?
Dana: Every single night. I open the freezer and stare at it. I would pay someone just to tell me what to eat.
Interviewer: Do you plan ahead?
Dana: I have never managed more than two days ahead. Plans fall apart the moment a shift changes.
Interviewer: How do you shop?
Dana: Once a week, from memory, then I forget the milk. A list that writes itself would save me a second trip.
Interviewer: Do you throw food away?
Dana: Constantly. Yesterday I threw out a pack of chicken that expired, about nine dollars. It happens every week.
Interviewer: How does your daughter eat?
Dana: She is picky but not allergic. If an app suggested things she actually likes, I would use it every day.
Interviewer: Would you trust the suggestions?
Dana: If it learned what she likes over a couple of weeks, yes. I am fine with the app choosing.
Interviewer: Would dietary restrictions be a deal breaker?
Dana: Not for us, we have none. I would not care about that feature.
Interviewer: Have you paid for anything like this?
Dana: I paid for a meal kit for a month. Sixty dollars a week, which is way too much, so I stopped.
Interviewer: What would you pay for a planning app?
Dana: Eight dollars a month is fine if it really works. I already pay ten for a music app.
Interviewer: A yearly plan?
Dana: I would pay once for the year if there was a discount. It is easier than seeing a charge every month.
Interviewer: Do you order groceries online?
Dana: Instacart, mostly. I would love one tap from the plan to a full cart.
Interviewer: How do you save recipes?
Dana: Pinterest boards. Some of the links are dead, so the recipe is gone.
Interviewer: Anything about speed?
Dana: I will wait a few seconds. I will not wait longer than that at the end of a long shift.`,
  },
];
