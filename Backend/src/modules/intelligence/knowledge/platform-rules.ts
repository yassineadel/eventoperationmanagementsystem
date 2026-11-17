/**
 * Platform rules the chatbot can quote: how buying, tickets, refunds and transfers work on Hafletna.
 * Each rule becomes one PLATFORM chunk in knowledge_chunks, keyed by `key` (keep keys stable:
 * renaming one re-embeds it and deletes the old chunk).
 *
 * The numbers come from the services that enforce them, so the chatbot never quotes a rule the
 * system no longer applies. Edit the wording here; change the numbers in the services.
 * The texts are built inside a function on purpose: the constants are read when indexing runs,
 * not when this file is loaded, which keeps it safe from circular imports between modules.
 *
 * English only: gemini-embedding-2 is multilingual, so Arabic questions still find these texts,
 * and the chat model answers in the user's language.
 */
import { HOLD_MINUTES, MAX_TICKETS_PER_USER_PER_EVENT } from '../../inventory/inventory.service'
import { PAYMENT_WINDOW_MINUTES } from '../../orders/orders.service'
import { REFUND_CUTOFF_DAYS, SETTLEMENT_NOTICE } from '../../tickets/refunds.service'
import { MAX_TRANSFERS } from '../../tickets/tickets.service'

export type PlatformRule = { key: string; title: string; text: string }

// Matches DELETION_GRACE_DAYS in auth/auth.service.ts (not exported there)
const ACCOUNT_DELETION_GRACE_DAYS = 14

export const platformRules = (): PlatformRule[] => [
  {
    key: 'account',
    title: 'Creating an account and signing in',
    text:
      'You need a Hafletna account to buy tickets. You can browse events without one. ' +
      'Register with your email address and confirm it with the verification email, or sign in with Google. ' +
      'Your account is only created once your email is confirmed, so check your spam folder if the email does not arrive.',
  },
  {
    key: 'how-to-buy',
    title: 'How to buy tickets',
    text:
      'Open an event, choose a ticket type (or pick your seats for seated venues) and the number of tickets. ' +
      `The tickets are held for you for ${HOLD_MINUTES} minutes while you check out; if you do not continue, they are released for other customers. ` +
      `Once you place the order you have ${PAYMENT_WINDOW_MINUTES} minutes to complete the payment, otherwise the order is cancelled and the tickets are released. ` +
      'You must read and accept the event policy at checkout. ' +
      'Payment is made online by card at checkout, in Egyptian pounds (EGP).',
  },
  {
    key: 'ticket-limit',
    title: 'Maximum tickets per customer',
    text:
      `Each account can buy at most ${MAX_TICKETS_PER_USER_PER_EVENT} tickets for the same event, ` +
      'counting tickets already bought and tickets currently held in checkout.',
  },
  {
    key: 'fees',
    title: 'Ticket prices and service fees',
    text:
      'Each ticket has a price plus a service fee. The service fee is a percentage that depends on the ticket type, ' +
      'and checkout shows the price, the fee and the total before you pay. ' +
      'The service fee is not returned when you ask for a refund yourself, but it is returned in full if the event is cancelled.',
  },
  {
    key: 'ticket-delivery',
    title: 'Receiving your tickets',
    text:
      'After payment, your tickets appear under My Tickets in your account, each with its own QR code, ' +
      'and they are also sent to you by email. You can ask for the ticket email to be sent again from the ticket page; ' +
      'it can only be re-sent a few times in a short period, so check your spam folder first.',
  },
  {
    key: 'entry',
    title: 'Entering the event',
    text:
      'Each ticket has one QR code, which gate staff scan once at the entrance. ' +
      'Show the QR code from My Tickets or from the ticket email. A QR code that has already been scanned cannot be used again, ' +
      'and the old QR code of a transferred ticket no longer works. Each event can also have its own entry rules, ' +
      'such as age limits and prohibited items, shown in the event policy.',
  },
  {
    key: 'refunds',
    title: 'Refund policy',
    text:
      `You can ask for a refund up to ${REFUND_CUTOFF_DAYS} days before the event starts, from the ticket page in My Tickets. ` +
      'Only valid tickets that you bought yourself and never transferred can be refunded, and each ticket can have one refund request. ' +
      'An administrator reviews every request and you see the decision and their message on the ticket. ' +
      'If it is approved you get back the ticket price; the service fee is kept. ' +
      `${SETTLEMENT_NOTICE} ` +
      'A ticket with a refund in progress cannot be transferred.',
  },
  {
    key: 'cancelled-events',
    title: 'When an event is cancelled',
    text:
      'If an event is cancelled, every valid ticket is refunded automatically and in full, including the service fee. ' +
      'You do not need to request anything; the refund goes back to your original payment method and you are notified by email.',
  },
  {
    key: 'transfers',
    title: 'Transferring a ticket to someone else',
    text:
      'You can transfer a valid ticket to another person from the ticket page, before the event starts. ' +
      'The recipient must already have a Hafletna account; enter the email address they registered with, ' +
      'and you can set the name that appears on the ticket. ' +
      `A ticket can be transferred at most ${MAX_TRANSFERS} times in total. ` +
      'The ticket gets a new QR code that is emailed to the new holder, and the old QR code stops working. ' +
      'Transferred tickets cannot be refunded.',
  },
  {
    key: 'account-deletion',
    title: 'Deleting your account',
    text:
      'You can ask to delete your account from your account settings. ' +
      `The deletion happens ${ACCOUNT_DELETION_GRACE_DAYS} days later, and you can cancel the request during that time. ` +
      'After that your personal details are removed.',
  },
]
