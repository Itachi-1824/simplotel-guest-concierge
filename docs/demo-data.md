# Sample data and reviewer walkthrough

**All hotel information is fictional stub data.** The Cove Hotel, photos, rates, policies, inventory, and availability are for this assessment. There is no connection to a hotel's booking system and no reservation or payment is made.

The shared fixture is [`data/hotel.json`](../data/hotel.json): 42 source facts and four room categories. The backend, local retrieval models, graph, and LLM evidence all use this same file. The LLM receives only the retrieved facts as indexed sentences. It cannot change inventory or calculate prices.

## Room fixtures

| Room | Capacity | Sample nightly rate | Inventory ceiling | Breakfast |
| --- | --- | --- | --- | --- |
| Classic Room | 2 | €190 | 8 | €24/adult/day |
| Sea View Room | 2 | €265 | 6 | €24/adult/day |
| Terrace Suite | 3 | €390 | 4 | Included |
| Horizon Suite | 4 | €520 | 2 | Included |

Available quantities vary deterministically with dates. A stay costs nightly rate × nights; the sample calculation has no taxes or extra charges. Search covers 1–4 guests and 1–30 nights. Individual room numbers are unsupported.

## Try end to end

| Action | Expected result |
| --- | --- |
| “What time is check-in?” | 3 PM; check-out by 11 AM |
| “Tell me about the Terrace Suite”, then “And breakfast?” | Context retained; suite breakfast included |
| “How much are breakfast and parking?” | €24 for breakfast in Classic/Sea View; suites include it; valet €28/night. Exercises multi-source LLM selection when configured |
| “Is breakfast included in the Classic Room, and when does the pool close?” | Classic breakfast costs €24; pool closes at 8 PM |
| “Do you have a helipad?” | Unknown-answer fallback, without inventing an amenity |
| “Who are you?” | Assistant identity and demonstration scope |
| “Room 120 available?” | Explains category-based sample inventory |
| Check dates: 5–7 October 2026, 3 guests | Terrace Suite €780 and Horizon Suite €1,040. Use later future dates after this example expires |
| “Book a room 5–7 October 2026 for three guests under €400 per night with a terrace and with breakfast included” | Automatically opens Terrace Suite report: €780; confirm to see the clearly labelled payment preview |
| “Plan my stay”, then “5–7 October for three guests” | Collects missing essentials in chat; auto-fills the optional form and opens review |
| Check dates with departure before arrival | Validation error |
| Create “Italy” folder; rename and move a chat; reload | Session and folder persist on this device |
| Guide button | Seven-step walkthrough can be replayed |

The header, welcome screen, source labels, planner, and conversation footer identify the demo. Successful chat API responses include `demo: true`; availability also includes `mock: true`.

To verify failure handling locally, run without an API key or temporarily use an unreachable provider URL. Hotel facts and deterministic availability still work. Set an unreachable `LOCAL_AI_URL` to verify built-in retrieval fallback. Automated versions are covered by `npm test` and `npm run test:api`.

The review shows the categories checked, matching options, selection reason, dates, guests, room features, price arithmetic, and sample cancellation policy. Taxes/fees are unspecified, not claimed to be zero. The payment preview uses `Demo Guest` and `guest@example.com` as illustrative data and does not collect guest or card information.

## Expanded knowledge fixtures

The guide contains 42 facts and 28 reviewed graph relationships. Topics include meals, separate delivery and charging fees, late arrivals, luggage, housekeeping, laundry, dietary limitations, visitor rules, smoking, lost property, cots, connecting rooms, and weather closures. All invented property details are explicitly fictional assessment fixtures.

[Sixteen complex reviewer cases](../data/reviewer-scenarios.json) list questions, expected sources, and required qualifications. Examples:

- Does the parking fee include electric vehicle charging? (€28 parking; electricity separate.)
- Can I store luggage before check-in? (Complimentary subject to space; check-in remains 3 PM.)
- I arrive after midnight. Is reception staffed? (24 hours; reservation holding still needs confirmation.)
- Is a cot guaranteed and does it increase room capacity? (Neither; staff confirmation required.)
- Can you guarantee an allergen-free vegan dinner? (No guarantee of allergen-free preparation or no cross-contact.)
- Can the pool close during lightning even within opening hours? (Yes; published hours do not guarantee access.)

Booking requests involving accessibility, pets, cots, connecting rooms, or dietary safety stop for hotel confirmation instead of silently claiming suitable inventory. The room tool supports dates, guest count, nightly budget, view/terrace, breakfast inclusion, and named category. Complex knowledge retrieval and a confirmed real-world booking are different capabilities.

## Contact and location fixtures

Hotel & contact is available below the chat header and from contact/location answers. It provides a sample phone, email, and full illustrative street address with copy controls. The map opens the Amalfi area, not an exact hotel entrance. The entire property is fictional.

The demo phone uses NANPA’s [reserved non-working 555-0100–0199 range](https://www.nanpa.com/numbering/555-line-numbers); the email uses the [reserved .example domain](https://www.rfc-editor.org/info/rfc2606/). No calls or emails are sent by the demo. A verified real-property configuration can enable telephone and email links, but must replace the fictional address, phone, email, and map target together.
