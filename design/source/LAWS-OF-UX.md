# Laws of UX

Reference the relevant laws below when making or reviewing UI/UX decisions. Cite specific laws by name when they apply.

---

## Heuristics

### Aesthetic-Usability Effect
Users perceive aesthetically pleasing design as more usable. A polished UI creates positive responses and leads users to believe it works better — but attractive design can also mask usability flaws during testing.

**Apply when:** Justifying visual polish investment. Beware: don't let beauty hide real problems.

### Doherty Threshold
Productivity soars when interaction stays under **400ms**. Neither system nor user should wait on the other.

- Use perceived performance (skeleton screens, optimistic updates) when actual speed isn't achievable
- Animations during processing maintain engagement
- Progress indicators make delays tolerable
- Strategic micro-delays can enhance perceived value

**Apply when:** Evaluating response times, loading states, transitions.

### Fitts's Law
Time to reach a target = f(distance, size). Closer and larger targets are faster to hit.

**Apply when:** Sizing buttons, placing CTAs, designing touch targets, positioning interactive elements.

### Hick's Law
Decision time increases with the number and complexity of choices.

- Minimize choices when response time is critical
- Break complex tasks into smaller steps
- Highlight recommended options to reduce overwhelm
- Use progressive disclosure for new users
- Don't simplify to the point of abstraction

**Apply when:** Designing menus, onboarding flows, form fields, settings pages.

### Jakob's Law
Users spend most of their time on *other* sites. They expect yours to work the same way.

- Leverage existing mental models so users focus on goals, not learning your interface
- When redesigning, allow temporary access to the old version to reduce friction

**Apply when:** Choosing UI patterns, evaluating unconventional layouts, redesigning existing interfaces.

### Occam's Razor
Among equally effective solutions, choose the one with fewest assumptions.

- Prevent complexity rather than removing it later
- Strip unnecessary elements while preserving core function
- Design is complete when nothing more can be removed without harm

**Apply when:** Evaluating feature scope, simplifying interfaces, choosing between design approaches.

### Pareto Principle (80/20)
~80% of effects come from ~20% of causes.

- Focus effort on areas delivering the greatest benefit to the most users
- Identify the vital few features/flows that drive most value

**Apply when:** Prioritizing features, deciding where to invest design effort.

### Parkinson's Law
Work expands to fill the time available.

- Set task completion timeframes aligned with user expectations
- Reducing actual completion time below expectations improves satisfaction
- Use autofill, defaults, and smart suggestions to compress task time

**Apply when:** Designing forms, checkout flows, onboarding wizards.

### Postel's Law (Robustness Principle)
Be liberal in what you accept, conservative in what you send.

- Accept varied user inputs gracefully
- Anticipate diverse interaction patterns and capability levels
- Translate flexible input into strict internal requirements
- Provide clear feedback on boundaries

**Apply when:** Designing form validation, input handling, error messages, API interfaces.

### Tesler's Law (Conservation of Complexity)
Every system has irreducible complexity that cannot be eliminated — only moved between user and system.

- Absorb complexity into the system so users don't have to manage it
- Design for real user behavior, not ideal rational actors
- Provide contextual help (tooltips, inline guidance) for unavoidable complexity

**Apply when:** Deciding what to automate vs. expose to users, designing complex workflows.

---

## Gestalt Principles

### Law of Common Region
Elements within a shared boundary are perceived as grouped.
- Use borders or background fills to create visual sections
- Establishes structure that aids rapid comprehension

### Law of Proximity
Objects near each other are perceived as related.
- Spacing establishes relationships — related items close, unrelated items apart
- Drives scannability and information hierarchy

### Law of Prägnanz
People interpret ambiguous images in the simplest possible form.
- Design for minimum cognitive effort in visual interpretation
- Simple, clean shapes and layouts are processed faster

### Law of Similarity
Similar-looking elements are perceived as a unified group.
- Color, shape, size, orientation signal shared meaning or function
- Links and navigation must visually differ from regular text

### Law of Uniform Connectedness
Visually connected elements appear more related than unconnected ones.
- Use lines, arrows, colors, or frames to connect related items
- Apply to show context or emphasize relationships

---

## Cognitive & Memory

### Chunking
Break information into meaningful groups to aid comprehension and recall.

### Cognitive Load
The total mental resources needed to understand and interact with an interface. Minimize it.

### Miller's Law
Working memory holds ~7 (±2) items. Don't use this as a rigid design constraint — use it to inform chunking and progressive disclosure. Capacity varies by individual and context.

### Serial Position Effect
People best remember the first (primacy) and last (recency) items in a sequence.
- Place key actions at the start and end of navigation
- Less important items can go in the middle

### Working Memory
The cognitive system for temporarily holding and manipulating information. Respect its limits.

---

## Behavioral

### Choice Overload
Too many options cause overwhelm and decision paralysis. Curate and limit choices.

### Cognitive Bias
Systematic errors in thinking that influence perception. Design with awareness of common biases.

### Flow
A state of complete immersion and focus. Design to sustain it — minimize interruptions, provide clear goals and immediate feedback.

### Goal-Gradient Effect
Motivation increases as users approach completion.
- Show progress indicators
- Artificial head starts (pre-filled progress bars) boost motivation
- Clear indication of remaining steps drives completion

**Apply when:** Designing progress bars, onboarding, loyalty programs, multi-step forms.

### Mental Model
Users' compressed understanding of how a system works. Align your design with existing mental models.

### Paradox of the Active User
Users start using software immediately without reading docs. Design for exploration, not instruction.

### Peak-End Rule
Experiences are judged by their most intense moment and their ending, not the average.
- Invest in peak delight moments and graceful endings
- Negative peaks are remembered more strongly than positive ones

**Apply when:** Designing onboarding completion, checkout success, error recovery flows.

### Selective Attention
Users focus on relevant stimuli and filter out the rest. Don't compete for attention — guide it.

### Von Restorff Effect (Isolation Effect)
The distinctive item among similar items is most memorable.
- Make important elements visually distinct
- Don't overuse emphasis — competing distinctions cancel out
- Never rely on color alone (accessibility)
- Consider motion sensitivity when using animation for contrast

**Apply when:** Designing CTAs, pricing tables, notifications, key actions.

### Zeigarnik Effect
Incomplete tasks are remembered better than completed ones.
- Use progress indicators to surface incompleteness
- Artificial progress toward goals boosts motivation
- Show what's remaining to encourage completion

**Apply when:** Designing task lists, onboarding checklists, save states.
