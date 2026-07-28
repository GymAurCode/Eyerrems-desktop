import type { ModuleDoc } from './index'

export const crmDocs: ModuleDoc = {
  title: 'CRM (Clients, Leads, Deals & Bookings)',
  icon: 'ti-users',
  color: '#8B5CF6',
  sections: [
    {
      heading: 'Overview',
      items: [
        'The CRM module manages your entire customer relationship pipeline — from initial lead through to deal closure and booking. It covers leads, clients, dealers, deals, and bookings.',
        'Use this module to track prospective buyers, manage client relationships, record sales agreements, and reserve properties via bookings.',
      ],
    },
    {
      heading: 'Key Concepts / Fields',
      items: [
        { term: 'Lead', desc: 'A potential customer who has shown interest (e.g., via inquiry or walk-in). Leads have statuses like New, Contacted, Qualified, Lost.' },
        { term: 'Client', desc: 'A converted lead or direct customer with whom you have an established relationship. Clients can have multiple deals.' },
        { term: 'Dealer', desc: 'An external agent, broker, or partner who helps sell or refer properties. Dealers earn commissions on deals they facilitate.' },
        { term: 'Deal', desc: 'A sales transaction or agreement in progress. Deals track the property, price, payment plan, and status (Negotiation, Approved, Closed, Cancelled).' },
        { term: 'Booking', desc: 'A reservation that holds a specific property for a client for a defined period. Bookings can convert into deals.' },
        { term: 'Installment Plan', desc: 'A payment schedule attached to a deal, defining how the total amount is paid over time (down payment + installments).' },
        { term: 'Commission', desc: 'The fee earned by a dealer or agent for facilitating a deal, usually a percentage of the sale price.' },
      ],
    },
    {
      heading: 'Step-by-Step Usage',
      items: [
        'Creating a Lead: Go to CRM > Leads, click "Add Lead." Enter contact details, source, and notes. Save to add to the pipeline.',
        'Converting a Lead to Client: Open the lead record, click "Convert to Client." The lead moves to the Clients section with its data preserved.',
        'Creating a Deal: From a client record, click "New Deal." Select the property, enter the agreed price, and set the status.',
        'Setting up an Installment Plan: In a deal, click "Installment Plan Builder." Define the down payment, number of installments, and due dates.',
        'Creating a Booking: Go to Bookings, click "New Booking." Select the client, property, and booking period. The property is temporarily held.',
        'Converting a Booking to Deal: From the booking detail page, click "Convert to Deal." The booking data carries into the new deal.',
        'Searching: Use the search bar to find leads, clients, or deals by name, phone, email, or property reference.',
      ],
    },
    {
      heading: 'Relationships to Other Modules',
      items: [
        'Properties: Deals and bookings reference specific properties. A booking holds a property; a deal sells it.',
        'Finance: Deal amounts, installment plans, and payments feed into the Finance module for revenue tracking.',
        'Tenants: Clients who rent rather than buy become Tenants in the Tenants module.',
        'Users/Roles: CRM staff are managed via the Users module; permissions control who can view/edit leads, deals, and bookings.',
      ],
    },
    {
      heading: 'Common Issues / FAQs',
      items: [
        { term: 'What is the difference between a Lead and a Client?', desc: 'A Lead is a prospective customer who has not yet been qualified. A Client is an active customer with a relationship. Leads must be converted to Clients before creating deals.' },
        { term: 'Can a booking expire?', desc: 'Yes. Bookings have a defined validity period. When expired, the property is released and can be booked by another client.' },
        { term: 'How do I track dealer commissions?', desc: 'Each deal linked to a dealer can have a commission percentage set. The system calculates the commission amount based on the deal value.' },
        { term: 'Can I edit an installment plan after it is created?', desc: 'Yes. Open the deal and navigate to the installment plan section to adjust amounts, dates, or add/remove installments.' },
      ],
    },
    {
      heading: 'Tips / Best Practices',
      items: [
        'Always convert leads to clients before creating deals — this ensures clean data and full history tracking.',
        'Use the booking feature to temporarily hold hot properties for serious buyers while paperwork is prepared.',
        'Set realistic installment plans: match due dates to the client\'s expected payment schedule to reduce defaults.',
      ],
    },
  ],
}
