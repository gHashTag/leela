import { answeredIn, directionOf, messageFor, type Language, type MessageKey } from '@leela/content';

import type { Subscription, SubscriptionProblem, SubscriptionState } from './subscription';

const PROBLEMS: Readonly<Record<SubscriptionProblem, MessageKey>> = {
  'outside-telegram': 'app.subscriptionOutside',
  unsupported: 'app.subscriptionUnsupported',
  unauthorized: 'app.subscriptionUnauthorized',
  unavailable: 'app.subscriptionUnavailable',
  unreadable: 'app.subscriptionUnreadable',
  timeout: 'app.subscriptionTimeout',
  cancelled: 'app.subscriptionCancelled',
  failed: 'app.subscriptionFailed',
  unconfirmed: 'app.subscriptionUnconfirmed',
};

const PROGRESS: Partial<Record<SubscriptionState['stage'], MessageKey>> = {
  loading: 'app.subscriptionLoading',
  creating: 'app.subscriptionCreating',
  invoice: 'app.subscriptionInvoice',
  checking: 'app.subscriptionChecking',
  confirmed: 'app.subscriptionConfirmed',
};

/** Adds controls to the sheet, never replaces the board, thread or reflection. */
export const subscriptionSheet = (
  root: HTMLElement,
  payment: Subscription,
  language: Language,
  dismiss: () => void,
): { render(state: SubscriptionState): void; show(): void } => {
  const document = root.ownerDocument;
  const create = <K extends keyof HTMLElementTagNameMap>(tag: K, testId: string): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    node.dataset.testid = testId;
    return node;
  };
  const say = (key: MessageKey): string => messageFor(language, key);
  root.lang = answeredIn(language, 'app.subscriptionChoose');
  root.dir = directionOf(root.lang as Language);

  const heading = create('h2', 'subscription-title');
  heading.id = 'subscription-title';
  heading.tabIndex = -1;
  heading.textContent = say('pro.title');
  const close = create('button', 'subscription-close');
  close.type = 'button';
  close.className = 'ghost';
  close.textContent = say('app.board3dClose');
  close.addEventListener('click', () => {
    payment.dismiss();
    root.hidden = true;
    dismiss();
  });
  const status = create('p', 'subscription-status');
  status.className = 'subscription-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');

  const form = create('form', 'subscription-form');
  const choices = create('fieldset', 'subscription-choices');
  const legend = create('legend', 'subscription-choose');
  legend.textContent = say('app.subscriptionChoose');
  const tiers = create('div', 'subscription-tiers');
  choices.append(legend, tiers);
  const terms = create('a', 'subscription-terms');
  terms.className = 'subscription-terms';
  terms.textContent = say('app.subscriptionTerms');
  terms.target = '_blank';
  terms.rel = 'noopener noreferrer';
  const acceptance = create('label', 'subscription-accept-label');
  acceptance.className = 'subscription-choice';
  const accept = create('input', 'subscription-accept');
  accept.id = 'subscription-accept';
  accept.type = 'checkbox';
  accept.required = true;
  accept.checked = false;
  const acceptanceText = create('span', 'subscription-accept-text');
  acceptanceText.textContent = say('app.subscriptionAccept');
  acceptance.append(accept, acceptanceText);
  accept.addEventListener('change', () => payment.accept(accept.checked));
  const pay = create('button', 'subscription-pay');
  pay.type = 'submit';
  pay.className = 'toll-open';
  pay.textContent = say('app.subscriptionPay');
  form.append(choices, terms, acceptance, pay);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void payment.pay();
  });
  const retry = create('button', 'subscription-retry');
  retry.type = 'button';
  retry.className = 'toll-open';
  retry.addEventListener('click', () => void payment.start());
  root.append(heading, close, status, form, retry);

  let shownOffers: SubscriptionState['offers'] = null;
  const render = (state: SubscriptionState): void => {
    root.dataset.stage = state.stage;
    const key = state.problem === null ? PROGRESS[state.stage] : PROBLEMS[state.problem];
    let text = key === undefined ? '' : say(key);
    if (state.stage === 'error' && state.checkingOnly && state.problem !== 'unconfirmed') {
      text += ` ${say('app.subscriptionUnconfirmed')}`;
    }
    status.textContent = text;
    status.hidden = text === '';
    form.hidden = state.offers === null || state.stage === 'error' || state.stage === 'confirmed';
    choices.disabled = state.stage !== 'offer';
    accept.disabled = state.stage !== 'offer';
    accept.checked = state.accepted;
    pay.disabled = state.stage !== 'offer' || state.selected === null || !state.accepted;
    retry.hidden = state.stage !== 'error';
    retry.disabled = false;
    retry.textContent = say(state.checkingOnly ? 'app.subscriptionCheckAgain' : 'app.subscriptionRetry');

    if (shownOffers !== state.offers) {
      shownOffers = state.offers;
      tiers.replaceChildren();
      terms.removeAttribute('href');
      if (state.offers !== null) {
        terms.href = state.offers.termsUrl;
        for (const tier of state.offers.tiers) {
          const label = create('label', `subscription-tier-label-${tier.id}`);
          label.className = 'subscription-choice';
          const radio = create('input', `subscription-tier-${tier.id}`);
          radio.type = 'radio';
          radio.name = 'subscription-tier';
          radio.value = tier.id;
          radio.required = true;
          radio.addEventListener('change', () => { if (radio.checked) payment.select(tier.id); });
          const text = create('span', `subscription-tier-text-${tier.id}`);
          text.textContent = messageFor(language, 'app.subscriptionTier', { count: tier.days, stars: tier.stars });
          label.append(radio, text);
          tiers.append(label);
        }
      }
    }
    for (const radio of tiers.querySelectorAll<HTMLInputElement>('input')) {
      radio.checked = radio.value === state.selected;
    }
  };
  render(payment.view());
  return {
    render,
    show() {
      root.hidden = false;
      heading.focus({ preventScroll: true });
    },
  };
};
