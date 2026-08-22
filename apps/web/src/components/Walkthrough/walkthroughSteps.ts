import type { WalkthroughStep } from './types';

const PROJECTS_ROUTE = /^\/projects\/?$/;
const PROJECT_ROUTE = /^\/project\/[^/]+\/?$/;
const CHARACTERS_ROUTE = /^\/project\/[^/]+\/characters\/?$/;
const SCREENPLAY_ROUTE = /^\/project\/[^/]+\/screenplay\/?$/;
/** Any page inside a project — the side nav and breadcrumb bar are present on all of them. */
const ANY_PROJECT_ROUTE = /^\/project\/[^/]+/;

/**
 * The intro tour, in order.
 *
 * Two kinds of step appear here. Plain steps explain something already on screen and advance with
 * Next. Steps carrying `action` explain something that is *behind* an interaction: they ask the
 * user to click, then wait for the resulting navigation or new UI before the following step
 * describes what just appeared. That pairing — an "ask" step followed by an "explain" step — is
 * why several ids come in `-open` / `-explain` pairs.
 *
 * Any step whose `route` or `target` doesn't resolve is skipped, so an account with no projects
 * yet simply runs the first chapter and lands on the closing card.
 */
export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Writual',
    body: [
      'This quick tour shows you how to get around and what each part of the app is for. It takes about a minute.',
      'You can leave at any time — and if you would rather not see it again, tick the box at the bottom.',
    ],
  },
  {
    id: 'projects-list',
    title: 'Your projects',
    body: [
      'Every script you write lives in a project. My Projects holds the ones you own; Shared With Me holds projects collaborators have invited you to.',
      'Each card shows the poster, logline, genre and a progress read-out, so you can see where a draft stands without opening it.',
    ],
    route: PROJECTS_ROUTE,
    target: '[data-tour="projects-tabs"]',
    placement: 'bottom-start',
  },
  {
    id: 'create-project-open',
    title: 'Start a new project',
    body: [
      'Create Project is how every script begins. Give it a click and we will walk through the form together.',
    ],
    route: PROJECTS_ROUTE,
    target: '[data-tour="create-project-button"]',
    placement: 'bottom-end',
    action: { type: 'appear', selector: '[data-tour="create-project-dialog"]' },
    actionHint: 'Click Create Project to continue',
  },
  {
    id: 'create-project-explain',
    title: 'The project form',
    body: [
      'Title, type, genre and logline are the basics — the logline is the one-sentence pitch shown on the project card, and you can keep revising it later.',
      'Already have a draft? Drop a screenplay PDF at the top and Writual imports it, page count and all, instead of starting from a blank page.',
      'Turn on the writing tracker to set a target page count and draft deadlines, and add collaborator emails to share the project the moment it is created.',
    ],
    target: '[data-tour="create-project-dialog"]',
    placement: 'right',
    action: { type: 'disappear', selector: '[data-tour="create-project-dialog"]' },
    actionHint: 'Close or submit the form to continue',
  },
  {
    id: 'open-project',
    title: 'Open a project',
    body: [
      'Click a project card to go inside it. That is where the outline, characters, notes, screenplay and chat all live.',
    ],
    route: PROJECTS_ROUTE,
    target: '[data-tour="project-card"]',
    placement: 'right-start',
    action: { type: 'navigate', route: ANY_PROJECT_ROUTE },
    actionHint: 'Open any project to continue',
  },
  {
    id: 'project-nav',
    title: 'Moving around a project',
    body: [
      'This sidebar is the spine of a project. Characters holds your cast, Notes is free-form research and ideas, Outline is your beat-by-beat structure, Screenplay is the editor itself, and Chat is where you and your collaborators talk.',
      'The arrow at the top collapses the sidebar down to icons when you want more room for the page.',
    ],
    route: ANY_PROJECT_ROUTE,
    target: '[data-tour="side-nav"]',
    placement: 'right',
  },
  {
    id: 'project-breadcrumb',
    title: 'Knowing where you are',
    body: [
      'The breadcrumb names the project and the section you are in. Click the project title to come back to this overview from anywhere inside it.',
    ],
    route: ANY_PROJECT_ROUTE,
    target: '[data-tour="project-breadcrumb"]',
    placement: 'bottom-start',
  },
  {
    id: 'project-hero',
    title: 'The project at a glance',
    body: [
      'The poster and details sit at the top of every project page, with the logline you can keep revising as the story sharpens.',
      'Alongside them are the tracking tiles: pages written against your target, cast size, scene count and how close the next draft deadline is. Click a tile to open the detail behind it.',
    ],
    route: PROJECT_ROUTE,
    target: '[data-tour="project-hero"]',
    placement: 'bottom',
  },
  {
    id: 'stat-tile-menu',
    title: 'Choose what you see',
    body: [
      'This menu picks which tiles appear, and it remembers the choice per section — so Characters can show a different set from the overview. The choice is saved to your account, not this browser.',
    ],
    route: ANY_PROJECT_ROUTE,
    target: '[data-tour="stat-tile-menu"]',
    placement: 'bottom-end',
  },
  {
    id: 'characters-open',
    title: 'Take a look at Characters',
    body: [
      'Click Characters in the sidebar and we will pick things up on the other side.',
    ],
    route: ANY_PROJECT_ROUTE,
    target: '[data-tour="side-nav-characters"]',
    placement: 'right',
    action: { type: 'navigate', route: CHARACTERS_ROUTE },
    actionHint: 'Click Characters to continue',
  },
  {
    id: 'characters-explain',
    title: 'Your cast',
    body: [
      'Each card is one character — portrait, role and the biography and traits behind them. Add a character from the button in the bar above, and open a card to fill in the detail.',
      'Characters you define here are recognised in the screenplay editor, so you can pull a character up beside the page while you write dialogue for them.',
    ],
    route: CHARACTERS_ROUTE,
    target: '.characters-page-cards',
    placement: 'top',
  },
  {
    id: 'screenplay-open',
    title: 'Now the editor',
    body: [
      'Click Screenplay in the sidebar — that is where the actual writing happens.',
    ],
    route: ANY_PROJECT_ROUTE,
    target: '[data-tour="side-nav-screenplay"]',
    placement: 'right',
    action: { type: 'navigate', route: SCREENPLAY_ROUTE },
    actionHint: 'Click Screenplay to continue',
  },
  {
    id: 'screenplay-toolbar',
    title: 'Writing the script',
    body: [
      'The editor formats itself to industry standard as you type, and paginates live so the page count you see is the page count you get.',
      'This toolbar sets the element you are writing — scene heading, action, character, dialogue, parenthetical, transition — and Tab and Enter step you through them in the usual order.',
      'Your work saves as you go, and collaborators editing the same script appear alongside you in real time.',
    ],
    route: SCREENPLAY_ROUTE,
    target: '.screenplay-toolbar-vertical-shell',
    placement: 'right',
  },
  {
    id: 'settings',
    title: 'Settings',
    body: [
      'The gear holds your theme, your outline frameworks and sign-out — and a Replay intro walkthrough item, in case you want this tour again later.',
    ],
    target: '[data-tour="settings-button"]',
    placement: 'top-end',
  },
  {
    id: 'finish',
    title: 'That is the tour',
    body: [
      'You know your way around now: projects on the home page, and outline, characters, notes, screenplay and chat inside each one.',
      'Replay this any time from Settings.',
    ],
  },
];
