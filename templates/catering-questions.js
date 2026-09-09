/**
 * The catering questions, as data (dialtone#1553, #1559).
 *
 * ONE source for the stepped flow AND the no-JS fallback. Two lists would drift,
 * and the drift would be invisible: the fallback only renders when JavaScript
 * has already failed, which is exactly when nobody is looking.
 *
 * EVENT TYPE SELECTS A VIEW OVER ONE ROW SHAPE. `public_event` is the only type
 * that changes what a CORE field MEANS — `headcount` is expected footfall
 * rather than plates, `service_style` is a business model rather than a
 * delivery choice — so the prompts differ while the columns do not.
 *
 * COPY IS A FIRST DRAFT for the operator to revise. It is fixed platform text
 * in v1; the seam where per-tenant overrides would go is this table.
 */

/** Screen 1, every type. Chips, not a dropdown: one tap is the lowest-friction
 *  opening there is, and a categorisation task otherwise makes a cold start
 *  feel like paperwork. */
export const OCCASIONS = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'private_party', label: 'Private party' },
  { value: 'public_event', label: 'Public event' },
  // Typically 20–30% of real submissions, so its column below is written to be
  // safe for anything rather than left to fall through to a default.
  { value: 'other', label: 'Something else' }
];

const SERVICE_CHOICES = [
  { value: 'delivery', label: 'Delivered' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'served', label: 'Served on site' }
];

/**
 * Contact is ONE screen, not three: name, phone and email are one thought, and
 * stepping by THOUGHT rather than by field is what keeps this at ~8 screens
 * instead of 11. Wedding needs a second name anyway — the person filling this
 * in is often the planner or a parent — which is why event name and contact
 * name are separate fields.
 */
const CONTACT = (helper) => ({
  key: 'contact',
  prompt: 'How do we reach you?',
  helper,
  fields: [
    { name: 'contact_name', label: 'Your name', type: 'text', required: true, autocomplete: 'name' },
    { name: 'contact_phone', label: 'Phone', type: 'tel', inputmode: 'tel', autocomplete: 'tel' },
    { name: 'contact_email', label: 'Email', type: 'email', autocomplete: 'email' }
  ],
  // At least ONE of phone or email — one method answers a lead, and requiring
  // two doubles the failure chance at the screen people are most likely to quit.
  requireOneOf: ['contact_phone', 'contact_email']
});

const one = (name, opts) => ({ key: name, prompt: opts.prompt, helper: opts.helper, fields: [{ name, ...opts.field }] });

const TEXT = { type: 'text', required: true };
const WHEN = { type: 'datetime-local', required: true };
const NUM = { type: 'number', inputmode: 'numeric', min: 1, max: 100000 };
const AREA = { type: 'textarea' };

export const QUESTIONS = {
  wedding: [
    one('event_name', { prompt: 'Whose big day are we planning?', helper: 'First names are perfect.', field: TEXT }),
    one('event_at', { prompt: "When's the wedding?", helper: "Not locked in yet? Your best guess is fine.", field: WHEN }),
    one('headcount', { prompt: 'How many guests will we be feeding?', helper: "A rough number — we'll firm it up together.", field: NUM }),
    one('service_style', { prompt: 'How would you like us to serve?', field: { type: 'choice', choices: SERVICE_CHOICES } }),
    one('location_text', { prompt: "Where's the celebration?", helper: 'Venue name or address.', field: TEXT }),
    one('menu_notes', { prompt: 'What are you dreaming up?', helper: 'Favourite dishes, a vibe, or leave it to us.', field: AREA }),
    one('extras.dietary', { prompt: 'Any dietary needs we should plan around?', helper: 'Allergies, vegetarian, vegan — anything at all.', field: AREA }),
    CONTACT("We'll come back to you within one business day.")
  ],
  // Deliberately charmless. A repeat corporate buyer booking monthly lunches
  // wants out in twenty seconds and finds charm an obstacle.
  corporate: [
    one('event_name', { prompt: "What's the event?", helper: 'e.g. Q3 all-hands, client lunch.', field: TEXT }),
    one('event_at', { prompt: 'What date and time?', field: WHEN }),
    one('headcount', { prompt: 'How many people?', field: NUM }),
    one('service_style', { prompt: 'Delivery, pickup, or served on site?', field: { type: 'choice', choices: SERVICE_CHOICES } }),
    one('location_text', { prompt: 'Delivery address', helper: 'Include the suite or floor.', field: TEXT }),
    one('extras.delivery_window', { prompt: "What's your delivery window?", helper: "The tighter the better — we'll hit it.", field: { type: 'text' } }),
    one('menu_notes', { prompt: 'Any food preferences?', helper: 'Dishes to include or avoid, dietary restrictions.', field: AREA }),
    // The single most valuable question you can ask a corporate buyer, and
    // nonsense at a wedding — which is the case for branching the FIELD SET
    // rather than only the wording.
    one('extras.recurring', { prompt: 'One-off, or does this repeat?', field: { type: 'choice', choices: [
      { value: 'one_off', label: 'One-off' },
      { value: 'weekly', label: 'Weekly' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'unsure', label: 'Not sure yet' }
    ] } }),
    one('extras.po_number', { prompt: 'Need an invoice or PO number?', field: { type: 'text' } }),
    CONTACT('Who should we confirm with?')
  ],
  private_party: [
    one('event_name', { prompt: 'Who are we celebrating?', helper: '"Maya’s 30th" works.', field: TEXT }),
    one('event_at', { prompt: "When's the party?", field: WHEN }),
    one('headcount', { prompt: 'How many are you expecting?', helper: 'Ballpark is fine.', field: NUM }),
    one('service_style', { prompt: 'How should we serve it?', field: { type: 'choice', choices: SERVICE_CHOICES } }),
    one('location_text', { prompt: 'Where are we headed?', field: TEXT }),
    one('menu_notes', { prompt: 'What sounds good?', helper: 'Dishes you love — or tell us to surprise you.', field: AREA }),
    one('extras.dietary', { prompt: 'Anything we should avoid?', helper: 'Allergies or dietary needs.', field: AREA }),
    CONTACT('')
  ],
  public_event: [
    // TWO fields, one thought — the same rule as the contact screen. Asking
    // for "name, and a website if it has one" in a single box makes the
    // visitor decide the format, and a browser will helpfully autofill a URL
    // into what it reads as a text field.
    {
      key: 'event_name',
      prompt: "What's the event?",
      fields: [
        { name: 'event_name', label: 'Event name', type: 'text', required: true },
        {
          name: 'extras.website',
          label: 'Website (optional)',
          type: 'url',
          inputmode: 'url',
          placeholder: 'https://'
        }
      ]
    },
    one('event_at', { prompt: 'What date would we be serving?', field: WHEN }),
    one('extras.serving_hours', { prompt: 'What hours?', helper: 'e.g. 11am to 8pm.', field: { type: 'text' } }),
    // The core column, asking a different question.
    one('headcount', { prompt: 'Expected attendance?', helper: 'Total footfall, not plates — it helps us plan stock.', field: NUM }),
    one('service_style', { prompt: 'Are we selling at the window, or catering a set headcount?', field: { type: 'choice', choices: [
      { value: 'vendor_sales', label: 'Selling at the window' },
      { value: 'served', label: 'Catering a set number' }
    ] } }),
    one('location_text', { prompt: "Where's the site?", field: TEXT }),
    one('extras.power', { prompt: 'Is power available on site?', field: { type: 'choice', choices: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
      { value: 'unsure', label: 'Not sure' }
    ] } }),
    one('extras.vendor_terms', { prompt: 'How does the vendor arrangement work?', helper: 'Flat fee, revenue share, or straight sales.', field: AREA }),
    one('menu_notes', { prompt: "Anything you'd like us to feature?", field: AREA }),
    CONTACT("Who's the event contact?")
  ],
  other: [
    one('event_name', { prompt: "What's the occasion?", helper: 'A few words is plenty.', field: TEXT }),
    one('event_at', { prompt: 'When is it?', field: WHEN }),
    one('headcount', { prompt: 'How many people?', field: NUM }),
    one('service_style', { prompt: 'Delivery, pickup, or served on site?', field: { type: 'choice', choices: SERVICE_CHOICES } }),
    one('location_text', { prompt: 'Where should we go?', field: TEXT }),
    one('menu_notes', { prompt: 'What are you thinking, food-wise?', field: AREA }),
    CONTACT('')
  ]
};

/** The screens for one occasion, falling back to the neutral set. */
export function questionsFor(eventType) {
  return QUESTIONS[eventType] ?? QUESTIONS.other;
}
